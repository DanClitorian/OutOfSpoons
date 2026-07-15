// dailyStakesSystem.js
//
// v0.32: Game Feel / Daily Stakes Pass.
//
// Gra ma zacząć bardziej przypominać emocjonującą rozgrywkę niż
// interaktywny dziennik — gracz ma od rana czuć, że dzień ma stawkę,
// ryzyko i kierunek. Ten system NIE zmienia żadnej mechaniki wyborów:
// nie dotyka spoons, trust, frustration, losowania eventów ani
// dostępności kart. To wyłącznie warstwa "game feel" / framingu —
// czyta istniejący stan (spoons, relacja, Weekly Stakes, Wielki Test,
// Static, Work Pressure, Metamour, blizny, wzorce) i przekłada go na
// JEDNO wewnętrzne, poziomowe "napięcie dnia" (low/medium/high/
// critical), pokazywane graczowi WYŁĄCZNIE jako etykieta + krótkie
// zdanie — nigdy jako liczba.
//
// Liczony RAZ dziennie, idempotentnie (state.player.dailyStakes.day).
// Ten moduł TYLKO CZYTA z pozostałych systemów — nie modyfikuje ich
// stanu, nie wywołuje żadnych ich funkcji "roll"/"apply".

import { getCurrentWeeklyChallenge, getWeeklyChallengeCountdown } from "./weeklyChallengeSystem.js?v=300";
import { getCurrentCriticalEvent, getCriticalEventCountdown } from "./criticalEventSystem.js?v=305";
import { getStaticState } from "./staticSystem.js?v=300";
import { getWorkPressureContext } from "./workPressureSystem.js?v=300";
import { getMetamourContext } from "./metamourSystem.js?v=300";
import { ensureRelationshipScarsState } from "./relationshipScarsSystem.js?v=300";
import { getActivePatterns } from "./patternSystem.js?v=300";

const LEVEL_LABELS = {
  low: "Niskie napięcie",
  medium: "Podwyższone napięcie",
  high: "Wysokie napięcie",
  critical: "Dzień krytyczny"
};

// Zdania celowo BEZ prefiksu "Stawka dnia:" — dopisywany dopiero w
// buildMorningStakesLine(), żeby buildAgendaStakesBadge() mogło użyć
// tego samego zdania jako samodzielnej frazy (z wielką literą, patrz
// capitalize()) bez powtarzania etykiety, która i tak jest już obok.
const LEVEL_TEXTS = {
  low: [
    "nic wielkiego, ale rytm dnia się liczy.",
    "utrzymać zwykły rytm.",
    "nie zepsuć spokoju niepotrzebnym pośpiechem."
  ],
  medium: [
    "nie przeciążyć systemu.",
    "utrzymać kontakt bez przepalania siebie.",
    "nie zrobić z ciszy strategii."
  ],
  high: [
    "nie pozwolić pracy wejść w relację butami.",
    "przeżyć dzień bez udawania, że to nic.",
    "nie dać napięciu decydować za ciebie."
  ],
  critical: [
    "niewiele dziś dzieli dobry wybór od złego.",
    "system jest blisko granicy. Ty pewnie też.",
    "nie ma dziś łatwych opcji, tylko mniej i bardziej kosztowne."
  ]
};

const REFLECTION_TEXTS = [
  "Ten wybór nie zamknął dnia, ale zmienił jego ciężar.",
  "To był ruch w stronę kontaktu, nawet jeśli kosztował.",
  "System odnotował kolejne przeciążenie. Ciało pewnie zrobiło to wcześniej.",
  "Dzień nadal trwa. Niestety."
];

// v0.32: reflection line pojawia się "czasem, jeśli ma sens" — NIGDY
// przy level="low" (nic tam nie ma sensu dodawać), a im wyższy poziom,
// tym częściej — ale NIGDY zawsze, żeby nie dokładać się do ściany
// tekstu z Pattern Pressure/Relationship Scars/Repair/Static/Metamour/
// Work, które już mogą coś powiedzieć w tej samej refleksji.
const REFLECTION_CHANCE_BY_LEVEL = {
  medium: 0.3,
  high: 0.5,
  critical: 0.75
};

// Mapowanie surowych "reasons" (wewnętrzne, nigdy pokazywane graczowi)
// na szersze, tematyczne "tags" — do ewentualnego przyszłego użytku
// (np. ważenie eventów), NIE wpięte w v0.32 w eventWeightSystem.js.
const REASON_TO_TAG = {
  "low-spoons": "spoons",
  "high-frustration": "relationship",
  "low-trust": "relationship",
  "weekly-stake-close": "stakes",
  "critical-event-close": "stakes",
  "high-static": "overload",
  "work-pressure": "work",
  "metamour-tension": "metamour",
  "active-scars": "relationship",
  "active-patterns": "pattern"
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.player.dailyStakes istnieje. Bezpieczne dla
 * starych zapisów (sprzed v0.32). Zwraca null, jeśli w ogóle nie ma
 * gracza w stanie. Nie zmienia saveVersion.
 */
export function ensureDailyStakesState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.player.dailyStakes) {
    state.player.dailyStakes = {
      day: null,
      level: "low",
      title: LEVEL_LABELS.low,
      text: "",
      reasons: [],
      tags: []
    };
  }

  if (!Array.isArray(state.player.dailyStakes.reasons)) {
    state.player.dailyStakes.reasons = [];
  }

  if (!Array.isArray(state.player.dailyStakes.tags)) {
    state.player.dailyStakes.tags = [];
  }

  return state.player.dailyStakes;
}

/**
 * Przelicza napięcie dnia. IDEMPOTENTNE: jeśli
 * dailyStakes.day === state.day, zwraca istniejący wynik bez
 * ponownego liczenia — bezpieczne przy wielokrotnym renderze
 * poranka/agendy/reflection tego samego dnia.
 *
 * Punkty napięcia (wyłącznie WEWNĘTRZNE — nigdy pokazywane graczowi):
 *   spoons <= 2: +3, spoons <= 4: +1
 *   partner frustration >= 70: +3, >= 55: +1
 *   partner trust <= 35: +3, <= 50: +1
 *   Weekly Stake blisko dueDay (<=1 dnia): +2, (<=2 dni): +1
 *   Wielki Test blisko dueDay (<=3 dni): +3
 *   Static intensity >= 3: +2, >= 2: +1
 *   work pressure >= 65 albo burnout >= 60: +3
 *   metamour tension >= 85: +2, >= 65: +1
 *   aktywna blizna relacyjna: +1
 *   aktywny wzorzec: +1
 *
 * Mapowanie: score<=2 -> low, 3-5 -> medium, 6-8 -> high, 9+ -> critical.
 */
export function calculateDailyStakes(state) {
  const stakes = ensureDailyStakesState(state);
  if (!stakes) {
    return null;
  }

  if (stakes.day === state.day) {
    return stakes;
  }

  const { score, reasons } = computeStakesScore(state);
  const level = mapScoreToLevel(score);
  const tags = deriveTags(reasons);

  stakes.day = state.day;
  stakes.level = level;
  stakes.title = LEVEL_LABELS[level] || LEVEL_LABELS.low;
  stakes.text = pickRandom(LEVEL_TEXTS[level] || LEVEL_TEXTS.low);
  stakes.reasons = reasons;
  stakes.tags = tags;

  return stakes;
}

function computeStakesScore(state) {
  let score = 0;
  const reasons = [];

  const spoons = readCurrentSpoons(state);
  if (typeof spoons === "number") {
    if (spoons <= 2) {
      score += 3;
      reasons.push("low-spoons");
    } else if (spoons <= 4) {
      score += 1;
      reasons.push("low-spoons");
    }
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    if (typeof npc.frustration === "number") {
      if (npc.frustration >= 70) {
        score += 3;
        reasons.push("high-frustration");
      } else if (npc.frustration >= 55) {
        score += 1;
        reasons.push("high-frustration");
      }
    }

    if (typeof npc.trust === "number") {
      if (npc.trust <= 35) {
        score += 3;
        reasons.push("low-trust");
      } else if (npc.trust <= 50) {
        score += 1;
        reasons.push("low-trust");
      }
    }
  }

  const weeklyChallenge = getCurrentWeeklyChallenge(state);
  if (weeklyChallenge) {
    const daysLeft = getWeeklyChallengeCountdown(state);
    if (typeof daysLeft === "number") {
      if (daysLeft <= 1) {
        score += 2;
        reasons.push("weekly-stake-close");
      } else if (daysLeft <= 2) {
        score += 1;
        reasons.push("weekly-stake-close");
      }
    }
  }

  const criticalEvent = getCurrentCriticalEvent(state);
  if (criticalEvent) {
    const daysLeft = getCriticalEventCountdown(state);
    if (typeof daysLeft === "number" && daysLeft <= 3) {
      score += 3;
      reasons.push("critical-event-close");
    }
  }

  const staticState = getStaticState(state);
  if (staticState) {
    if (staticState.intensity >= 3) {
      score += 2;
      reasons.push("high-static");
    } else if (staticState.intensity >= 2) {
      score += 1;
      reasons.push("high-static");
    }
  }

  const workContext = getWorkPressureContext(state);
  if (workContext && (workContext.pressure >= 65 || workContext.burnout >= 60)) {
    score += 3;
    reasons.push("work-pressure");
  }

  const metamourContext = getMetamourContext(state);
  if (metamourContext && typeof metamourContext.tension === "number") {
    if (metamourContext.tension >= 85) {
      score += 2;
      reasons.push("metamour-tension");
    } else if (metamourContext.tension >= 65) {
      score += 1;
      reasons.push("metamour-tension");
    }
  }

  const scars = ensureRelationshipScarsState(state);
  if (scars && scars.length > 0) {
    score += 1;
    reasons.push("active-scars");
  }

  const activePatterns = getActivePatterns(state);
  if (Array.isArray(activePatterns) && activePatterns.length > 0) {
    score += 1;
    reasons.push("active-patterns");
  }

  return { score, reasons: Array.from(new Set(reasons)) };
}

function mapScoreToLevel(score) {
  if (score <= 2) {
    return "low";
  }

  if (score <= 5) {
    return "medium";
  }

  if (score <= 8) {
    return "high";
  }

  return "critical";
}

function deriveTags(reasons) {
  const tags = reasons.map((reason) => REASON_TO_TAG[reason]).filter(Boolean);
  return Array.from(new Set(tags));
}

function readCurrentSpoons(state) {
  return state &&
    state.resources &&
    state.resources.spoons &&
    typeof state.resources.spoons.current === "number"
    ? state.resources.spoons.current
    : null;
}

function getPartnerNpc(state) {
  if (!state || !state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

// --------------------------------------------------------------------
// Odczyt / prezentacja (nigdy liczb, nigdy listy reasons do UI gracza)
// --------------------------------------------------------------------

/**
 * Zwraca krótką linię na poranek, np. "Stawka dnia: nie przeciążyć
 * systemu." Zawsze coś zwraca (level zawsze istnieje), poza
 * bezpiecznikiem braku gracza w stanie.
 */
export function buildMorningStakesLine(state) {
  const stakes = calculateDailyStakes(state);
  if (!stakes || !stakes.text) {
    return null;
  }

  return `Stawka dnia: ${stakes.text}`;
}

/**
 * Zwraca krótki obiekt do małego badge'a na ekranie agendy —
 * { label, text } — bez liczb, bez listy powodów.
 */
export function buildAgendaStakesBadge(state) {
  const stakes = calculateDailyStakes(state);
  if (!stakes) {
    return null;
  }

  return {
    level: stakes.level,
    label: LEVEL_LABELS[stakes.level] || LEVEL_LABELS.low,
    text: capitalize(stakes.text)
  };
}

/**
 * Zwraca JEDNO krótkie zdanie do ekranu Reflection, TYLKO CZASEM
 * (nigdy przy level="low", a im wyższy poziom, tym większa szansa) —
 * żeby nie dokładać się do ściany tekstu z innych systemów. Zwraca
 * null w większości wywołań, co jest oczekiwanym, normalnym wynikiem.
 */
export function buildReflectionStakesLine(state, lastLogEntry) {
  const stakes = ensureDailyStakesState(state);
  if (!stakes || stakes.level === "low") {
    return null;
  }

  const chance = REFLECTION_CHANCE_BY_LEVEL[stakes.level] || 0;
  if (Math.random() > chance) {
    return null;
  }

  return pickRandom(REFLECTION_TEXTS);
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie napięcia
 * dnia — level, title, text, reasons, tags. Te dane NIGDY nie trafiają
 * do UI gracza jako liczby — w grze widać tylko etykietę i zdanie.
 */
export function getDailyStakesDebugSummary(state) {
  const stakes = ensureDailyStakesState(state);
  if (!stakes) {
    return null;
  }

  return {
    day: stakes.day,
    level: stakes.level,
    title: stakes.title,
    text: stakes.text,
    reasons: stakes.reasons,
    tags: stakes.tags
  };
}

function capitalize(text) {
  if (!text) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
