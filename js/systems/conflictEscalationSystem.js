// conflictEscalationSystem.js
//
// v0.35: Conflict Escalation Foundation.
//
// Fundament narastania konfliktu w relacji. Kłótnia nie bierze się z
// jednego złego kliknięcia, tylko z sumy napięcia, unikania,
// przeciążenia, niskiego zaufania, wysokiej frustracji, blizn
// relacyjnych i kosztów maskowania.
//
// To NIE jest jeszcze system rozstania ani game over. Stan "fight"
// oznacza poważną kłótnię / kryzys relacyjny, ale w v0.35 nie kończy
// gry. Przyszły system end-state będzie mógł ten stan odczytać.
//
// Ten moduł:
// - NIE zmienia spoons,
// - NIE zmienia trust,
// - NIE zmienia frustration,
// - NIE blokuje wyborów,
// - NIE renderuje UI,
// - zapisuje wyłącznie stan state.partner.conflict oraz efekt do logu.

const MAX_HISTORY = 40;

const STATES = ["calm", "strained", "volatile", "critical", "fight"];

const MORNING_LINES = {
  strained: [
    "Coś w tej relacji jest dziś napięte, nawet jeśli nikt jeszcze tego nie nazwał.",
    "Dzień zaczyna się tak, jakby w pokoju została wczorajsza rozmowa."
  ],
  volatile: [
    "Dziś nawet zwykłe zdanie może zabrzmieć jak zarzut.",
    "Relacja jest dziś bliżej krawędzi niż wczoraj."
  ],
  critical: [
    "Relacja jest blisko miejsca, w którym rozmowy przestają być rozmowami.",
    "Wystarczy niewiele, żeby napięcie przejęło głos."
  ],
  fight: [
    "Po ostatniej kłótni cisza nie jest odpoczynkiem. Jest śladem.",
    "Coś pękło i nadal układa się w pokoju."
  ]
};

const REFLECTION_LINES = {
  pressure: [
    "To nie wybuchło jeszcze. Ale coś się przesunęło.",
    "Ta odpowiedź nie była końcem rozmowy. Była początkiem napięcia.",
    "Cisza nie załatwiła sprawy. Tylko przeniosła ją dalej."
  ],
  relief: [
    "To nie naprawiło wszystkiego. Ale zdjęło jeden kamień ze stołu.",
    "Napięcie nie zniknęło. Przestało na chwilę prowadzić rozmowę."
  ],
  fight: [
    "To już nie była wymiana zdań. To był moment, w którym napięcie przejęło rozmowę.",
    "Nie chodziło tylko o to zdanie. Ono po prostu przyszło ostatnie."
  ]
};

export function ensureConflictEscalationState(state) {
  if (!state || !state.partner) {
    return null;
  }

  if (!state.partner.conflict) {
    state.partner.conflict = {
      current: 0,
      volatility: 0,
      state: "calm",
      lastEvaluatedDay: null,
      lastConflictDay: null,
      lastConflictEvent: null,
      history: []
    };
  }

  if (!Array.isArray(state.partner.conflict.history)) {
    state.partner.conflict.history = [];
  }

  if (!STATES.includes(state.partner.conflict.state)) {
    state.partner.conflict.state = "calm";
  }

  state.partner.conflict.current = clampNumber(state.partner.conflict.current, 0, 12);
  state.partner.conflict.volatility = clampNumber(state.partner.conflict.volatility, 0, 12);

  return state.partner.conflict;
}

export function calculateConflictPressure(state) {
  const reasons = [];
  let score = 0;

  const partnerStats = getPartnerStats(state);
  const trust = partnerStats ? Number(partnerStats.trust) : null;
  const frustration = partnerStats ? Number(partnerStats.frustration) : null;

  if (Number.isFinite(frustration) && frustration >= 60) {
    score += 2;
    reasons.push("frustration-high");
  }

  if (Number.isFinite(frustration) && frustration >= 75) {
    score += 1;
    reasons.push("frustration-very-high");
  }

  if (Number.isFinite(trust) && trust <= 40) {
    score += 2;
    reasons.push("trust-low");
  }

  if (Number.isFinite(trust) && trust <= 25) {
    score += 1;
    reasons.push("trust-very-low");
  }

  const scars = getActiveScars(state);
  if (scars.length === 1) {
    score += 1;
    reasons.push("relationship-scar");
  } else if (scars.length > 1 || scars.some((scar) => Number(scar.intensity) >= 2)) {
    score += 2;
    reasons.push("relationship-scars");
  }

  const activePatterns = getActivePatternIds(state);
  for (const patternId of ["avoidance", "people-pleasing", "overextension"]) {
    if (activePatterns.includes(patternId)) {
      score += 1;
      reasons.push(`pattern-${patternId}`);
    }
  }

  const maskingDebt = state && state.player && state.player.maskingDebt ? Number(state.player.maskingDebt.current) : 0;
  if (maskingDebt >= 3) {
    score += 1;
    reasons.push("masking-debt");
  }
  if (maskingDebt >= 5) {
    score += 1;
    reasons.push("masking-debt-heavy");
  }

  const capacityMood = state && state.partner && state.partner.capacity ? state.partner.capacity.mood : null;
  if (capacityMood === "overloaded" || capacityMood === "distant") {
    score += 1;
    reasons.push("partner-capacity-low");
  }

  const relationshipModel = state ? state.relationshipModel : null;
  if (relationshipModel && (relationshipModel.type === "ambiguous" || Number(relationshipModel.clarity) < 45)) {
    score += 1;
    reasons.push("relationship-model-unclear");
  }

  if (hadRecentCriticalFailure(state)) {
    score += 1;
    reasons.push("recent-critical-failure");
  }

  const work = state && state.player ? state.player.work : null;
  if (work && (Number(work.pressure) >= 70 || Number(work.burnout) >= 65)) {
    score += 1;
    reasons.push("work-pressure");
  }

  return {
    score,
    reasons,
    suggestedState: stateFromScore(score)
  };
}

export function evaluateDailyConflictState(state) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict) {
    return null;
  }

  if (conflict.lastEvaluatedDay === state.day) {
    return conflict;
  }

  const pressure = calculateConflictPressure(state);
  const suggestedState = pressure.suggestedState;

  conflict.current = clampNumber(pressure.score, 0, 12);
  conflict.volatility = clampNumber(Math.max(pressure.score, conflict.volatility - 1), 0, 12);

  if (conflict.state === "fight" && conflict.lastConflictDay && state.day - conflict.lastConflictDay <= 1) {
    conflict.state = "fight";
  } else {
    conflict.state = suggestedState;
  }

  conflict.lastEvaluatedDay = state.day;
  conflict.history.push({
    day: state.day,
    source: "morning-evaluation",
    score: pressure.score,
    state: conflict.state,
    reasons: pressure.reasons
  });
  cleanupHistory(conflict);

  return conflict;
}

export function applyConflictPressureFromChoice(state, event, choice, context = {}) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict || !choice) {
    return { applied: false, delta: 0, stateAfter: null, triggeredFight: false, note: null };
  }

  const before = conflict.current;
  let delta = 0;
  const reasons = [];

  const frustrationChange = Number(choice.frustrationChange || 0);
  const effectiveTrustChange = Number(context.effectiveTrustChange || choice.trustChange || 0);

  if (frustrationChange >= 3) {
    delta += 2;
    reasons.push("frustration-choice");
  } else if (frustrationChange > 0) {
    delta += 1;
    reasons.push("minor-frustration-choice");
  }

  if (effectiveTrustChange <= -2) {
    delta += 2;
    reasons.push("trust-drop");
  } else if (effectiveTrustChange < 0) {
    delta += 1;
    reasons.push("minor-trust-drop");
  }

  const tags = Array.isArray(event && event.tags) ? event.tags : [];
  if (tags.includes("avoidance")) {
    delta += 1;
    reasons.push("avoidance-event");
  }

  if (tags.includes("tension")) {
    delta += 1;
    reasons.push("tension-event");
  }

  if (context.maskingDebtResult && context.maskingDebtResult.applied) {
    delta += 1;
    reasons.push("masking-choice");
  }

  if (context.scarResult && context.scarResult.applied) {
    delta += 1;
    reasons.push("scar-reactivated");
  }

  if (context.repairResult && context.repairResult.applied) {
    delta -= context.repairResult.resolved ? 2 : 1;
    reasons.push(context.repairResult.resolved ? "repair-resolved" : "repair-applied");
  }

  if ((tags.includes("repair") || tags.includes("repair-event")) && effectiveTrustChange > 0) {
    delta -= 1;
    reasons.push("repair-tone");
  }

  if (delta === 0) {
    return { applied: false, delta: 0, stateAfter: conflict.state, triggeredFight: false, note: null };
  }

  conflict.current = clampNumber(conflict.current + delta, 0, 12);
  conflict.volatility = clampNumber(conflict.volatility + Math.max(delta, 0), 0, 12);

  let stateAfter = stateFromScore(conflict.current);
  let triggeredFight = false;

  if (
    state.day > 3 &&
    delta > 0 &&
    conflict.lastConflictDay !== state.day &&
    (conflict.state === "critical" || conflict.current >= 8)
  ) {
    stateAfter = "fight";
    triggeredFight = true;
    conflict.lastConflictDay = state.day;
    conflict.lastConflictEvent = {
      eventId: event ? event.id : null,
      choiceId: choice ? choice.id : null,
      reason: reasons.join(", ") || "choice-pressure"
    };
  }

  conflict.state = stateAfter;

  const note = triggeredFight
    ? pickRandom(REFLECTION_LINES.fight)
    : delta > 0
      ? pickRandom(REFLECTION_LINES.pressure)
      : pickRandom(REFLECTION_LINES.relief);

  conflict.history.push({
    day: state.day,
    source: "choice",
    eventId: event ? event.id : null,
    choiceId: choice ? choice.id : null,
    delta,
    before,
    after: conflict.current,
    stateAfter,
    triggeredFight,
    reasons
  });
  cleanupHistory(conflict);

  return {
    applied: true,
    delta,
    stateAfter,
    triggeredFight,
    note
  };
}

export function buildMorningConflictLine(state) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict || conflict.state === "calm") {
    return null;
  }

  const lines = MORNING_LINES[conflict.state];
  if (!lines) {
    return null;
  }

  return pickRandom(lines);
}

export function buildReflectionConflictLine(state, lastLogEntry) {
  if (!lastLogEntry || !lastLogEntry.conflictEffect || !lastLogEntry.conflictEffect.applied) {
    return null;
  }

  return lastLogEntry.conflictEffect.note || null;
}

export function buildWeeklyConflictNote(state) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict) {
    return null;
  }

  const startDay = Math.max(1, state.day - 7);
  const recent = conflict.history.filter((entry) => entry.day >= startDay);
  const hadHigh = recent.some((entry) => entry.state === "volatile" || entry.state === "critical" || entry.stateAfter === "fight");

  if (!hadHigh && conflict.state !== "fight" && conflict.state !== "critical" && conflict.state !== "volatile") {
    return null;
  }

  if (conflict.state === "fight") {
    return "W tym tygodniu relacja nie tylko była napięta. Ona już o coś zahaczyła.";
  }

  return "W tym tygodniu relacja częściej przypominała pole minowe niż miejsce odpoczynku.";
}

export function getConflictDebugSummary(state) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict) {
    return null;
  }

  return {
    current: conflict.current,
    volatility: conflict.volatility,
    state: conflict.state,
    lastEvaluatedDay: conflict.lastEvaluatedDay,
    lastConflictDay: conflict.lastConflictDay,
    lastConflictEvent: conflict.lastConflictEvent,
    pressure: calculateConflictPressure(state),
    recentHistory: conflict.history.slice(-10)
  };
}

export function setConflictHigh(state) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict) {
    return null;
  }

  conflict.current = 8;
  conflict.volatility = 8;
  conflict.state = "critical";
  conflict.history.push({
    day: state.day,
    source: "devtools-set-high",
    state: conflict.state,
    current: conflict.current,
    volatility: conflict.volatility
  });
  cleanupHistory(conflict);
  return conflict;
}

export function triggerConflictFight(state) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict) {
    return null;
  }

  conflict.current = Math.max(conflict.current, 9);
  conflict.volatility = Math.max(conflict.volatility, 9);
  conflict.state = "fight";
  conflict.lastConflictDay = state.day;
  conflict.lastConflictEvent = {
    eventId: null,
    choiceId: null,
    reason: "devtools"
  };
  conflict.history.push({
    day: state.day,
    source: "devtools-trigger-fight",
    state: "fight"
  });
  cleanupHistory(conflict);
  return conflict;
}

export function clearConflict(state) {
  const conflict = ensureConflictEscalationState(state);
  if (!conflict) {
    return null;
  }

  conflict.current = 0;
  conflict.volatility = 0;
  conflict.state = "calm";
  conflict.lastEvaluatedDay = null;
  conflict.lastConflictDay = null;
  conflict.lastConflictEvent = null;
  conflict.history.push({
    day: state.day,
    source: "devtools-clear",
    state: "calm"
  });
  cleanupHistory(conflict);
  return conflict;
}

function stateFromScore(score) {
  if (score <= 2) {
    return "calm";
  }

  if (score <= 4) {
    return "strained";
  }

  if (score <= 6) {
    return "volatile";
  }

  return "critical";
}

function getPartnerStats(state) {
  if (!state || !state.partner) {
    return null;
  }

  const partnerId = state.partner.id;
  if (state.npcs && partnerId && state.npcs[partnerId]) {
    return state.npcs[partnerId];
  }

  return state.partner;
}

function getActiveScars(state) {
  const scars = state && state.partner && Array.isArray(state.partner.scars) ? state.partner.scars : [];
  return scars.filter((scar) => !scar.resolved && Number(scar.intensity || 0) > 0);
}

function getActivePatternIds(state) {
  const active = state && state.patterns && Array.isArray(state.patterns.active) ? state.patterns.active : [];
  return active
    .map((pattern) => pattern.id || pattern.patternId || pattern.key)
    .filter(Boolean);
}

function hadRecentCriticalFailure(state) {
  const result = state && state.criticalEvent ? state.criticalEvent.lastResult : null;
  if (!result) {
    return false;
  }

  const resultDay = Number(result.completedDay || result.day || result.dueDay || 0);
  const isRecent = resultDay > 0 && state.day - resultDay <= 7;
  const failed =
    result.outcome === "failure" ||
    result.result === "failure" ||
    result.success === false ||
    result.failed === true;

  return isRecent && failed;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanupHistory(conflict) {
  if (conflict.history.length > MAX_HISTORY) {
    conflict.history = conflict.history.slice(conflict.history.length - MAX_HISTORY);
  }
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
