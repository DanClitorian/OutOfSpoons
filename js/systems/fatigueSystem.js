// fatigueSystem.js
//
// Hotfix v0.8.1: fatigue carryover.
//
// Spoons should not behave like a fully reset daily wallet.
// If the player ends the day depleted, the next morning starts with fewer
// available spoons. If the player keeps some capacity, fatigue can go down.

const MAX_FATIGUE = 6;
const MIN_MORNING_SPOONS = 1;

export function ensureFatigueState(state) {
  if (!state.resources) {
    state.resources = {};
  }

  if (!state.resources.fatigue || typeof state.resources.fatigue !== "object") {
    state.resources.fatigue = {
      current: 0,
      max: MAX_FATIGUE,
      lastChange: 0,
      lastReason: "init"
    };
  }

  state.resources.fatigue.max = MAX_FATIGUE;
  state.resources.fatigue.current = clamp(state.resources.fatigue.current, 0, MAX_FATIGUE);

  if (typeof state.resources.fatigue.lastChange !== "number") {
    state.resources.fatigue.lastChange = 0;
  }

  if (!state.resources.fatigue.lastReason) {
    state.resources.fatigue.lastReason = "init";
  }

  return state.resources.fatigue;
}

export function addFatigueDebt(state, missingSpoons) {
  const fatigue = ensureFatigueState(state);
  const debt = Math.max(0, Math.ceil(Number(missingSpoons) || 0));

  if (debt <= 0) {
    return 0;
  }

  fatigue.current = clamp(fatigue.current + debt, 0, fatigue.max);
  fatigue.lastChange = debt;
  fatigue.lastReason = "forced-choice";

  return debt;
}

export function updateFatigueAfterDay(state) {
  const fatigue = ensureFatigueState(state);
  const spoons = state.resources.spoons;

  const current = Number(spoons.current) || 0;
  const max = Number(spoons.max) || 10;

  let change = 0;
  let reason = "steady";

  if (current <= 0) {
    change = 2;
    reason = "ended-empty";
  } else if (current <= Math.ceil(max * 0.25)) {
    change = 1;
    reason = "ended-low";
  } else if (current >= Math.ceil(max * 0.5)) {
    change = -1;
    reason = "ended-with-reserve";
  }

  fatigue.current = clamp(fatigue.current + change, 0, fatigue.max);
  fatigue.lastChange = change;
  fatigue.lastReason = reason;

  return change;
}

export function applyMorningSpoonsFromFatigue(state) {
  const fatigue = ensureFatigueState(state);
  const spoons = state.resources.spoons;

  const max = Number(spoons.max) || 10;
  const available = Math.max(MIN_MORNING_SPOONS, max - fatigue.current);

  spoons.current = clamp(available, MIN_MORNING_SPOONS, max);

  return spoons.current;
}

export function getFatigueLabel(state) {
  const fatigue = ensureFatigueState(state);

  if (fatigue.current <= 0) {
    return "Brak przeciążenia";
  }

  if (fatigue.current <= 2) {
    return "Lekkie przeciążenie";
  }

  if (fatigue.current <= 4) {
    return "Narastające przeciążenie";
  }

  return "Wysokie przeciążenie";
}

export function getFatigueDescription(state) {
  const fatigue = ensureFatigueState(state);

  if (fatigue.current <= 0) {
    return "Jutro zaczynasz z pełną pojemnością.";
  }

  return `Jutro poranek zacznie się z mniejszą liczbą spoons: −${fatigue.current}.`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}
