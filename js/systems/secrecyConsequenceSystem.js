// secrecyConsequenceSystem.js
//
// v0.38: Secrecy & Boundary Consequences.
//
// Ten system NIE karze za samą fascynację. Śledzi koszt sekretu,
// ukrywania i potencjalnego przekroczenia ustaleń relacyjnych.
// W poliamorii romans/fascynacja nie jest automatycznie zdradą.
// Problemem staje się sekret, brak pytania, złamanie ustaleń albo
// odebranie partnerowi możliwości świadomej decyzji.
//
// Większość efektów jest wewnętrzna: rośnie current/suspicion.
// Trust/frustration zmieniają się dopiero, gdy sekret zostanie
// zauważony przez system albo gdy gracz decyduje się coś ujawnić.

const MAX_HISTORY = 40;

const NOTES = {
  hidden: [
    "Sekret nie zrobił sceny. Po prostu został w pokoju.",
    "To jeszcze nie wybuchło. Ale pojawiła się rzecz, którą trzeba teraz nosić."
  ],
  noticed: [
    "Nie wszystko trzeba powiedzieć, żeby druga osoba poczuła zmianę temperatury.",
    "Coś w Twoim tonie nie pasowało do reszty dnia."
  ],
  disclosed: [
    "Prawda nie zrobiła się lekka. Ale przestała być samotna.",
    "To nie rozwiązało wszystkiego. Zdjęło tylko z kłamstwa obowiązek trzymania całości."
  ],
  cleared: [
    "Sekret nie zniknął magicznie. Ale przestał prowadzić rozmowę z ukrycia."
  ]
};

export function ensureSecrecyConsequenceState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.player.secrecy) {
    state.player.secrecy = {
      current: 0,
      suspicion: 0,
      breachRisk: "none",
      lastAppliedDay: null,
      lastDiscoveryDay: null,
      lastEffect: null,
      history: []
    };
  }

  if (!Array.isArray(state.player.secrecy.history)) {
    state.player.secrecy.history = [];
  }

  state.player.secrecy.current = clamp(state.player.secrecy.current, 0, 10);
  state.player.secrecy.suspicion = clamp(state.player.secrecy.suspicion, 0, 10);

  return state.player.secrecy;
}

export function applySecrecyConsequenceFromChoice(state, event, choice, context = {}) {
  const romanceResult = context.romanceResult || null;

  if (!romanceResult || !romanceResult.applied) {
    return { applied: false, trustChange: 0, frustrationChange: 0 };
  }

  const secrecy = ensureSecrecyConsequenceState(state);
  if (!secrecy) {
    return { applied: false, trustChange: 0, frustrationChange: 0 };
  }

  const classification = romanceResult.classification || {};
  const disclosed = romanceResult.disclosed === true;
  const severity = classification.severity || "none";
  const isPotentialBreach = classification.isPotentialBreach === true;

  let currentDelta = 0;
  let suspicionDelta = 0;
  let trustChange = 0;
  let frustrationChange = 0;
  let discovered = false;
  let noteKind = "hidden";

  if (disclosed) {
    currentDelta -= 2;
    suspicionDelta -= 1;
    noteKind = "disclosed";

    if (!isPotentialBreach) {
      trustChange += 1;
    } else if (severity === "low") {
      frustrationChange += 1;
    }
  } else {
    currentDelta += severityToCurrentDelta(severity, isPotentialBreach);
    suspicionDelta += severityToSuspicionDelta(severity, isPotentialBreach);
    noteKind = "hidden";
  }

  secrecy.current = clamp(secrecy.current + currentDelta, 0, 10);
  secrecy.suspicion = clamp(secrecy.suspicion + suspicionDelta, 0, 10);
  secrecy.breachRisk = deriveBreachRisk(secrecy, severity, isPotentialBreach);
  secrecy.lastAppliedDay = state.day;

  if (!disclosed && state.day > 4 && secrecy.lastDiscoveryDay !== state.day) {
    const discoveryThreshold = isPotentialBreach ? 7 : 9;
    if (secrecy.current + secrecy.suspicion >= discoveryThreshold) {
      discovered = true;
      noteKind = "noticed";
      secrecy.lastDiscoveryDay = state.day;
      trustChange -= severity === "high" ? 3 : 2;
      frustrationChange += severity === "high" ? 4 : 2;
    }
  }

  const note = pickRandom(NOTES[noteKind] || NOTES.hidden);

  const effect = {
    applied: true,
    currentDelta,
    suspicionDelta,
    currentAfter: secrecy.current,
    suspicionAfter: secrecy.suspicion,
    breachRisk: secrecy.breachRisk,
    discovered,
    trustChange,
    frustrationChange,
    note
  };

  secrecy.lastEffect = {
    day: state.day,
    discovered,
    breachRisk: secrecy.breachRisk,
    note
  };

  secrecy.history.push({
    day: state.day,
    eventId: event ? event.id : null,
    choiceId: choice ? choice.id : null,
    disclosed,
    severity,
    isPotentialBreach,
    currentAfter: secrecy.current,
    suspicionAfter: secrecy.suspicion,
    breachRisk: secrecy.breachRisk,
    discovered,
    trustChange,
    frustrationChange,
    note
  });
  cleanupHistory(secrecy);

  return effect;
}

export function triggerSecrecyDiscovery(state) {
  const secrecy = ensureSecrecyConsequenceState(state);
  if (!secrecy) {
    return null;
  }

  secrecy.current = Math.max(secrecy.current, 7);
  secrecy.suspicion = Math.max(secrecy.suspicion, 7);
  secrecy.breachRisk = "high";
  secrecy.lastDiscoveryDay = state.day;
  const note = pickRandom(NOTES.noticed);

  secrecy.lastEffect = {
    day: state.day,
    discovered: true,
    breachRisk: secrecy.breachRisk,
    note
  };

  secrecy.history.push({
    day: state.day,
    source: "devtools-discovery",
    currentAfter: secrecy.current,
    suspicionAfter: secrecy.suspicion,
    breachRisk: secrecy.breachRisk,
    discovered: true,
    note
  });
  cleanupHistory(secrecy);

  return secrecy;
}

export function buildReflectionSecrecyLine(state, lastLogEntry) {
  if (!lastLogEntry || !lastLogEntry.secrecyEffect || !lastLogEntry.secrecyEffect.applied) {
    return null;
  }

  return lastLogEntry.secrecyEffect.note || null;
}

export function getSecrecyDebugSummary(state) {
  const secrecy = ensureSecrecyConsequenceState(state);
  if (!secrecy) {
    return null;
  }

  return {
    current: secrecy.current,
    suspicion: secrecy.suspicion,
    breachRisk: secrecy.breachRisk,
    lastAppliedDay: secrecy.lastAppliedDay,
    lastDiscoveryDay: secrecy.lastDiscoveryDay,
    lastEffect: secrecy.lastEffect,
    recentHistory: secrecy.history.slice(-10)
  };
}

export function setSecrecyHigh(state) {
  const secrecy = ensureSecrecyConsequenceState(state);
  if (!secrecy) {
    return null;
  }

  secrecy.current = 8;
  secrecy.suspicion = 7;
  secrecy.breachRisk = "high";
  secrecy.lastAppliedDay = state.day;
  secrecy.history.push({
    day: state.day,
    source: "devtools-set-high",
    currentAfter: secrecy.current,
    suspicionAfter: secrecy.suspicion,
    breachRisk: secrecy.breachRisk
  });
  cleanupHistory(secrecy);

  return secrecy;
}

export function clearSecrecy(state) {
  const secrecy = ensureSecrecyConsequenceState(state);
  if (!secrecy) {
    return null;
  }

  secrecy.current = 0;
  secrecy.suspicion = 0;
  secrecy.breachRisk = "none";
  secrecy.lastAppliedDay = null;
  secrecy.lastDiscoveryDay = null;
  secrecy.lastEffect = {
    day: state.day,
    discovered: false,
    breachRisk: "none",
    note: pickRandom(NOTES.cleared)
  };
  secrecy.history.push({
    day: state.day,
    source: "devtools-clear"
  });
  cleanupHistory(secrecy);

  return secrecy;
}

function severityToCurrentDelta(severity, isPotentialBreach) {
  if (!isPotentialBreach) {
    return 1;
  }

  if (severity === "high") {
    return 3;
  }

  if (severity === "medium") {
    return 2;
  }

  return 1;
}

function severityToSuspicionDelta(severity, isPotentialBreach) {
  if (!isPotentialBreach) {
    return 0;
  }

  if (severity === "high") {
    return 2;
  }

  if (severity === "medium") {
    return 1;
  }

  return 1;
}

function deriveBreachRisk(secrecy, severity, isPotentialBreach) {
  if (secrecy.current >= 7 || secrecy.suspicion >= 7 || severity === "high") {
    return "high";
  }

  if (isPotentialBreach || secrecy.current >= 4 || secrecy.suspicion >= 4 || severity === "medium") {
    return "medium";
  }

  if (secrecy.current > 0 || secrecy.suspicion > 0) {
    return "low";
  }

  return "none";
}

function cleanupHistory(secrecy) {
  if (secrecy.history.length > MAX_HISTORY) {
    secrecy.history = secrecy.history.slice(secrecy.history.length - MAX_HISTORY);
  }
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
