// soloRecoverySystem.js
//
// v0.42: Solo / Reconstruction Bridge.
//
// Po rozpadzie relacji gra nie kończy się automatycznie. Gracz może
// wejść w krótki etap rekonstrukcji: nie szuka "następcy", tylko
// sprawdza, co w nim zostało po relacji.
//
// To NIE jest dating sim. Nie ma tu uwodzenia, paska zainteresowania
// ani zdobywania nowej osoby. Są: selfKnowledge, socialExhaustion,
// boundaryIntegrity i lessons learned.
//
// Ten moduł celowo NIE usuwa state.partner ani state.npcs. Starsze
// systemy nadal zakładają istnienie partnera w HUD, więc etap solo
// archiwizuje relację i przełącza rytm gry bez agresywnego kasowania
// aktywnego obiektu partnera. Nowa relacja może zostać dodana dopiero
// w kolejnym update.

import {
  buildNewRelationshipSeedChoice,
  startNewRelationshipSeed
} from "./newRelationshipSeedSystem.js?v=430";

const MAX_HISTORY = 40;

const CHOICES = [
  {
    id: "echo_chamber",
    title: "Echo komnaty",
    text:
      "Zrobić coś, co przypomina o poprzedniej relacji. Nie po to, żeby ją odzyskać. Po to, żeby sprawdzić, gdzie nadal odzywa się w Tobie.",
    spoonsCost: 2,
    selfKnowledgeChange: 2,
    socialExhaustionChange: 1,
    boundaryIntegrityChange: 1,
    lesson: "echo",
    result:
      "To nie była rozmowa z byłą relacją. Bardziej z miejscem, które po niej zostało."
  },
  {
    id: "boundary_scan",
    title: "Skanowanie granic",
    text:
      "Przejrzeć ostatnie rozmowy i nazwać jeden sygnał, którego następnym razem nie chcesz ignorować.",
    spoonsCost: 1,
    selfKnowledgeChange: 1,
    socialExhaustionChange: 0,
    boundaryIntegrityChange: 3,
    lesson: "boundary",
    result:
      "Nie znalazłeś jednej wielkiej odpowiedzi. Znalazłeś jedną granicę, której nie trzeba już tłumaczyć od zera."
  },
  {
    id: "social_audit",
    title: "Audyt społeczny",
    text:
      "Odpisać jednej osobie, ale bez udawania pełnej dostępności. Zobaczyć, czy kontakt może istnieć bez maskowania.",
    spoonsCost: 1,
    selfKnowledgeChange: 1,
    socialExhaustionChange: 2,
    boundaryIntegrityChange: 1,
    lesson: "social-audit",
    result:
      "Kontakt nie musiał być występem. To małe odkrycie, ale dzisiaj wystarczy."
  },
  {
    id: "do_nothing_on_purpose",
    title: "Nic, celowo",
    text:
      "Nie szukać sensu, nowej osoby ani natychmiastowej wersji siebie. Pozwolić dniu przejść bez narracji o postępie.",
    spoonsCost: 0,
    selfKnowledgeChange: 0,
    socialExhaustionChange: -2,
    boundaryIntegrityChange: 1,
    lesson: "rest",
    result:
      "Nie wszystko, co ważne, wygląda jak ruch do przodu."
  }
];

export function ensureSoloRecoveryState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.soloRecovery) {
    state.soloRecovery = {
      active: false,
      startedDay: null,
      daysInSolitude: 0,
      selfKnowledge: 0,
      socialExhaustion: 0,
      boundaryIntegrity: 50,
      readyForNewRelationship: false,
      lastChoiceDay: null,
      lastResult: null,
      lessons: [],
      history: []
    };
  }

  if (!Array.isArray(state.soloRecovery.lessons)) {
    state.soloRecovery.lessons = [];
  }

  if (!Array.isArray(state.soloRecovery.history)) {
    state.soloRecovery.history = [];
  }

  state.player.isSingle = state.soloRecovery.active === true;
  state.soloRecovery.selfKnowledge = clamp(state.soloRecovery.selfKnowledge, 0, 12);
  state.soloRecovery.socialExhaustion = clamp(state.soloRecovery.socialExhaustion, 0, 12);
  state.soloRecovery.boundaryIntegrity = clamp(state.soloRecovery.boundaryIntegrity, 0, 100);

  return state.soloRecovery;
}

export function isSoloRecoveryActive(state) {
  return !!(state && state.player && state.player.isSingle === true && state.soloRecovery && state.soloRecovery.active === true);
}

export function enterSoloRecovery(state, source = "relationship-end") {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  if (!Array.isArray(state.relationshipHistory)) {
    state.relationshipHistory = [];
  }

  const alreadyArchivedToday = state.relationshipHistory.some((entry) => entry && entry.endedDay === state.day && entry.source === source);
  if (!alreadyArchivedToday) {
    state.relationshipHistory.push({
      endedDay: state.day,
      source,
      partnerSnapshot: snapshotPartner(state),
      endSummary: snapshotRelationshipEnd(state),
      scars: state.partner && Array.isArray(state.partner.scars) ? cloneSafe(state.partner.scars) : [],
      resolvedScars: state.partner && Array.isArray(state.partner.resolvedScars) ? cloneSafe(state.partner.resolvedScars) : [],
      patterns: state.patterns && Array.isArray(state.patterns.active) ? cloneSafe(state.patterns.active) : []
    });
  }

  solo.active = true;
  solo.startedDay = solo.startedDay || state.day;
  solo.daysInSolitude = Math.max(0, state.day - solo.startedDay);
  solo.readyForNewRelationship = false;
  solo.lastResult = null;

  state.player.isSingle = true;
  state.phase = "morning";

  if (state.relationshipEnd) {
    state.relationshipEnd.active = false;
    state.relationshipEnd.seen = true;
  }

  if (state.partner) {
    state.partner.status = "ex";
  }

  solo.history.push({
    day: state.day,
    source,
    action: "enter-solo-recovery"
  });
  cleanupHistory(solo);

  return solo;
}

export function getSoloRecoveryChoices(state) {
  ensureSoloRecoveryState(state);
  const choices = CHOICES.map((choice) => ({ ...choice }));
  const newRelationshipChoice = buildNewRelationshipSeedChoice(state);

  if (newRelationshipChoice) {
    choices.push(newRelationshipChoice);
  }

  return choices;
}

export function applySoloRecoveryChoice(state, choiceId) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || !solo.active) {
    return { applied: false, reason: "Solo recovery is not active." };
  }

  if (choiceId === "start_new_relationship_seed") {
    const result = startNewRelationshipSeed(state);

    return {
      applied: result.started === true,
      startsNewRelationship: result.started === true,
      reason: result.reason || null,
      partner: result.partner || null,
      partnerStats: result.partnerStats || null
    };
  }

  const choice = CHOICES.find((item) => item.id === choiceId);
  if (!choice) {
    return { applied: false, reason: "Unknown solo recovery choice." };
  }

  applySpoonsCost(state, choice.spoonsCost);

  solo.selfKnowledge = clamp(solo.selfKnowledge + choice.selfKnowledgeChange, 0, 12);
  solo.socialExhaustion = clamp(solo.socialExhaustion + choice.socialExhaustionChange, 0, 12);
  solo.boundaryIntegrity = clamp(solo.boundaryIntegrity + choice.boundaryIntegrityChange, 0, 100);
  solo.daysInSolitude = Math.max(0, state.day - solo.startedDay);
  solo.lastChoiceDay = state.day;
  solo.readyForNewRelationship = solo.selfKnowledge >= 6 && solo.boundaryIntegrity >= 55 && solo.daysInSolitude >= 2;

  if (choice.lesson && !solo.lessons.includes(choice.lesson)) {
    solo.lessons.push(choice.lesson);
  }

  const result = {
    applied: true,
    choiceId: choice.id,
    title: choice.title,
    result: choice.result,
    spoonsCost: choice.spoonsCost,
    selfKnowledge: solo.selfKnowledge,
    socialExhaustion: solo.socialExhaustion,
    boundaryIntegrity: solo.boundaryIntegrity,
    readyForNewRelationship: solo.readyForNewRelationship
  };

  solo.lastResult = result;
  solo.history.push({
    day: state.day,
    source: "solo-choice",
    ...result
  });
  cleanupHistory(solo);

  return result;
}

export function advanceSoloRecoveryDay(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || !solo.active) {
    return null;
  }

  state.day += 1;
  state.phase = "morning";
  solo.daysInSolitude = Math.max(0, state.day - solo.startedDay);

  // Krótka faza single nie daje darmowego resetu. Odpoczynek może pomóc,
  // ale przeciążenie społeczne i pusty dzień nadal mają koszt.
  const spoons = getSpoons(state);
  if (spoons) {
    const recovery = solo.socialExhaustion <= 3 ? 1 : 0;
    spoons.current = clamp(spoons.current + recovery, 0, spoons.max || 10);
  }

  solo.history.push({
    day: state.day,
    source: "solo-day-advance",
    daysInSolitude: solo.daysInSolitude
  });
  cleanupHistory(solo);

  return solo;
}

export function buildSoloMorningLine(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || !solo.active) {
    return null;
  }

  if (solo.readyForNewRelationship) {
    return "Rekonstrukcja: możesz już myśleć o kolejnej relacji, ale nie musisz robić z tego ucieczki.";
  }

  if (solo.selfKnowledge >= 4) {
    return "Rekonstrukcja: coraz mniej chodzi o poprzednią relację, a coraz bardziej o to, co chcesz zabrać dalej.";
  }

  return "Rekonstrukcja: dziś nie szukasz następcy. Sprawdzasz, co w Tobie zostało.";
}

export function getSoloRecoveryDebugSummary(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  return {
    isSingle: state.player ? state.player.isSingle === true : false,
    active: solo.active,
    startedDay: solo.startedDay,
    daysInSolitude: solo.daysInSolitude,
    selfKnowledge: solo.selfKnowledge,
    socialExhaustion: solo.socialExhaustion,
    boundaryIntegrity: solo.boundaryIntegrity,
    readyForNewRelationship: solo.readyForNewRelationship,
    lessons: solo.lessons,
    lastResult: solo.lastResult,
    recentHistory: solo.history.slice(-10),
    relationshipHistoryCount: Array.isArray(state.relationshipHistory) ? state.relationshipHistory.length : 0
  };
}

export function setSelfKnowledgeHigh(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  solo.active = true;
  state.player.isSingle = true;
  solo.startedDay = solo.startedDay || Math.max(1, state.day - 3);
  solo.daysInSolitude = Math.max(3, state.day - solo.startedDay);
  solo.selfKnowledge = 8;
  solo.boundaryIntegrity = Math.max(solo.boundaryIntegrity, 70);
  solo.readyForNewRelationship = true;
  solo.history.push({
    day: state.day,
    source: "devtools-self-knowledge-high"
  });
  cleanupHistory(solo);

  return solo;
}

export function clearSoloRecovery(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  solo.active = false;
  solo.readyForNewRelationship = false;
  state.player.isSingle = false;

  solo.history.push({
    day: state.day,
    source: "devtools-clear"
  });
  cleanupHistory(solo);

  return solo;
}

function snapshotPartner(state) {
  if (!state || !state.partner) {
    return null;
  }

  return cloneSafe({
    id: state.partner.id,
    name: state.partner.name,
    roleLabel: state.partner.roleLabel,
    relationshipLabel: state.partner.relationshipLabel,
    status: state.partner.status || "ended"
  });
}

function snapshotRelationshipEnd(state) {
  if (!state || !state.relationshipEnd) {
    return null;
  }

  return cloneSafe({
    type: state.relationshipEnd.type,
    title: state.relationshipEnd.title,
    reason: state.relationshipEnd.reason,
    day: state.relationshipEnd.day
  });
}

function applySpoonsCost(state, cost) {
  const spoons = getSpoons(state);
  if (!spoons) {
    return;
  }

  spoons.current = clamp(spoons.current - Number(cost || 0), 0, spoons.max || 10);
}

function getSpoons(state) {
  return state && state.resources && state.resources.spoons ? state.resources.spoons : null;
}

function cloneSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanupHistory(solo) {
  if (solo.history.length > MAX_HISTORY) {
    solo.history = solo.history.slice(solo.history.length - MAX_HISTORY);
  }
}
