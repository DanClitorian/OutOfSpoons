// romanceInterestSystem.js
//
// v0.37: Romance Interest Prototype.
//
// Pierwszy bezpieczny fundament fascynacji/romansu poza główną relacją.
// To NIE jest jeszcze pełny system zdrady, seksu ani drugiego partnera.
// Ten moduł śledzi attraction / secrecy / boundary risk i używa
// relationshipModelSystem.classifyRelationalAction(), żeby nie traktować
// każdego romansu według jednego moralnego schematu.
//
// Najważniejsze: w poliamorii sama fascynacja nie jest automatycznie
// zdradą. Problemem może być sekret, złamanie ustaleń albo odebranie
// partnerowi świadomej decyzji.

import { classifyRelationalAction } from "./relationshipModelSystem.js?v=340";

const MAX_HISTORY = 30;

const NOTES = {
  open: [
    "Nazwanie fascynacji nie sprawiło, że zniknęła. Sprawiło tylko, że przestała być sekretem.",
    "To nie rozwiązało napięcia. Ale przynajmniej nie musiało rosnąć w ukryciu."
  ],
  secret: [
    "To było małe kliknięcie. Wystarczająco małe, żeby dało się udawać, że nic się nie stało.",
    "Sekret nie zrobił hałasu. Po prostu znalazł sobie miejsce."
  ],
  postponed: [
    "Brak odpowiedzi też jest odpowiedzią. Tylko odłożoną.",
    "To nie zniknęło. Zostało przesunięte na później."
  ]
};

export function ensureRomanceInterestState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.player.romance) {
    state.player.romance = {
      attraction: 0,
      secrecy: 0,
      boundaryRisk: "none",
      targetName: null,
      lastActionDay: null,
      lastClassification: null,
      history: []
    };
  }

  if (!Array.isArray(state.player.romance.history)) {
    state.player.romance.history = [];
  }

  state.player.romance.attraction = clamp(state.player.romance.attraction, 0, 10);
  state.player.romance.secrecy = clamp(state.player.romance.secrecy, 0, 10);

  return state.player.romance;
}

export function applyRomanceInterestFromChoice(state, event, choice) {
  const action = choice ? choice.romanceAction : null;
  if (!action) {
    return { applied: false };
  }

  const romance = ensureRomanceInterestState(state);
  if (!romance) {
    return { applied: false };
  }

  const relationalAction = {
    type: action.type || "flirt",
    disclosed: action.disclosed === true,
    askedFirst: action.askedFirst === true
  };

  const classification = classifyRelationalAction(state, relationalAction);

  const attractionDelta = Number(action.attractionChange || 0);
  const secrecyDelta = Number(action.secrecyChange || 0);
  const noteKind = action.noteKind || (action.disclosed ? "open" : "secret");

  romance.attraction = clamp(romance.attraction + attractionDelta, 0, 10);
  romance.secrecy = clamp(romance.secrecy + secrecyDelta, 0, 10);
  romance.targetName = action.targetName || romance.targetName || "Ktoś nowy";
  romance.boundaryRisk = deriveBoundaryRisk(classification, romance);
  romance.lastActionDay = state.day;
  romance.lastClassification = classification;

  const note = pickRandom(NOTES[noteKind] || NOTES.secret);

  romance.history.push({
    day: state.day,
    eventId: event ? event.id : null,
    choiceId: choice ? choice.id : null,
    actionType: relationalAction.type,
    disclosed: relationalAction.disclosed,
    askedFirst: relationalAction.askedFirst,
    attractionAfter: romance.attraction,
    secrecyAfter: romance.secrecy,
    boundaryRisk: romance.boundaryRisk,
    classification,
    note
  });
  cleanupHistory(romance);

  return {
    applied: true,
    actionType: relationalAction.type,
    disclosed: relationalAction.disclosed,
    askedFirst: relationalAction.askedFirst,
    attractionAfter: romance.attraction,
    secrecyAfter: romance.secrecy,
    boundaryRisk: romance.boundaryRisk,
    classification,
    note
  };
}

export function buildRomanceDebugSummary(state) {
  const romance = ensureRomanceInterestState(state);
  if (!romance) {
    return null;
  }

  return {
    attraction: romance.attraction,
    secrecy: romance.secrecy,
    boundaryRisk: romance.boundaryRisk,
    targetName: romance.targetName,
    lastActionDay: romance.lastActionDay,
    lastClassification: romance.lastClassification,
    recentHistory: romance.history.slice(-10)
  };
}

export function setRomanceHigh(state) {
  const romance = ensureRomanceInterestState(state);
  if (!romance) {
    return null;
  }

  romance.attraction = 8;
  romance.secrecy = 6;
  romance.boundaryRisk = "high";
  romance.targetName = romance.targetName || "Ktoś nowy";
  romance.lastActionDay = state.day;
  romance.history.push({
    day: state.day,
    source: "devtools-set-high",
    attractionAfter: romance.attraction,
    secrecyAfter: romance.secrecy,
    boundaryRisk: romance.boundaryRisk
  });
  cleanupHistory(romance);

  return romance;
}

export function clearRomance(state) {
  const romance = ensureRomanceInterestState(state);
  if (!romance) {
    return null;
  }

  romance.attraction = 0;
  romance.secrecy = 0;
  romance.boundaryRisk = "none";
  romance.targetName = null;
  romance.lastActionDay = null;
  romance.lastClassification = null;
  romance.history.push({
    day: state.day,
    source: "devtools-clear"
  });
  cleanupHistory(romance);

  return romance;
}

function deriveBoundaryRisk(classification, romance) {
  if (!classification || !classification.isPotentialBreach) {
    if (romance.secrecy >= 6) {
      return "medium";
    }
    return romance.secrecy >= 3 ? "low" : "none";
  }

  if (classification.severity === "high") {
    return "high";
  }

  if (classification.severity === "medium") {
    return "medium";
  }

  return "low";
}

function cleanupHistory(romance) {
  if (romance.history.length > MAX_HISTORY) {
    romance.history = romance.history.slice(romance.history.length - MAX_HISTORY);
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
