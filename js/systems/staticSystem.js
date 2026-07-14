// staticSystem.js
//
// v0.27: The Static / Szum wewnętrzny.
//
// Świat gry nie zmienia się obiektywnie — ale kiedy gracz jest
// przeciążony (mało spoons, wysokie zmęczenie, napięta relacja,
// powtarzalne wzorce unikania/przeciążania się, aktywna blizna
// relacyjna, świeża porażka w Wielkim Teście), wszystko zaczyna
// docierać przez cienką warstwę szumu. To FUNDAMENT: w v0.27 szum
// wpływa WYŁĄCZNIE na narrację — krótkie, subtelne zdania na poranku,
// w evencie, w reflection i w weekly summary. Zero zmian mechanicznych:
// nie dotyka spoons, trust, frustration, dostępności kart, Pattern
// Pressure, blizn ani naprawy.
//
// Ważne zasady projektowe:
//   - liczony RAZ dziennie, idempotentnie (lastCalculatedDay),
//   - żadnych glitchy, migania, psucia tekstu wyborów — tylko spokojne,
//     krótkie zdania,
//   - reasons (powody) są WEWNĘTRZNE — nigdy nie pokazywane graczowi
//     jako lista, tylko przez devTools do debugowania,
//   - intensity 0-3, gdzie 0 oznacza "brak/tło" i nie generuje żadnej
//     widocznej linii.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w
// state.player.static. Ekrany (gameScreen.js, eventScreen.js,
// reflectionScreen.js, weeklySummaryScreen.js) czytają przez ten
// moduł. TYLKO CZYTA z patternSystem.js / partnerCapacitySystem.js /
// relationshipScarsSystem.js (żadna z tamtych funkcji nie jest tu
// modyfikowana).

import { getActivePatterns } from "./patternSystem.js";
import { getPartnerCapacityContext } from "./partnerCapacitySystem.js";
import { ensureRelationshipScarsState } from "./relationshipScarsSystem.js";

const MAX_HISTORY = 30;
const RECENT_WINDOW_DAYS = 7;
const CRITICAL_FAILURE_WINDOW_DAYS = 7;

// Ticket podaje dokładnie JEDNO zdanie na poziom intensywności na
// poranek (nie pulę) — traktujemy je jako kanoniczne, stałe teksty.
const MORNING_LINES = {
  1: "Dzień ma lekki szum na krawędziach.",
  2: "Rzeczy docierają trochę za głośno i trochę za późno.",
  3: "Świat działa dziś bez trybu cichego."
};

const EVENT_LINES = [
  "Między zdaniami pojawia się biały szum.",
  "Nie jesteś pewien/pewna, czy to sytuacja jest ciężka, czy dzisiaj wszystko waży więcej.",
  "Niektóre słowa przychodzą do ciebie z opóźnieniem."
];

const REFLECTION_LINES = [
  "Decyzja zapadła, zanim szum zdążył opaść.",
  "Trudno powiedzieć, ile było w tym wyboru, a ile hałasu w głowie.",
  "Niektóre konsekwencje słychać dopiero po chwili."
];

const WEEKLY_NOTE_PEAK = "Przynajmniej raz świat był w tym tygodniu głośniejszy niż twoje zasoby.";
const WEEKLY_NOTE_PROGRESS = "Ten tydzień miał kilka dni, w których rzeczy docierały przez warstwę szumu.";

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.player.static istnieje. Bezpieczne dla starych
 * zapisów (sprzed v0.27). Zwraca null, jeśli w ogóle nie ma gracza w
 * stanie (bezpiecznik). Nie zmienia saveVersion.
 */
export function ensureStaticState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.player.static) {
    state.player.static = {
      intensity: 0,
      lastCalculatedDay: null,
      reasons: [],
      dailySignal: null,
      history: []
    };
  }

  if (!Array.isArray(state.player.static.reasons)) {
    state.player.static.reasons = [];
  }

  if (!Array.isArray(state.player.static.history)) {
    state.player.static.history = [];
  }

  return state.player.static;
}

/**
 * Zwraca aktualny state.player.static (po lazy-init) — prosty
 * akcesor, bez przeliczania.
 */
export function getStaticState(state) {
  return ensureStaticState(state);
}

/**
 * Przelicza intensity szumu na DZISIAJ. IDEMPOTENTNE: jeśli
 * lastCalculatedDay === state.day, nic nie robi (nie liczy ponownie) —
 * bezpieczne przy wielokrotnym renderze poranka.
 *
 * Punkty ryzyka (patrz specyfikacja):
 *   spoons <= 2: +2, spoons <= 4: +1 (jedno albo drugie, nie oba)
 *   fatigue >= 4: +1
 *   partner frustration >= 65: +1
 *   partner trust <= 35: +1
 *   partner capacity mood overloaded/distant: +1
 *   aktywny wzorzec overextension: +1
 *   aktywny wzorzec avoidance: +1
 *   istnieje aktywna blizna relacyjna: +1
 *   ostatni Wielki Test był porażką w ostatnich 7 dniach: +1
 *
 * Mapowanie: score<=1 -> 0, score==2 -> 1, score 3-4 -> 2, score>=5 -> 3.
 */
export function calculateDailyStatic(state) {
  const staticState = ensureStaticState(state);
  if (!staticState) {
    return null;
  }

  if (staticState.lastCalculatedDay === state.day) {
    return staticState;
  }

  const { score, reasons } = computeStaticScore(state);
  const intensity = mapScoreToIntensity(score);
  const signal = buildDailySignal(state, intensity);

  staticState.intensity = intensity;
  staticState.reasons = reasons;
  staticState.lastCalculatedDay = state.day;
  staticState.dailySignal = signal;

  recordStaticHistory(staticState, state.day, intensity, reasons);

  return staticState;
}

function mapScoreToIntensity(score) {
  if (score <= 1) {
    return 0;
  }

  if (score === 2) {
    return 1;
  }

  if (score <= 4) {
    return 2;
  }

  return 3;
}

function computeStaticScore(state) {
  let score = 0;
  const reasons = [];

  const spoons = state.resources ? state.resources.spoons.current : null;
  if (typeof spoons === "number") {
    if (spoons <= 2) {
      score += 2;
      reasons.push("low-spoons");
    } else if (spoons <= 4) {
      score += 1;
      reasons.push("low-spoons");
    }
  }

  const fatigue = state.resources && state.resources.fatigue ? state.resources.fatigue.current : null;
  if (typeof fatigue === "number" && fatigue >= 4) {
    score += 1;
    reasons.push("high-fatigue");
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    if (typeof npc.frustration === "number" && npc.frustration >= 65) {
      score += 1;
      reasons.push("relationship-tension");
    }
    if (typeof npc.trust === "number" && npc.trust <= 35) {
      score += 1;
      reasons.push("low-trust");
    }
  }

  const capacityContext = getPartnerCapacityContext(state);
  if (capacityContext && (capacityContext.mood === "overloaded" || capacityContext.mood === "distant")) {
    score += 1;
    reasons.push("partner-overloaded");
  }

  const activePatternIds = getActivePatterns(state).map((pattern) => pattern.id);
  if (activePatternIds.includes("overextension")) {
    score += 1;
    reasons.push("overextension-pattern");
  }
  if (activePatternIds.includes("avoidance")) {
    score += 1;
    reasons.push("avoidance-pattern");
  }

  const scars = ensureRelationshipScarsState(state);
  if (scars && scars.length > 0) {
    score += 1;
    reasons.push("active-scar");
  }

  if (checkRecentCriticalFailure(state)) {
    score += 1;
    reasons.push("recent-critical-failure");
  }

  return { score, reasons: Array.from(new Set(reasons)) };
}

function checkRecentCriticalFailure(state) {
  const criticalEvent = state.criticalEvent;
  if (!criticalEvent || !criticalEvent.lastResult) {
    return false;
  }

  const result = criticalEvent.lastResult;
  if (result.success) {
    return false;
  }

  const daysSince = state.day - result.dueDay;
  return daysSince >= 0 && daysSince <= CRITICAL_FAILURE_WINDOW_DAYS;
}

function getPartnerNpc(state) {
  if (!state || !state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

function buildDailySignal(state, intensity) {
  return {
    day: state.day,
    intensity,
    text: MORNING_LINES[intensity] || null
  };
}

function recordStaticHistory(staticState, day, intensity, reasons) {
  const existingIndex = staticState.history.findIndex((entry) => entry.day === day);

  if (existingIndex !== -1) {
    staticState.history[existingIndex] = { day, intensity, reasons };
  } else {
    staticState.history.push({ day, intensity, reasons });
  }

  if (staticState.history.length > MAX_HISTORY) {
    staticState.history = staticState.history.slice(staticState.history.length - MAX_HISTORY);
  }
}

// --------------------------------------------------------------------
// Odczyt / prezentacja (nigdy surowych liczb ani listy powodów do UI gracza)
// --------------------------------------------------------------------

/**
 * Zwraca krótką linię na poranek, TYLKO jeśli intensity >= 1. Zwraca
 * null w przeciwnym razie — morning narrative wtedy wygląda dokładnie
 * tak samo jak bez tego systemu.
 */
export function buildMorningStaticLine(state) {
  const staticState = ensureStaticState(state);
  if (!staticState || staticState.intensity < 1) {
    return null;
  }

  return MORNING_LINES[staticState.intensity] || null;
}

/**
 * Zwraca krótką linię do narracji eventu, TYLKO jeśli intensity >= 2.
 * Nigdy nie zmienia tekstu wyborów, nie ukrywa kart, nie pokazuje liczb.
 */
export function buildEventStaticLine(state, event) {
  const staticState = ensureStaticState(state);
  if (!staticState || staticState.intensity < 2) {
    return null;
  }

  return pickRandom(EVENT_LINES);
}

/**
 * Zwraca JEDNO krótkie zdanie do ekranu Reflection, TYLKO jeśli
 * intensity >= 2. Maksymalnie jedno zdanie — nie dokłada się do ściany
 * tekstu z Pattern Pressure/Relationship Scars/Repair.
 */
export function buildReflectionStaticLine(state, logEntry) {
  const staticState = ensureStaticState(state);
  if (!staticState || staticState.intensity < 2) {
    return null;
  }

  return pickRandom(REFLECTION_LINES);
}

/**
 * Buduje krótką wzmiankę do weekly summary, JEŚLI w ostatnich 7 dniach
 * intensity >= 2 wystąpiło przynajmniej raz. Priorytet ma zdanie o
 * "szczycie" (intensity 3), jeśli taki dzień się zdarzył. Zwraca null,
 * jeśli nic się nie działo.
 */
export function buildWeeklyStaticNote(state) {
  const staticState = ensureStaticState(state);
  if (!staticState || staticState.history.length === 0) {
    return null;
  }

  const recentEntries = staticState.history.filter((entry) => entry.day > state.day - RECENT_WINDOW_DAYS);
  const notableEntries = recentEntries.filter((entry) => entry.intensity >= 2);

  if (notableEntries.length === 0) {
    return null;
  }

  const hadPeakIntensity = notableEntries.some((entry) => entry.intensity >= 3);
  return hadPeakIntensity ? WEEKLY_NOTE_PEAK : WEEKLY_NOTE_PROGRESS;
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie stanu
 * szumu — intensity, reasons, lastCalculatedDay, dailySignal, ostatnie
 * 7 wpisów historii. Te dane NIGDY nie trafiają do UI gracza.
 */
export function getStaticDebugSummary(state) {
  const staticState = ensureStaticState(state);
  if (!staticState) {
    return null;
  }

  return {
    intensity: staticState.intensity,
    reasons: staticState.reasons,
    lastCalculatedDay: staticState.lastCalculatedDay,
    dailySignal: staticState.dailySignal,
    recentHistory: staticState.history.slice(-7)
  };
}

/**
 * Ręcznie ustawia intensity (0-3) na bieżący dzień — wyłącznie do
 * debugowania (window.oosDev.setStaticHigh() woła to z intensity=3).
 * Zapisuje wpis do history tak samo jak normalne przeliczenie.
 */
export function setStaticForDebug(state, intensity) {
  const staticState = ensureStaticState(state);
  if (!staticState) {
    return null;
  }

  const clampedIntensity = Math.max(0, Math.min(3, Math.floor(Number(intensity)) || 0));
  const reasons = ["debug"];
  const signal = buildDailySignal(state, clampedIntensity);

  staticState.intensity = clampedIntensity;
  staticState.reasons = reasons;
  staticState.lastCalculatedDay = state.day;
  staticState.dailySignal = signal;

  recordStaticHistory(staticState, state.day, clampedIntensity, reasons);

  return staticState;
}

/**
 * Resetuje szum do zera — wyłącznie do debugowania
 * (window.oosDev.clearStatic()).
 */
export function clearStaticForDebug(state) {
  const staticState = ensureStaticState(state);
  if (!staticState) {
    return null;
  }

  staticState.intensity = 0;
  staticState.reasons = [];
  staticState.dailySignal = null;

  return staticState;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
