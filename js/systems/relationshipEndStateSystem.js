// relationshipEndStateSystem.js
//
// v0.36: Relationship End States.
//
// Pierwszy system prawdziwych end-state'ów relacyjnych: rozstanie,
// finałowa kłótnia, ciche wyjście, wypalenie relacji.
//
// To NIE jest system zdrady ani romansu. To fundament zakończeń relacji,
// oparty o już istniejące napięcie: conflict, trust/frustration,
// relationship scars, partner capacity, spoons i wzorce.
//
// Najważniejsza zasada: relacja nie kończy się dlatego, że gracz kliknął
// "złą" opcję. Kończy się, kiedy historia przestaje mieć gdzie wrócić.

const MAX_HISTORY = 20;

const END_TEMPLATES = {
  finalFight: {
    type: "final-fight",
    title: "Kłótnia, która nie miała już powrotu",
    text:
      "To nie była jedna rozmowa. To było wiele rozmów, które nie doszły do skutku, i kilka takich, które przyszły za późno. Kiedy padły ostatnie słowa, oboje wiedzieliście, że nie chodzi już o dzisiejszy dzień.",
    reason: "Napięcie relacyjne przeszło w finałową kłótnię."
  },
  breakup: {
    type: "breakup",
    title: "Rozstanie",
    text:
      "Nie było jednego momentu, w którym wszystko się skończyło. Było raczej coraz mniej miejsc, do których można było wracać. W końcu relacja przestała być domem, a zaczęła być zadaniem bez sił.",
    reason: "Zaufanie spadło zbyt nisko, a frustracja zbyt długo niosła rozmowę."
  },
  quietEnding: {
    type: "quiet-ending",
    title: "Ciche wyjście",
    text:
      "Nikt nie trzasnął drzwiami. Nikt nie wygłosił wielkiej przemowy. Po prostu pewnego dnia cisza przestała być przerwą między rozmowami, a stała się odpowiedzią.",
    reason: "Relacja wygasła przez długie unikanie i brak odbudowy."
  },
  burnoutEnding: {
    type: "burnout-ending",
    title: "Nie zostało z czego budować",
    text:
      "Nie zawsze ktoś musi być winny. Czasem dwie osoby stoją naprzeciwko siebie i każda z nich ma za mało sił, żeby zrobić krok. Relacja nie pękła głośno. Po prostu przestała unosić ciężar.",
    reason: "Obie strony były zbyt przeciążone, żeby dalej utrzymać relację."
  }
};

export function ensureRelationshipEndState(state) {
  if (!state) {
    return null;
  }

  if (!state.relationshipEnd) {
    state.relationshipEnd = {
      active: false,
      type: null,
      title: null,
      text: null,
      reason: null,
      day: null,
      source: null,
      seen: false,
      history: []
    };
  }

  if (!Array.isArray(state.relationshipEnd.history)) {
    state.relationshipEnd.history = [];
  }

  return state.relationshipEnd;
}

export function evaluateRelationshipEndAfterChoice(state, event, choice, context = {}) {
  const endState = ensureRelationshipEndState(state);
  if (!endState || endState.active) {
    return {
      triggered: false,
      active: endState ? endState.active : false,
      type: endState ? endState.type : null,
      reason: endState ? endState.reason : null
    };
  }

  if (!state || state.day < 6) {
    return { triggered: false, active: false, type: null, reason: null };
  }

  const partnerStats = getPartnerStats(state);
  const trust = partnerStats ? Number(partnerStats.trust) : 50;
  const frustration = partnerStats ? Number(partnerStats.frustration) : 0;
  const conflict = state.partner ? state.partner.conflict : null;
  const conflictState = conflict ? conflict.state : "calm";
  const conflictCurrent = conflict ? Number(conflict.current || 0) : 0;
  const scars = getActiveScars(state);
  const spoons = state.resources && state.resources.spoons ? Number(state.resources.spoons.current) : 0;
  const capacityMood = state.partner && state.partner.capacity ? state.partner.capacity.mood : null;
  const activePatterns = getActivePatternIds(state);
  const conflictEffect = context.conflictResult || null;

  if (
    conflictEffect &&
    conflictEffect.triggeredFight &&
    trust <= 35 &&
    frustration >= 65 &&
    (conflictCurrent >= 8 || conflictState === "fight" || scars.length >= 1)
  ) {
    return triggerRelationshipEnd(state, END_TEMPLATES.finalFight, {
      source: "choice",
      eventId: event ? event.id : null,
      choiceId: choice ? choice.id : null
    });
  }

  if (state.day >= 8 && trust <= 16 && frustration >= 62 && (conflictState === "critical" || conflictState === "fight")) {
    return triggerRelationshipEnd(state, END_TEMPLATES.breakup, {
      source: "choice",
      eventId: event ? event.id : null,
      choiceId: choice ? choice.id : null
    });
  }

  if (
    state.day >= 8 &&
    trust <= 24 &&
    frustration >= 55 &&
    activePatterns.includes("avoidance") &&
    (conflictState === "volatile" || conflictState === "critical" || conflictState === "fight")
  ) {
    return triggerRelationshipEnd(state, END_TEMPLATES.quietEnding, {
      source: "choice",
      eventId: event ? event.id : null,
      choiceId: choice ? choice.id : null
    });
  }

  if (
    state.day >= 8 &&
    spoons <= 0 &&
    trust <= 35 &&
    frustration >= 60 &&
    (capacityMood === "overloaded" || capacityMood === "distant") &&
    (conflictState === "critical" || conflictState === "fight" || conflictCurrent >= 7)
  ) {
    return triggerRelationshipEnd(state, END_TEMPLATES.burnoutEnding, {
      source: "choice",
      eventId: event ? event.id : null,
      choiceId: choice ? choice.id : null
    });
  }

  return { triggered: false, active: false, type: null, reason: null };
}

function triggerRelationshipEnd(state, template, meta = {}) {
  const endState = ensureRelationshipEndState(state);
  if (!endState) {
    return { triggered: false, active: false, type: null, reason: null };
  }

  endState.active = true;
  endState.type = template.type;
  endState.title = template.title;
  endState.text = template.text;
  endState.reason = template.reason;
  endState.day = state.day;
  endState.source = meta.source || "system";
  endState.seen = false;

  const entry = {
    day: state.day,
    type: template.type,
    title: template.title,
    reason: template.reason,
    source: endState.source,
    eventId: meta.eventId || null,
    choiceId: meta.choiceId || null
  };

  endState.history.push(entry);
  cleanupHistory(endState);

  return {
    triggered: true,
    active: true,
    type: template.type,
    title: template.title,
    text: template.text,
    reason: template.reason
  };
}

export function buildRelationshipEndSummary(state) {
  const endState = ensureRelationshipEndState(state);
  if (!endState || !endState.active) {
    return null;
  }

  return {
    type: endState.type,
    title: endState.title || "Koniec relacji",
    text: endState.text || "Ta relacja dobiegła końca.",
    reason: endState.reason || "Historia relacji nie miała już bezpiecznego miejsca, do którego mogła wrócić.",
    day: endState.day,
    seen: endState.seen
  };
}

export function markRelationshipEndSeen(state) {
  const endState = ensureRelationshipEndState(state);
  if (!endState) {
    return null;
  }

  endState.seen = true;
  return endState;
}

export function getRelationshipEndDebugSummary(state) {
  const endState = ensureRelationshipEndState(state);
  if (!endState) {
    return null;
  }

  return {
    active: endState.active,
    type: endState.type,
    title: endState.title,
    reason: endState.reason,
    day: endState.day,
    source: endState.source,
    seen: endState.seen,
    recentHistory: endState.history.slice(-10)
  };
}

export function forceRelationshipBreakup(state) {
  return triggerRelationshipEnd(state, END_TEMPLATES.breakup, { source: "devtools" });
}

export function forceFinalFight(state) {
  return triggerRelationshipEnd(state, END_TEMPLATES.finalFight, { source: "devtools" });
}

export function clearRelationshipEnd(state) {
  const endState = ensureRelationshipEndState(state);
  if (!endState) {
    return null;
  }

  const previousType = endState.type;

  endState.active = false;
  endState.type = null;
  endState.title = null;
  endState.text = null;
  endState.reason = null;
  endState.day = null;
  endState.source = null;
  endState.seen = false;
  endState.history.push({
    day: state.day,
    source: "devtools-clear",
    previousType
  });
  cleanupHistory(endState);

  return endState;
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
  return active.map((pattern) => pattern.id || pattern.patternId || pattern.key).filter(Boolean);
}

function cleanupHistory(endState) {
  if (endState.history.length > MAX_HISTORY) {
    endState.history = endState.history.slice(endState.history.length - MAX_HISTORY);
  }
}
