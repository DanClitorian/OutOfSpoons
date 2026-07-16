// newRelationshipSeedSystem.js
//
// v0.43: New Relationship Seed.
//
// Domyka pierwszą pętlę roguelike:
// relacja -> rozpad -> solo / rekonstrukcja -> nowa relacja.
//
// To NIE jest dating sim. Gracz nie wybiera osoby z katalogu.
// Nowa relacja pojawia się dopiero wtedy, kiedy etap solo zbudował
// minimalną samowiedzę albo integralność granic. Pytanie brzmi:
// "Czy to jest nowa relacja, czy ucieczka od poprzedniej?"
//
// Uwaga techniczna: ten system nie importuje partnerSystem.js, bo jego
// eksporty nie są stabilnym kontraktem dla tego etapu. Zamiast tego
// tworzy stan partnera w formacie kompatybilnym z istniejącym HUD-em:
// state.partner + state.npcs[partner.id]. Dzięki temu wraca normalny
// flow gry, a pełne spięcie z generatorem partnerów można dopracować
// później bez ryzyka crasha.

const CANDIDATES = [
  {
    name: "Mira",
    pronouns: "ona/jej",
    roleLabel: "nowa osoba partnerska",
    relationshipLabel: "nowa relacja",
    texture: "spokojna bez bycia łatwą"
  },
  {
    name: "Leon",
    pronouns: "on/jego",
    roleLabel: "nowy partner",
    relationshipLabel: "nowa relacja",
    texture: "uważny, ale nie ratunkowy"
  },
  {
    name: "Nika",
    pronouns: "ona/jej",
    roleLabel: "nowa partnerka",
    relationshipLabel: "nowa relacja",
    texture: "ciepła, ale z własnymi granicami"
  },
  {
    name: "Alex",
    pronouns: "oni/ich",
    roleLabel: "nowa osoba partnerska",
    relationshipLabel: "nowa relacja",
    texture: "bliska powoli, bez obietnicy skrótu"
  }
];

export function canStartNewRelationship(state) {
  const solo = state && state.soloRecovery ? state.soloRecovery : null;
  const isSingle = state && state.player && state.player.isSingle === true;

  if (!solo || !solo.active || !isSingle) {
    return false;
  }

  const days = Number(solo.daysInSolitude || 0);
  const selfKnowledge = Number(solo.selfKnowledge || 0);
  const boundaryIntegrity = Number(solo.boundaryIntegrity || 0);

  return days >= 2 && (selfKnowledge >= 6 || boundaryIntegrity >= 60);
}

export function buildNewRelationshipSeedChoice(state) {
  if (!canStartNewRelationship(state)) {
    return null;
  }

  return {
    id: "start_new_relationship_seed",
    title: "Nie szukać ratunku. Zauważyć możliwość.",
    text:
      "Ktoś pojawia się nie jako nagroda za przejście żałoby i nie jako plaster. Bardziej jako pytanie: czy umiesz wejść w relację bez udawania, że poprzednia niczego nie zmieniła?",
    spoonsCost: 0,
    startsNewRelationship: true
  };
}

export function previewNewRelationshipSeed(state) {
  const solo = state && state.soloRecovery ? state.soloRecovery : null;
  return {
    canStart: canStartNewRelationship(state),
    reason: buildReadinessReason(state),
    daysInSolitude: solo ? solo.daysInSolitude : null,
    selfKnowledge: solo ? solo.selfKnowledge : null,
    boundaryIntegrity: solo ? solo.boundaryIntegrity : null,
    socialExhaustion: solo ? solo.socialExhaustion : null,
    lessons: solo && Array.isArray(solo.lessons) ? solo.lessons : []
  };
}

export function startNewRelationshipSeed(state, source = "solo-recovery") {
  if (!state || !state.player) {
    return { started: false, reason: "No active player state." };
  }

  if (!canStartNewRelationship(state) && source !== "devtools") {
    return { started: false, reason: buildReadinessReason(state) };
  }

  const solo = state.soloRecovery || {};
  const oldPartnerSnapshot = snapshotPartner(state);
  const candidate = pickCandidate(state);
  const newPartnerId = `partner_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const startStats = calculateStartStats(state, solo);

  ensureRelationshipHistory(state);
  archivePreviousRelationshipIfNeeded(state, oldPartnerSnapshot, source);

  const newPartner = {
    id: newPartnerId,
    name: candidate.name,
    pronouns: candidate.pronouns,
    roleLabel: candidate.roleLabel,
    relationshipLabel: candidate.relationshipLabel,
    status: "active",
    startedDay: state.day,
    texture: candidate.texture,
    previousRelationshipCount: state.relationshipHistory.length
  };

  state.partner = newPartner;
  state.npcs = state.npcs || {};
  state.npcs[newPartnerId] = {
    id: newPartnerId,
    name: candidate.name,
    roleLabel: candidate.roleLabel,
    relationshipLabel: candidate.relationshipLabel,
    trust: startStats.trust,
    frustration: startStats.frustration,
    mood: "new",
    status: "active"
  };

  state.player.isSingle = false;

  if (state.soloRecovery) {
    state.soloRecovery.active = false;
    state.soloRecovery.readyForNewRelationship = false;
    state.soloRecovery.lastResult = {
      applied: true,
      startsNewRelationship: true,
      partnerName: candidate.name,
      trust: startStats.trust,
      frustration: startStats.frustration
    };
    state.soloRecovery.history.push({
      day: state.day,
      source,
      action: "start-new-relationship",
      partnerName: candidate.name,
      trust: startStats.trust,
      frustration: startStats.frustration
    });
  }

  updateRelationshipModelForNewStart(state, solo);
  updateRelationalBaggage(state, solo, oldPartnerSnapshot, newPartner, startStats);
  resetRelationshipSpecificState(state);
  resetOpenRomanceAndSecrecy(state);

  state.currentEventId = null;
  state.dayAgenda = null;
  state.phase = "morning";

  if (!Array.isArray(state.log)) {
    state.log = [];
  }

  state.log.push({
    day: state.day,
    type: "new-relationship-seed",
    text:
      `${candidate.name} nie pojawia się jako naprawa poprzedniej historii. ` +
      "Pojawia się jako możliwość, którą można potraktować wolniej.",
    newRelationshipEffect: {
      started: true,
      partnerName: candidate.name,
      trust: startStats.trust,
      frustration: startStats.frustration,
      baggage: state.player.relationalBaggage || null
    }
  });

  return {
    started: true,
    partner: newPartner,
    partnerStats: state.npcs[newPartnerId],
    startStats,
    baggage: state.player.relationalBaggage || null
  };
}

function calculateStartStats(state, solo) {
  const selfKnowledge = Number(solo.selfKnowledge || 0);
  const boundaryIntegrity = Number(solo.boundaryIntegrity || 0);
  const socialExhaustion = Number(solo.socialExhaustion || 0);
  const lessons = Array.isArray(solo.lessons) ? solo.lessons : [];

  let trust = 44;
  let frustration = 24;

  trust += Math.min(10, Math.floor(selfKnowledge * 1.2));
  trust += boundaryIntegrity >= 70 ? 6 : boundaryIntegrity >= 60 ? 3 : 0;

  if (lessons.includes("boundary")) {
    trust += 3;
    frustration -= 2;
  }

  if (lessons.includes("rest")) {
    frustration -= 2;
  }

  if (socialExhaustion >= 8) {
    frustration += 8;
    trust -= 3;
  } else if (socialExhaustion >= 5) {
    frustration += 4;
  }

  return {
    trust: clamp(trust, 35, 68),
    frustration: clamp(frustration, 12, 48)
  };
}

function updateRelationshipModelForNewStart(state, solo) {
  if (!state.relationshipModel) {
    state.relationshipModel = {
      type: "polyamory",
      clarity: 55,
      agreements: {},
      lastDiscussedDay: null,
      history: []
    };
  }

  const selfKnowledge = Number(solo.selfKnowledge || 0);
  const boundaryIntegrity = Number(solo.boundaryIntegrity || 0);
  const socialExhaustion = Number(solo.socialExhaustion || 0);

  const clarity =
    40 +
    Math.min(20, selfKnowledge * 2) +
    (boundaryIntegrity >= 70 ? 10 : boundaryIntegrity >= 60 ? 6 : 0) -
    (socialExhaustion >= 8 ? 8 : 0);

  state.relationshipModel.clarity = clamp(clarity, 35, 78);
  state.relationshipModel.lastDiscussedDay = null;

  if (!Array.isArray(state.relationshipModel.history)) {
    state.relationshipModel.history = [];
  }

  state.relationshipModel.history.push({
    day: state.day,
    action: "new-relationship-seed",
    clarity: state.relationshipModel.clarity
  });

  if (state.relationshipModel.history.length > 30) {
    state.relationshipModel.history = state.relationshipModel.history.slice(state.relationshipModel.history.length - 30);
  }
}

function updateRelationalBaggage(state, solo, oldPartnerSnapshot, newPartner, startStats) {
  const lessons = Array.isArray(solo.lessons) ? solo.lessons.slice() : [];
  const old = state.player.relationalBaggage || {};

  state.player.relationalBaggage = {
    relationshipsEnded: Array.isArray(state.relationshipHistory) ? state.relationshipHistory.length : Number(old.relationshipsEnded || 0),
    relationshipsStarted: Number(old.relationshipsStarted || 1) + 1,
    lastPreviousPartnerName: oldPartnerSnapshot ? oldPartnerSnapshot.name : null,
    currentPartnerName: newPartner.name,
    lessons: unique([...(Array.isArray(old.lessons) ? old.lessons : []), ...lessons]),
    activePatternsAtStart:
      state.patterns && Array.isArray(state.patterns.active)
        ? state.patterns.active.map((pattern) => pattern.id || pattern.patternId || pattern.key).filter(Boolean)
        : [],
    startModifiers: {
      trust: startStats.trust,
      frustration: startStats.frustration
    },
    lastUpdatedDay: state.day
  };
}

function resetRelationshipSpecificState(state) {
  if (state.relationshipEnd) {
    state.relationshipEnd.active = false;
    state.relationshipEnd.type = null;
    state.relationshipEnd.title = null;
    state.relationshipEnd.text = null;
    state.relationshipEnd.reason = null;
    state.relationshipEnd.day = null;
    state.relationshipEnd.source = null;
    state.relationshipEnd.seen = true;
  }

  if (state.partner) {
    state.partner.conflict = {
      current: 0,
      volatility: 0,
      state: "calm",
      lastEvaluatedDay: null,
      lastConflictDay: null,
      lastConflictEvent: null,
      history: []
    };
    state.partner.scars = [];
    state.partner.resolvedScars = [];
    state.partner.repair = {
      history: [],
      lastWeeklyRepairDay: null
    };
  }
}

function resetOpenRomanceAndSecrecy(state) {
  if (state.player.romance) {
    state.player.romance.attraction = 0;
    state.player.romance.secrecy = 0;
    state.player.romance.boundaryRisk = "none";
    state.player.romance.targetName = null;
    state.player.romance.lastActionDay = null;
    state.player.romance.lastClassification = null;
  }

  if (state.player.secrecy) {
    state.player.secrecy.current = 0;
    state.player.secrecy.suspicion = 0;
    state.player.secrecy.breachRisk = "none";
    state.player.secrecy.lastAppliedDay = null;
    state.player.secrecy.lastDiscoveryDay = null;
    state.player.secrecy.lastEffect = null;
  }
}

function archivePreviousRelationshipIfNeeded(state, oldPartnerSnapshot, source) {
  if (!oldPartnerSnapshot) {
    return;
  }

  const alreadyArchived = state.relationshipHistory.some((entry) => {
    return entry && entry.partnerSnapshot && entry.partnerSnapshot.id === oldPartnerSnapshot.id;
  });

  if (alreadyArchived) {
    return;
  }

  state.relationshipHistory.push({
    endedDay: state.day,
    source: `${source}-auto-archive`,
    partnerSnapshot: oldPartnerSnapshot,
    endSummary: snapshotRelationshipEnd(state),
    scars: state.partner && Array.isArray(state.partner.scars) ? cloneSafe(state.partner.scars) : [],
    resolvedScars: state.partner && Array.isArray(state.partner.resolvedScars) ? cloneSafe(state.partner.resolvedScars) : [],
    patterns: state.patterns && Array.isArray(state.patterns.active) ? cloneSafe(state.patterns.active) : []
  });
}

function ensureRelationshipHistory(state) {
  if (!Array.isArray(state.relationshipHistory)) {
    state.relationshipHistory = [];
  }
}

function pickCandidate(state) {
  const historyNames = Array.isArray(state.relationshipHistory)
    ? state.relationshipHistory
        .map((entry) => entry && entry.partnerSnapshot ? entry.partnerSnapshot.name : null)
        .filter(Boolean)
    : [];

  const available = CANDIDATES.filter((candidate) => !historyNames.includes(candidate.name));
  const pool = available.length > 0 ? available : CANDIDATES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function snapshotPartner(state) {
  if (!state || !state.partner) {
    return null;
  }

  return cloneSafe({
    id: state.partner.id,
    name: state.partner.name,
    pronouns: state.partner.pronouns,
    roleLabel: state.partner.roleLabel,
    relationshipLabel: state.partner.relationshipLabel,
    status: state.partner.status || "ended",
    startedDay: state.partner.startedDay || null
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

function buildReadinessReason(state) {
  const solo = state && state.soloRecovery ? state.soloRecovery : null;
  if (!solo || !solo.active) {
    return "Tryb rekonstrukcji nie jest aktywny.";
  }

  if (!state.player || state.player.isSingle !== true) {
    return "Gracz nie jest w trybie single.";
  }

  if (Number(solo.daysInSolitude || 0) < 2) {
    return "Potrzeba jeszcze chwili bez robienia z nowej relacji natychmiastowej odpowiedzi.";
  }

  if (Number(solo.selfKnowledge || 0) < 6 && Number(solo.boundaryIntegrity || 0) < 60) {
    return "Potrzeba więcej samowiedzy albo mocniejszych granic.";
  }

  return "Możesz wejść w nową relację bez robienia z niej ucieczki.";
}

function cloneSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}
