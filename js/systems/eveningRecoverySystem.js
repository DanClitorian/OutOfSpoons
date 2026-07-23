// eveningRecoverySystem.js
//
// v0.9: applies one evening recovery choice before the next day starts.
// This system mutates the existing game state in place.
// It does not create a new save version.
//
// v0.51: Contextual Evening Recovery. Wieczór przestaje być stałym menu
// 5 podobnych opcji regeneracji:
//   - pula rozszerzona do 17 opcji (data/eveningRecoveryData.js),
//   - getEveningRecoveryOptions(state) zwraca 3-4 opcje DOBRANE do
//     stanu dnia (deklaratywne gates + kontekstowe boosts priorytetu),
//   - "sleep-early" jest gwarantowaną bezpieczną opcją minimum —
//     ZAWSZE obecna, zero ryzyka softlocka,
//   - dobór jest DETERMINISTYCZNY (zero losowania) — odświeżenie
//     ekranu wieczoru pokazuje dokładnie te same karty,
//   - applyEveningRecovery obsługuje nowe pola efektów (fatigue /
//     maskingDebt / workPressure / static) DEFENSYWNIE — stare zapisy
//     bez tych struktur po prostu pomijają dany efekt,
//   - buildEveningFrameLine(state): jedna linia narracji zależna od
//     stanu (spójna konwencja z buildMorningFrameLine z v0.50).
//
// Publiczne API jest wstecznie zgodne: getEveningRecoveryOptions(state)
// i applyEveningRecovery(optionId, state) mają te same sygnatury co od
// v0.9 (eveningScreen.js woła je tak samo). NIE dotyka fatigue v0.49:
// rozliczenie nocy (updateFatigueAfterDay + applyMorningSpoonsFromFatigue)
// dzieje się w dayCycle.advanceToNextDay PO tej decyzji, bez zmian.
//
// Wzorce (patternSystem v0.22) działają dla nowych opcji automatycznie:
// recordPatternFromEveningRecovery używa nie tylko jawnej mapy 5
// starych id, ale też deriveTags z efektów i tekstów — teksty i efekty
// puli są pisane świadomie pod te heurystyki (zero zmian w
// patternSystem.js).

import { eveningRecoveryOptions } from "../data/eveningRecoveryData.js?v=510";
import { getCurrentWeeklyChallenge, getWeeklyChallengeCountdown } from "./weeklyChallengeSystem.js?v=601";
import { getCurrentCriticalEvent, getCriticalEventCountdown } from "./criticalEventSystem.js?v=601";

// Ile opcji pokazuje wieczór. Pula ma 17 pozycji — gracz widzi wycinek
// dobrany do dnia, nigdy całość.
const EVENING_OPTIONS_LIMIT = 4;
const SAFE_OPTION_ID = "sleep-early";

const CONFLICT_ORDER = ["calm", "strained", "volatile", "critical", "fight"];

// --------------------------------------------------------------------
// Kontekst dnia — wszystkie odczyty stanu w jednym miejscu, defensywnie
// (stare zapisy mogą nie mieć części struktur).
// --------------------------------------------------------------------

function buildEveningContext(state) {
  const spoons = state.resources && state.resources.spoons ? state.resources.spoons : {};
  const fatigue = state.resources && state.resources.fatigue ? state.resources.fatigue : {};
  const player = state.player || {};
  const work = player.work || {};
  const staticState = player.static || {};
  const maskingDebt = player.maskingDebt || {};

  const partner = state.partner || null;
  const npc = partner && state.npcs ? state.npcs[partner.id] : null;
  const conflict = partner && partner.conflict ? partner.conflict : null;
  const metamour = partner && partner.metamour ? partner.metamour : null;

  const weeklyDaysLeft = getCurrentWeeklyChallenge(state)
    ? getWeeklyChallengeCountdown(state)
    : null;
  const criticalDaysLeft = getCurrentCriticalEvent(state)
    ? getCriticalEventCountdown(state)
    : null;

  return {
    hasPartner: Boolean(partner && npc),
    spoons: Number(spoons.current) || 0,
    fatigue: Number(fatigue.current) || 0,
    workPressure: Number(work.pressure) || 0,
    staticIntensity: Number(staticState.intensity) || 0,
    maskingDebt: Number(maskingDebt.current) || 0,
    trust: npc && typeof npc.trust === "number" ? npc.trust : null,
    frustration: npc && typeof npc.frustration === "number" ? npc.frustration : 0,
    conflictState: conflict && CONFLICT_ORDER.includes(conflict.state) ? conflict.state : "calm",
    metamourTension: metamour && typeof metamour.tension === "number" ? metamour.tension : 0,
    weeklyDaysLeft,
    criticalDaysLeft
  };
}

// --------------------------------------------------------------------
// Deklaratywne warunki (gate/boost.when) — wszystkie pola opcjonalne,
// łączone AND. Nowe warunki dodaje się TU + w danych, bez ruszania
// reszty systemu.
// --------------------------------------------------------------------

function matchesCondition(condition, ctx) {
  if (!condition) {
    return true;
  }

  if (condition.partnerRequired && !ctx.hasPartner) {
    return false;
  }

  if (typeof condition.maxSpoons === "number" && ctx.spoons > condition.maxSpoons) {
    return false;
  }

  if (typeof condition.minFatigue === "number" && ctx.fatigue < condition.minFatigue) {
    return false;
  }

  if (typeof condition.minWorkPressure === "number" && ctx.workPressure < condition.minWorkPressure) {
    return false;
  }

  if (typeof condition.minStatic === "number" && ctx.staticIntensity < condition.minStatic) {
    return false;
  }

  if (typeof condition.minMaskingDebt === "number" && ctx.maskingDebt < condition.minMaskingDebt) {
    return false;
  }

  if (typeof condition.minFrustration === "number" && ctx.frustration < condition.minFrustration) {
    return false;
  }

  if (typeof condition.maxTrust === "number") {
    if (ctx.trust === null || ctx.trust > condition.maxTrust) {
      return false;
    }
  }

  if (typeof condition.minMetamourTension === "number" && ctx.metamourTension < condition.minMetamourTension) {
    return false;
  }

  if (condition.conflictAtLeast) {
    const required = CONFLICT_ORDER.indexOf(condition.conflictAtLeast);
    const actual = CONFLICT_ORDER.indexOf(ctx.conflictState);
    if (required === -1 || actual < required) {
      return false;
    }
  }

  if (typeof condition.criticalWithinDays === "number") {
    if (typeof ctx.criticalDaysLeft !== "number" || ctx.criticalDaysLeft > condition.criticalWithinDays) {
      return false;
    }
  }

  if (typeof condition.weeklyWithinDays === "number") {
    if (typeof ctx.weeklyDaysLeft !== "number" || ctx.weeklyDaysLeft > condition.weeklyWithinDays) {
      return false;
    }
  }

  return true;
}

function scoreOption(option, ctx) {
  let score = Number(option.base) || 0;

  (option.boosts || []).forEach((boost) => {
    if (matchesCondition(boost.when, ctx)) {
      score += Number(boost.add) || 0;
    }
  });

  return score;
}

// --------------------------------------------------------------------
// Dobór opcji: filtr gate -> scoring -> sort (stabilny) -> preferencja
// różnorodności typów -> limit 3-4 -> gwarancja bezpiecznej opcji.
// --------------------------------------------------------------------

export function getEveningRecoveryOptions(state) {
  const ctx = buildEveningContext(state);

  const available = eveningRecoveryOptions
    .filter((option) => matchesCondition(option.gate, ctx))
    .map((option) => ({ option, score: scoreOption(option, ctx) }))
    .sort((a, b) => b.score - a.score);

  // Przebieg 1: bierz od najwyższego score, ale max 1 opcja danego TYPU
  // — wieczór ma pokazywać różne odpowiedzi na dzień, nie trzy warianty
  // odpoczynku obok siebie.
  const picked = [];
  const usedTypes = new Set();

  for (const entry of available) {
    if (picked.length >= EVENING_OPTIONS_LIMIT) {
      break;
    }
    if (usedTypes.has(entry.option.type)) {
      continue;
    }
    picked.push(entry);
    usedTypes.add(entry.option.type);
  }

  // Przebieg 2: gdyby różnorodność typów nie wypełniła limitu (mała
  // pula dostępna), dobierz kolejne wg score bez ograniczenia typu.
  if (picked.length < Math.min(3, available.length)) {
    for (const entry of available) {
      if (picked.length >= EVENING_OPTIONS_LIMIT) {
        break;
      }
      if (!picked.includes(entry)) {
        picked.push(entry);
      }
    }
  }

  // Gwarancja braku softlocka: bezpieczna opcja odpoczynku ZAWSZE jest
  // na liście. Jeśli kontekst jej nie wybrał, zastępuje najsłabszą.
  const hasSafeOption = picked.some((entry) => entry.option.id === SAFE_OPTION_ID);
  if (!hasSafeOption) {
    const safeEntry = available.find((entry) => entry.option.id === SAFE_OPTION_ID);
    if (safeEntry) {
      if (picked.length >= EVENING_OPTIONS_LIMIT) {
        picked.pop();
      }
      picked.push(safeEntry);
    }
  }

  return picked.map((entry) => entry.option);
}

// --------------------------------------------------------------------
// Zastosowanie wybranej opcji. optionId szukany w PEŁNEJ puli (nie w
// dzisiejszym doborze) — odporność na każdy scenariusz kliknięcia.
// --------------------------------------------------------------------

export function applyEveningRecovery(optionId, state) {
  const option = eveningRecoveryOptions.find((item) => item.id === optionId);

  if (!option) {
    throw new Error(`Nieznana opcja wieczoru: ${optionId}`);
  }

  const resolvedOption = resolveOption(option, state);
  const effects = resolvedOption.effects;

  applySpoonsChange(state, effects.spoonsChange);
  applyRelationshipChange(state, effects.trustChange, effects.frustrationChange);
  // v0.51: nowe, defensywne appliery — każdy sam sprawdza, czy dana
  // struktura stanu istnieje (stare zapisy), i clampuje do zakresu.
  applyFatigueChange(state, effects.fatigueChange);
  applyMaskingDebtChange(state, effects.maskingDebtChange);
  applyWorkPressureChange(state, effects.workPressureChange);
  applyStaticChange(state, effects.staticChange);
  applyMetamourTensionChange(state, effects.metamourTensionChange);

  state.lastEveningRecovery = {
    optionId: resolvedOption.id,
    type: resolvedOption.type,
    label: resolvedOption.label,
    description: resolvedOption.description,
    effects: { ...effects },
    day: state.day
  };

  return resolvedOption;
}

// --------------------------------------------------------------------
// Linia ramująca wieczoru — jedna, zależna od stanu (konwencja v0.50).
// --------------------------------------------------------------------

export function buildEveningFrameLine(state) {
  const ctx = buildEveningContext(state);

  if (ctx.spoons <= 0) {
    return "Wieczór nie pyta, co jeszcze zrobisz. Pyta, co przestaniesz nieść.";
  }

  if (ctx.fatigue >= 4) {
    return "Ciało składa dziś wniosek o zawieszenie działalności. Można go rozpatrzyć albo odrzucić.";
  }

  if (ctx.conflictState === "critical" || ctx.conflictState === "fight" || ctx.frustration >= 60) {
    return "W pokoju jest cisza, ale nie jest neutralna.";
  }

  if (ctx.workPressure >= 60) {
    return "Praca nie skończyła się z końcem pracy.";
  }

  return "Dzień zostawił po sobie kilka luźnych nitek. Nie wszystkie trzeba dziś zawiązać.";
}

// --------------------------------------------------------------------
// Appliery efektów
// --------------------------------------------------------------------

function resolveOption(option, state) {
  return {
    ...option,
    label: replacePlaceholders(option.label, state),
    description: replacePlaceholders(option.description, state),
    effects: {
      spoonsChange: Number(option.effects.spoonsChange) || 0,
      trustChange: Number(option.effects.trustChange) || 0,
      frustrationChange: Number(option.effects.frustrationChange) || 0,
      fatigueChange: Number(option.effects.fatigueChange) || 0,
      maskingDebtChange: Number(option.effects.maskingDebtChange) || 0,
      workPressureChange: Number(option.effects.workPressureChange) || 0,
      staticChange: Number(option.effects.staticChange) || 0,
      metamourTensionChange: Number(option.effects.metamourTensionChange) || 0
    }
  };
}

function applySpoonsChange(state, delta) {
  if (!delta || !state.resources || !state.resources.spoons) {
    return;
  }

  const spoons = state.resources.spoons;
  const max = Number(spoons.max) || 10;
  const current = Number(spoons.current) || 0;

  // NIGDY nie resetuje do max — zwykły, clampowany przyrost/koszt.
  spoons.current = clamp(current + delta, 0, max);
}

function applyRelationshipChange(state, trustChange, frustrationChange) {
  if (!state.partner || !state.npcs) {
    return;
  }

  const npc = state.npcs[state.partner.id];

  if (!npc) {
    return;
  }

  if (trustChange && typeof npc.trust === "number") {
    npc.trust = clamp(npc.trust + trustChange, 0, 100);
  }

  if (frustrationChange && typeof npc.frustration === "number") {
    npc.frustration = clamp(npc.frustration + frustrationChange, 0, 100);
  }
}

function applyFatigueChange(state, delta) {
  if (!delta || !state.resources || !state.resources.fatigue) {
    return;
  }

  const fatigue = state.resources.fatigue;
  const max = Number(fatigue.max) || 6;
  fatigue.current = clamp((Number(fatigue.current) || 0) + delta, 0, max);
  fatigue.lastChange = delta;
  fatigue.lastReason = "evening-recovery";
}

function applyMaskingDebtChange(state, delta) {
  if (!delta || !state.player || !state.player.maskingDebt) {
    return;
  }

  const debt = state.player.maskingDebt;
  const max = Number(debt.max) || 6;
  debt.current = clamp((Number(debt.current) || 0) + delta, 0, max);
}

function applyWorkPressureChange(state, delta) {
  if (!delta || !state.player || !state.player.work) {
    return;
  }

  const work = state.player.work;
  work.pressure = clamp((Number(work.pressure) || 0) + delta, 0, 100);
}

function applyMetamourTensionChange(state, delta) {
  if (!delta || !state.partner || !state.partner.metamour) {
    return;
  }

  const metamour = state.partner.metamour;
  if (typeof metamour.tension === "number") {
    metamour.tension = clamp(metamour.tension + delta, 0, 100);
  }
}

function applyStaticChange(state, delta) {
  if (!delta || !state.player || !state.player.static) {
    return;
  }

  const staticState = state.player.static;
  staticState.intensity = clamp((Number(staticState.intensity) || 0) + delta, 0, 3);
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  const metamourName = state.partner && state.partner.metamour && state.partner.metamour.name
    ? state.partner.metamour.name
    : "ta druga osoba";

  return text
    .replace(/\{partnerName\}/g, partnerName)
    .replace(/\{metamourName\}/g, metamourName);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}
