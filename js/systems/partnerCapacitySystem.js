// partnerCapacitySystem.js
//
// v0.23: Partner Capacity / Partner Autonomy Foundation.
//
// Partner przestaje być czystym odbiornikiem decyzji gracza (trust/
// frustration jako "nagroda/kara za wybór"). Dostaje WŁASNĄ, prostą
// pojemność dnia — czasem ma mało miejsca, niezależnie od tego, co
// robi gracz. To FUNDAMENT, nie pełna symulacja: jeden los dziennie,
// subtelny wpływ na wagę eventów i narrację, ZERO nowych mechanicznych
// kosztów dla gracza.
//
// WAŻNE: w kodzie `partner.capacity` jest liczbą (0-10) — ale w
// narracji/UI NIGDY nie pokazujemy tej liczby. Gracz widzi tylko
// język typu "ma dziś mało miejsca" / "jest na granicy" / "ma dziś
// trochę powietrza". Zero paska, zero "capacity: 2/10".
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w
// state.partner.capacity. Ekrany (gameScreen.js, eventScreen.js,
// weeklySummaryScreen.js) i eventWeightSystem.js czytają przez ten
// moduł.

import { getActivePatterns } from "./patternSystem.js";

const MAX_HISTORY = 14;
const RECENT_WINDOW_DAYS = 7;

const SIGNAL_DEFINITIONS = {
  heavy_work_day: {
    title: "Ciężki dzień",
    texts: [
      "{partnerName} wygląda, jakby cały dzień trzymał/a twarz w miejscu siłą woli.",
      "{partnerName} wraca z dnia, który nie zostawił dużo miejsca na cudze emocje.",
      "W {partnerName} jest dziś mniej odpowiedzi niż zwykle."
    ]
  },
  social_overload: {
    title: "Za dużo bodźców",
    texts: [
      "{partnerName} jest obecny/a, ale jakby zza grubej szyby.",
      "Każde dodatkowe zdanie wydaje się dziś u {partnerName} kosztować więcej.",
      "{partnerName} słyszy cię, ale świat też mówi za głośno."
    ]
  },
  good_day: {
    title: "Trochę powietrza",
    texts: [
      "{partnerName} ma dziś trochę więcej powietrza.",
      "W {partnerName} jest dziś rzadki luksus: odrobina miejsca.",
      "Dzisiaj rozmowa nie musi od razu stawać się ciężarem."
    ]
  },
  quiet_day: {
    title: "Spokojny dzień",
    texts: [
      "{partnerName} jest spokojniejszy/a niż zwykle, ale nie nieskończony/a.",
      "Jest tu trochę ciszy, która nie jest jeszcze oddaleniem.",
      "Dzień nie wygląda groźnie. To już coś."
    ]
  },
  distant_day: {
    title: "Poza zasięgiem",
    texts: [
      "{partnerName} jest daleko, nawet kiedy jest blisko.",
      "Coś w {partnerName} zamknęło drzwi od środka.",
      "Dostępność też ma czasem status: brak zasięgu."
    ]
  }
};

// Krótkie etykiety do skróconej formy morning teasera ("Partner: ...")
// — używane, żeby narracja poranka (już dzieląca się miejscem z
// Echo/Wzorcem/Weekly Stake/Wielkim Testem) nie robiła się za długa.
const SHORT_MOOD_LABELS = {
  open: "trochę powietrza",
  stable: "stabilnie",
  tired: "mało miejsca",
  overloaded: "na granicy",
  distant: "poza zasięgiem"
};

const NEGATIVE_SIGNAL_TYPES = ["heavy_work_day", "social_overload", "distant_day"];

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.partner.capacity istnieje. Bezpieczne dla
 * starych zapisów (sprzed v0.23). Zwraca null, jeśli w ogóle nie ma
 * jeszcze partnera w stanie (nie powinno się zdarzyć w normalnym flow
 * gry, ale to bezpiecznik). Nie zmienia saveVersion.
 */
export function ensurePartnerCapacityState(state) {
  if (!state || !state.partner) {
    return null;
  }

  if (!state.partner.capacity) {
    state.partner.capacity = {
      current: 5,
      max: 10,
      stress: 30,
      mood: "stable",
      lastRolledDay: null,
      dailySignal: null,
      history: []
    };
  }

  if (!Array.isArray(state.partner.capacity.history)) {
    state.partner.capacity.history = [];
  }

  return state.partner.capacity;
}

/**
 * Losuje/aktualizuje pojemność partnera na DZISIAJ. IDEMPOTENTNE: jeśli
 * capacity.lastRolledDay === state.day, nic nie robi (nie losuje
 * ponownie) — bezpieczne przy wielokrotnym renderze poranka.
 *
 * Formuła (celowo subtelna, nie brutalna):
 *   base roll 3-8
 *   frustration >= 70 → -2 capacity, +15 stress
 *   frustration >= 50 → -1 capacity, +8 stress
 *   trust >= 70        → +1 capacity, -5 stress
 *   aktywny wzorzec "avoidance" (TYLKO ODCZYT z Pattern Foundation)
 *                       → +8 stress
 *   aktywny wzorzec "repair"/"rest"/"transparency"
 *                       → +1 capacity, -4 stress (stabilizujące)
 */
export function resolvePartnerDailyCapacity(state) {
  const capacity = ensurePartnerCapacityState(state);
  if (!capacity) {
    return null;
  }

  if (capacity.lastRolledDay === state.day) {
    return capacity;
  }

  const npc = getPartnerNpc(state);
  const frustration = npc ? Number(npc.frustration) || 0 : 0;
  const trust = npc ? Number(npc.trust) || 0 : 0;
  const activePatternIds = getActivePatterns(state).map((pattern) => pattern.id);

  let capacityDelta = 0;
  let stressDelta = 0;

  if (frustration >= 70) {
    capacityDelta -= 2;
    stressDelta += 15;
  } else if (frustration >= 50) {
    capacityDelta -= 1;
    stressDelta += 8;
  }

  if (trust >= 70) {
    capacityDelta += 1;
    stressDelta -= 5;
  }

  if (activePatternIds.includes("avoidance")) {
    stressDelta += 8;
  }

  if (
    activePatternIds.includes("repair") ||
    activePatternIds.includes("rest") ||
    activePatternIds.includes("transparency")
  ) {
    capacityDelta += 1;
    stressDelta -= 4;
  }

  const baseRoll = randomInt(3, 8);
  const previousCurrent = capacity.current;
  const previousStress = capacity.stress;

  const nextCurrent = clamp(baseRoll + capacityDelta, 0, capacity.max);
  const nextStress = clamp(previousStress + stressDelta, 0, 100);
  const mood = computeMood(nextCurrent, nextStress);

  const signal = buildDailySignal(state, {
    mood,
    capacityChange: nextCurrent - previousCurrent,
    stressChange: nextStress - previousStress
  });

  capacity.current = nextCurrent;
  capacity.stress = nextStress;
  capacity.mood = mood;
  capacity.lastRolledDay = state.day;
  capacity.dailySignal = signal;

  capacity.history.push(signal);
  cleanupPartnerCapacityHistory(state);

  return capacity;
}

function cleanupPartnerCapacityHistory(state) {
  const capacity = ensurePartnerCapacityState(state);
  if (!capacity) {
    return;
  }

  if (capacity.history.length > MAX_HISTORY) {
    capacity.history = capacity.history.slice(capacity.history.length - MAX_HISTORY);
  }
}

// --------------------------------------------------------------------
// Mood / sygnał dnia
// --------------------------------------------------------------------

function computeMood(current, stress) {
  if (current >= 8 && stress <= 30) {
    return "open";
  }

  if (current >= 5) {
    return "stable";
  }

  if (current >= 3) {
    return "tired";
  }

  if (current >= 1) {
    return "overloaded";
  }

  return "distant";
}

/**
 * Przelicza mood na podstawie AKTUALNYCH current/stress bez losowania
 * nowego rolla — używane głównie przez devTools (po ręcznym ustawieniu
 * wartości testowych).
 */
export function refreshPartnerCapacityMood(state) {
  const capacity = ensurePartnerCapacityState(state);
  if (!capacity) {
    return null;
  }

  capacity.mood = computeMood(capacity.current, capacity.stress);
  return capacity.mood;
}

function pickSignalType(mood) {
  switch (mood) {
    case "open":
      return "good_day";
    case "stable":
      return "quiet_day";
    case "tired":
      return "heavy_work_day";
    case "overloaded":
      return "social_overload";
    case "distant":
      return "distant_day";
    default:
      return "quiet_day";
  }
}

function buildDailySignal(state, { mood, capacityChange, stressChange }) {
  const type = pickSignalType(mood);
  const definition = SIGNAL_DEFINITIONS[type];
  const partnerName = state.partner ? state.partner.name : "Partner";
  const text = pickRandom(definition.texts).replace(/\{partnerName\}/g, partnerName);

  return {
    day: state.day,
    type,
    title: definition.title,
    text,
    capacityChange,
    stressChange
  };
}

// --------------------------------------------------------------------
// Odczyt / prezentacja (nigdy surowych liczb do UI)
// --------------------------------------------------------------------

export function getPartnerCapacity(state) {
  return ensurePartnerCapacityState(state);
}

export function getPartnerCapacityMood(state) {
  const capacity = ensurePartnerCapacityState(state);
  return capacity ? capacity.mood : null;
}

export function getPartnerMorningSignal(state) {
  const capacity = ensurePartnerCapacityState(state);
  return capacity ? capacity.dailySignal : null;
}

/**
 * Zwraca krótką etykietę do skróconej formy morning teasera
 * ("Partner: {shortLabel}.") — bez liczb.
 */
export function getPartnerCapacityShortLabel(state) {
  const mood = getPartnerCapacityMood(state);
  return mood ? SHORT_MOOD_LABELS[mood] || "stabilnie" : null;
}

/**
 * Kontekst do narracji eventów i wagi losowania — flagi/etykiety, NIE
 * surowe liczby do pokazania graczowi (stress jest tu wyłącznie do
 * użytku wewnętrznego przez eventWeightSystem.js).
 */
export function getPartnerCapacityContext(state) {
  const capacity = ensurePartnerCapacityState(state);

  if (!capacity) {
    return { mood: null, isLow: false, isCritical: false, stress: 0 };
  }

  return {
    mood: capacity.mood,
    isLow: capacity.current <= 2,
    isCritical: capacity.mood === "overloaded" || capacity.mood === "distant",
    stress: capacity.stress
  };
}

/**
 * Krótka, zagregowana notatka o partnerze z ostatniego tygodnia (do
 * weekly summary) — np. "{partnerName} częściej był/a w tym tygodniu
 * na granicy niż dostępny/a." Zwraca null, jeśli nie ma jeszcze
 * wystarczających danych.
 */
export function buildWeeklyPartnerCapacityNote(state) {
  const capacity = ensurePartnerCapacityState(state);
  if (!capacity || !Array.isArray(capacity.history) || capacity.history.length === 0) {
    return null;
  }

  const recentSignals = capacity.history.filter((signal) => signal.day > state.day - RECENT_WINDOW_DAYS);
  if (recentSignals.length === 0) {
    return null;
  }

  const negativeCount = recentSignals.filter((signal) => NEGATIVE_SIGNAL_TYPES.includes(signal.type)).length;
  const positiveCount = recentSignals.length - negativeCount;
  const partnerName = state.partner ? state.partner.name : "Partner";

  if (negativeCount > positiveCount) {
    return `${partnerName} częściej był/a w tym tygodniu na granicy niż dostępny/a.`;
  }

  if (positiveCount > negativeCount) {
    return `${partnerName} miał/a w tym tygodniu więcej przestrzeni niż zwykle.`;
  }

  return `${partnerName} balansował/a w tym tygodniu między dostępnością a zmęczeniem.`;
}

// --------------------------------------------------------------------
// Pomocnicze
// --------------------------------------------------------------------

function getPartnerNpc(state) {
  if (!state || !state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
