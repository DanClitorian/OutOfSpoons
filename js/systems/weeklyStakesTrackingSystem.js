// weeklyStakesTrackingSystem.js
//
// v0.52: Weekly Stakes Tracking.
//
// Miękki, narracyjny tracking aktywnej Stawki Tygodnia: każdy DOMKNIĘTY
// dzień zostawia jeden "ślad" (dailyMark: dobry / neutralny / kosztowny),
// a suma śladów daje ton tygodnia (dobry / stabilny / kruchy). To NIE
// jest questlog, checklista ani arkusz: skala to -1/0/+1, oceny są
// zdaniami, nie liczbami.
//
// Architektura (celowo bliźniacza do reszty systemów v0.2x+):
//   - stan mieszka w state.weeklyChallenge.tracking (lazy-init przez
//     ensureWeeklyTrackingState — stare zapisy działają BEZ zmiany
//     saveVersion),
//   - ocena dnia dzieje się RAZ, przy przejściu dnia
//     (dayCycle.advanceToNextDay woła recordWeeklyTrackingMark PRZED
//     rozliczeniem fatigue — czytamy stan "jak dzień się skończył",
//     łącznie z wyborem wieczornym z v0.51),
//   - guard lastEvaluatedDay uniemożliwia podwójną ocenę tego samego
//     dnia; render poranka NICZEGO tu nie zapisuje (czyste odczyty),
//   - tracking resetuje się sam, gdy zmienia się aktywna Stawka
//     (nowy tydzień = nowy, pusty ślad),
//   - ZERO losowości: te same dane -> ten sam ślad i ta sama notka.
//
// Źródła oceny (wyłącznie ISTNIEJĄCY stan, zweryfikowany w kodzie):
//   spoons/fatigue na koniec dnia, maskingDebt, work.pressure,
//   conflict.state, suma trust/frustrationChange z dzisiejszych wpisów
//   state.log, typ wieczornej decyzji (state.lastEveningRecovery.type,
//   v0.51). Ocena jest ważona przez FOCUS Stawki — wyprowadzany z
//   condition.requirements (stat: trust/frustration/spoons), więc
//   "Tydzień stabilizacji" patrzy na co innego niż "Trudna rozmowa".
//
// Ten moduł NIE zmienia mechaniki weeklyChallengeSystem (ocena
// sukces/porażka, nagrody i kary działają jak dotąd) — w v0.52 ślad
// wpływa wyłącznie na tekst i prezentację (poranek + weekly summary).

// --------------------------------------------------------------------
// Stałe
// --------------------------------------------------------------------

const MARK_LABELS = {
  1: "dobry ślad",
  0: "neutralny ślad",
  "-1": "kosztowny ślad"
};

const TONE_GOOD = "dobry";
const TONE_STEADY = "stabilny";
const TONE_FRAGILE = "kruchy";

// --------------------------------------------------------------------
// Stan (lazy-init, zero zmian saveVersion)
// --------------------------------------------------------------------

export function ensureWeeklyTrackingState(state) {
  if (!state || !state.weeklyChallenge) {
    return null;
  }

  const weeklyState = state.weeklyChallenge;
  const active = weeklyState.active || null;

  if (!weeklyState.tracking || typeof weeklyState.tracking !== "object") {
    weeklyState.tracking = buildFreshTracking(active);
    return weeklyState.tracking;
  }

  // Nowa Stawka (inny id/dueDay) => nowy, pusty ślad. Weekly summary
  // czyta tracking SUROWO (bez ensure), więc zdąży pokazać stary tydzień
  // zanim pierwszy poranek nowego tygodnia wywoła ten reset.
  if (active && (weeklyState.tracking.challengeId !== active.id || weeklyState.tracking.dueDay !== active.dueDay)) {
    weeklyState.tracking = buildFreshTracking(active);
  }

  if (!Array.isArray(weeklyState.tracking.dailyMarks)) {
    weeklyState.tracking.dailyMarks = [];
  }

  return weeklyState.tracking;
}

function buildFreshTracking(active) {
  return {
    challengeId: active ? active.id : null,
    weekStartedDay: active ? active.weekStartDay : null,
    dueDay: active ? active.dueDay : null,
    focus: active ? deriveFocus(active) : [],
    dailyMarks: [],
    lastEvaluatedDay: null
  };
}

// Focus Stawki = zestaw statystyk z jej warunku (trust/frustration/
// spoons). To wystarcza jako "typ" — bez dopisywania tagów do puli.
function deriveFocus(challenge) {
  const requirements = challenge && challenge.condition && Array.isArray(challenge.condition.requirements)
    ? challenge.condition.requirements
    : [];

  const focus = [];
  requirements.forEach((requirement) => {
    if (requirement && requirement.stat && !focus.includes(requirement.stat)) {
      focus.push(requirement.stat);
    }
  });

  return focus;
}

// --------------------------------------------------------------------
// Ocena domkniętego dnia — wołana z dayCycle.advanceToNextDay,
// PRZED inkrementem dnia i rozliczeniem fatigue.
// --------------------------------------------------------------------

export function recordWeeklyTrackingMark(state) {
  const tracking = ensureWeeklyTrackingState(state);
  if (!tracking || !tracking.challengeId) {
    return null;
  }

  const completedDay = state.day;

  // Guard podwójnej oceny: jeden dzień = maksymalnie jeden ślad.
  if (tracking.lastEvaluatedDay === completedDay) {
    return null;
  }

  // Dni spoza okna Stawki (teoretycznie niemożliwe, ale defensywnie).
  if (tracking.weekStartedDay !== null && completedDay < tracking.weekStartedDay) {
    return null;
  }

  const mark = evaluateDayMark(state, tracking, completedDay);
  tracking.dailyMarks.push(mark);
  tracking.lastEvaluatedDay = completedDay;

  return mark;
}

function evaluateDayMark(state, tracking, completedDay) {
  const focus = tracking.focus || [];

  const spoons = state.resources && state.resources.spoons ? state.resources.spoons : {};
  const endSpoons = Number(spoons.current) || 0;
  const maxSpoons = Number(spoons.max) || 10;
  const fatigue = state.resources && state.resources.fatigue
    ? Number(state.resources.fatigue.current) || 0
    : 0;

  const conflictState = state.partner && state.partner.conflict
    ? state.partner.conflict.state
    : "calm";

  const evening = state.lastEveningRecovery && state.lastEveningRecovery.day === completedDay
    ? state.lastEveningRecovery
    : null;
  const eveningType = evening ? evening.type : null;

  // Suma dzisiejszych konsekwencji z logu (wybory eventów dnia).
  let dayTrustChange = 0;
  let dayFrustrationChange = 0;
  (Array.isArray(state.log) ? state.log : []).forEach((entry) => {
    if (entry && entry.day === completedDay && entry.consequences) {
      dayTrustChange += Number(entry.consequences.trustChange) || 0;
      dayFrustrationChange += Number(entry.consequences.frustrationChange) || 0;
    }
  });

  // 5 prostych heurystyk, ważonych przez focus Stawki. Wynik: suma
  // punktów -> clamp do -1/0/+1. Priorytet powodu = kolejność sprawdzeń
  // (pierwszy trafiony pisze notkę).
  let score = 0;
  let note = null;
  let source = "day";

  const say = (points, reasonNote, reasonSource) => {
    score += points;
    if (!note) {
      note = reasonNote;
      source = reasonSource;
    }
  };

  // 1. Relacyjny focus: czy dzień dokładał do relacji, czy z niej brał.
  if (focus.includes("trust") || focus.includes("frustration")) {
    if (conflictState === "critical" || conflictState === "fight") {
      say(-1, "Napięcie prowadziło ten dzień, nie ty.", "conflict");
    }
    if (eveningType === "repair" || eveningType === "connection") {
      say(1, "Wieczór poszedł w kontakt, nie w ucieczkę.", "evening");
    }
    if (dayTrustChange >= 2) {
      say(1, "Dzień dołożył coś do relacji zamiast tylko z niej brać.", "choices");
    } else if (dayTrustChange <= -2 || dayFrustrationChange >= 4) {
      say(-1, "Relacja zapłaciła dziś więcej, niż dostała.", "choices");
    }
  }

  // 2. Focus na spoons/wytrzymałość: jak domknął się dzień.
  if (focus.includes("spoons")) {
    if (endSpoons <= 0) {
      say(-1, "Dzień skończył się na zerze. Stawka tego nie lubi.", "spoons");
    } else if (endSpoons >= Math.ceil(maxSpoons / 2)) {
      say(1, "Dzień domknięty z zapasem — rzadka waluta.", "spoons");
    }
    if (fatigue >= 4) {
      say(-1, "Zmęczenie rośnie szybciej niż tydzień.", "fatigue");
    }
    if (eveningType === "sleep" || eveningType === "rest") {
      say(1, "Odpoczynek jako decyzja, nie kapitulacja.", "evening");
    }
  }

  // 3. Uniwersalnie: przygotowanie pracuje na wynik...
  if (eveningType === "preparation") {
    say(1, "Wieczór poszedł w przygotowanie zamiast w dryf.", "evening");
  }

  // 4. ...a unik zawsze zostawia rachunek na później.
  if (eveningType === "avoidance") {
    say(-1, "Wieczór uciekł w unik. Stawka to zapamięta.", "evening");
  }

  const value = score > 0 ? 1 : score < 0 ? -1 : 0;

  return {
    day: completedDay,
    value,
    label: MARK_LABELS[String(value)] || MARK_LABELS["0"],
    note: note || "Zwykły dzień. Ani kroku bliżej, ani dalej.",
    source
  };
}

// --------------------------------------------------------------------
// Odczyty do UI (czyste — zero mutacji, zero zapisu)
// --------------------------------------------------------------------

export function getWeeklyTrackingTone(tracking) {
  if (!tracking || !Array.isArray(tracking.dailyMarks) || tracking.dailyMarks.length === 0) {
    return null;
  }

  const sum = tracking.dailyMarks.reduce((acc, mark) => acc + (Number(mark.value) || 0), 0);
  const average = sum / tracking.dailyMarks.length;

  if (average >= 0.4) {
    return TONE_GOOD;
  }
  if (average <= -0.4) {
    return TONE_FRAGILE;
  }
  return TONE_STEADY;
}

// Krótka linia do sidebara ("Ślad tygodnia: ...") albo null, gdy nie ma
// jeszcze żadnego śladu.
export function buildTrackingHorizonLine(state) {
  const tracking = state && state.weeklyChallenge ? state.weeklyChallenge.tracking : null;
  const tone = getWeeklyTrackingTone(tracking);

  if (!tone) {
    return null;
  }

  return { label: "Ślad tygodnia", value: tone };
}

// Karteczka porannego sygnału — TYLKO gdy ślad jest wyraźny (>=2 dni
// i ton skrajny). Zwraca obiekt zgodny z buildMorningSignals z v0.50
// albo null. Nie zwiększa limitu 3 widocznych sygnałów — konkuruje
// priorytetem jak każdy inny sygnał.
export function buildTrackingMorningSignal(state) {
  const tracking = state && state.weeklyChallenge ? state.weeklyChallenge.tracking : null;
  if (!tracking || !Array.isArray(tracking.dailyMarks) || tracking.dailyMarks.length < 2) {
    return null;
  }

  const tone = getWeeklyTrackingTone(tracking);

  if (tone === TONE_FRAGILE) {
    return {
      id: "weekly-trace-fragile",
      title: "Ślad tygodnia",
      type: "weekly",
      priority: 47,
      text: "Stawka tygodnia wisi w tle, a większość dni kończy się gaszeniem pożarów."
    };
  }

  if (tone === TONE_GOOD) {
    return {
      id: "weekly-trace-good",
      title: "Ślad tygodnia",
      type: "weekly",
      priority: 33,
      text: "Ten tydzień ma na razie powtarzalny rytm troski o konsekwencje. Trzymaj go."
    };
  }

  return null;
}

// Podsumowanie śladu dla weekly summary: ton + zdanie + max 3
// najważniejsze ślady (sort po |value|, potem chronologicznie).
// Czyta tracking SUROWO (bez ensure/resetu) — na ekranie podsumowania
// aktywna jest już NOWA Stawka, a pokazać trzeba ślad STAREJ.
export function buildWeeklyTraceSummary(state, summaryStartDay, summaryEndDay) {
  const tracking = state && state.weeklyChallenge ? state.weeklyChallenge.tracking : null;
  if (!tracking || !Array.isArray(tracking.dailyMarks)) {
    return null;
  }

  const marks = tracking.dailyMarks.filter(
    (mark) => mark && mark.day >= summaryStartDay && mark.day <= summaryEndDay
  );

  if (marks.length === 0) {
    return null;
  }

  const sum = marks.reduce((acc, mark) => acc + (Number(mark.value) || 0), 0);
  const average = sum / marks.length;
  const tone = average >= 0.4 ? TONE_GOOD : average <= -0.4 ? TONE_FRAGILE : TONE_STEADY;

  let text;
  if (tone === TONE_GOOD) {
    text = "Ten tydzień nie był lekki, ale miał powtarzalny rytm troski o konsekwencje.";
  } else if (tone === TONE_FRAGILE) {
    text = "Stawka tygodnia wisiała w tle, ale większość dni kończyła się gaszeniem pożarów.";
  } else {
    text = "Kilka razy udało się wybrać mądrzej, kilka razy system wracał do starych skrótów.";
  }

  const topMarks = [...marks]
    .sort((a, b) => {
      const weight = Math.abs(Number(b.value) || 0) - Math.abs(Number(a.value) || 0);
      return weight !== 0 ? weight : a.day - b.day;
    })
    .slice(0, 3);

  return { tone, text, topMarks, markCount: marks.length };
}
