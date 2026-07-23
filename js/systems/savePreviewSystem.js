// savePreviewSystem.js
//
// v0.60: Continue Run UX & Save Reliability.
//
// Czysty, READ-ONLY podgląd zapisu dla menu głównego. Zero mutacji,
// zero lazy-init, zero importów z systemów, które przy pierwszym
// wywołaniu coś tworzą (fatigueSystem/dayAgendaSystem/criticalEventSystem/
// weeklyChallengeSystem WSZYSTKIE mają funkcje ensure*/get* które przy
// okazji inicjalizują stan — bezpieczne na AKTYWNYM stanie gry, ale
// NIE na obiekcie, który dopiero jest OGLĄDANY w menu, zanim gracz
// zdecyduje się kontynuować). Ten plik czyta WYŁĄCZNIE surowe pola
// obiektu stanu — żadnych wywołań ensure*/get* z innych systemów.
//
// Dlatego świadomie duplikuje kilka drobnych obliczeń (np. countdown
// Wielkiego Testu) zamiast importować systemy, które by je policzyły —
// to jest cena bycia w 100% bezpiecznym do wywołania na dowolnym,
// jeszcze nie załadowanym zapisie.

const PHASE_LABELS = {
  mainMenu: "Menu",
  menu: "Menu",
  characterCreator: "Tworzenie postaci",
  "character-creator": "Tworzenie postaci",
  morning: "Poranek",
  game: "Poranek",
  agenda: "Plan dnia",
  event: "Wydarzenie",
  reflection: "Refleksja",
  evening: "Wieczór",
  weeklySummary: "Podsumowanie tygodnia",
  monthSummary: "Podsumowanie miesiąca",
  relationshipEnd: "Koniec relacji",
  "relationship-end": "Koniec relacji",
  soloRecovery: "Osobno",
  "solo-recovery": "Osobno",
  achievements: "Osiągnięcia"
};

const MONTH_ORDINALS = { 1: "pierwszy", 2: "drugi", 3: "trzeci", 4: "czwarty", 5: "piąty", 6: "szósty" };

// --------------------------------------------------------------------
// Ludzka nazwa fazy — nigdy nie crashuje, nieznana faza dostaje
// spokojny opis zamiast surowego stringa.
// --------------------------------------------------------------------

export function humanizePhase(phase) {
  if (typeof phase !== "string" || !phase) {
    return "Niepewny moment dnia";
  }
  return PHASE_LABELS[phase] || "Niepewny moment dnia";
}

// --------------------------------------------------------------------
// Walidacja — łagodna. Stare zapisy bez nowych lazy-init pól
// (dayTexture/narrativeMemory/relationshipModel.consequence/
// monthProgress) SĄ poprawne — te systemy inicjalizują się same przy
// pierwszym użyciu.
// --------------------------------------------------------------------

export function validateSaveForContinue(savedState) {
  const reasons = [];

  if (!savedState || typeof savedState !== "object") {
    return { valid: false, reasons: ["missing-object"] };
  }

  if (!savedState.player || typeof savedState.player !== "object") {
    reasons.push("missing-player");
  }

  if (!savedState.resources || !savedState.resources.spoons || typeof savedState.resources.spoons.current !== "number") {
    reasons.push("missing-spoons");
  }

  if (typeof savedState.day !== "number") {
    reasons.push("missing-day");
  }

  if (typeof savedState.phase !== "string") {
    reasons.push("missing-phase");
  }

  // Partner powinien istnieć w praktyce zawsze (solo NIE usuwa
  // state.partner — patrz soloRecoverySystem.js#enterSoloRecovery,
  // które tylko archiwizuje historię, partner zostaje w state). Brak
  // partnera to sygnał naprawdę starego/niepełnego zapisu.
  if (!savedState.partner || typeof savedState.partner !== "object") {
    reasons.push("missing-partner");
  }

  // log musi być tablicą LUB nie istnieć wcale (traktowane jak pusta).
  if (savedState.log !== undefined && !Array.isArray(savedState.log)) {
    reasons.push("invalid-log");
  }

  return { valid: reasons.length === 0, reasons };
}

export function buildSaveHealthMessage(savedState) {
  const result = validateSaveForContinue(savedState);
  if (result.valid) {
    return null;
  }
  return "Zapis wygląda na uszkodzony. Możesz zacząć nową grę, ale stary zapis nie został usunięty.";
}

// --------------------------------------------------------------------
// Resume routing — WYŁĄCZNIE odczyt surowych pól, zero wywołań
// ensure*/get* z dayAgendaSystem/criticalEventSystem/itd. (patrz
// nagłówek pliku). Konserwatywny fallback: nieznana sytuacja -> "game".
// --------------------------------------------------------------------

export function getResumeScreenName(savedState) {
  if (!savedState || typeof savedState !== "object") {
    return "mainMenu";
  }

  // Miesięczne podsumowanie: jedyny WIARYGODNY sygnał to
  // monthlyLoop.pendingSummary — state.phase NIGDY nie przyjmuje
  // dosłownie "monthSummary" w realnym flow (weeklySummaryScreen.js
  // nawiguje tam przez showScreen, nie przez zmianę phase). Czytamy
  // to pole surowo, bez importu monthlyLoopSystem.js.
  if (savedState.monthlyLoop && savedState.monthlyLoop.pendingSummary) {
    return "monthSummary";
  }

  const phase = savedState.phase;

  // Dosłowna wartość "weeklySummary" — defensywnie, na wypadek gdyby
  // kiedyś zaczęła być zapisywana wprost.
  if (phase === "weeklySummary") {
    return "weeklySummary";
  }

  // Heurystyka dla realnego flow: eveningScreen.js zapisuje stan z
  // phase="morning" TUŻ PRZED nawigacją do weeklySummary, na dniu
  // kończącym tydzień (completedDay % 7 === 0, patrz
  // weeklySummarySystem.js#shouldShowWeeklySummary). Jeśli dzień
  // zapisu odpowiada dokładnie takiemu momentowi, wracamy tam, gdzie
  // gracz naprawdę był.
  //
  // DWA FAŁSZYWE POZYTYWY, które trzeba wykluczyć PRZED heurystyką:
  //
  // 1) Miesiąc właśnie się skończył. monthSummaryScreen.js#CTA robi
  //    advanceToNextMonth(state) -> saveGame(state) -> showScreen("game").
  //    advanceToNextMonth ustawia monthProgress.monthStartDay =
  //    state.day (patrz monthlyLoopSystem.js) — a poprzedni miesiąc
  //    ZAWSZE kończy się na dniu podzielnym przez 7 (Wielki Test to
  //    28-dniowy cykl, 28 % 7 === 0), więc completedDay = state.day-1
  //    fałszywie wygląda jak koniec tygodnia. Rozpoznajemy ten
  //    dokładny moment: jesteśmy na PIERWSZYM dniu nowego miesiąca
  //    (day === monthStartDay), miesiąc TEN NUMER już pokazał swoje
  //    podsumowanie (lastSummaryMonth === currentMonth - 1), i nic nie
  //    jest już pending — to jednoznacznie "właśnie wyszliśmy z month
  //    summary", nie "właśnie mamy zobaczyć weekly summary".
  //
  // 2) Gracz już przeszedł przez TĘ KONKRETNĄ weekly summary i wrócił
  //    do gry (bez zmiany dnia — weeklySummaryScreen.js nie woła
  //    advanceToNextDay, tylko nawiguje dalej). continueUX.
  //    lastExitedWeeklySummaryCompletedDay zapisuje, dla którego
  //    completedDay gracz realnie kliknął CTA wyjścia (patrz
  //    weeklySummaryScreen.js#buildFooter) — jeśli to ten sam dzień,
  //    NIE wracamy do ekranu, który już zamknął.
  if (phase === "morning" || phase === "game") {
    const monthProgress = savedState.monthProgress;
    const noPendingMonth = !(savedState.monthlyLoop && savedState.monthlyLoop.pendingSummary);
    const justExitedMonthSummary =
      monthProgress &&
      savedState.day === monthProgress.monthStartDay &&
      monthProgress.lastSummaryMonth === monthProgress.currentMonth - 1 &&
      noPendingMonth;

    if (justExitedMonthSummary) {
      return "game";
    }

    const completedDay = (typeof savedState.day === "number" ? savedState.day : 1) - 1;
    const alreadyExitedThisWeeklySummary =
      savedState.continueUX &&
      savedState.continueUX.lastExitedWeeklySummaryCompletedDay === completedDay;

    if (completedDay > 0 && completedDay % 7 === 0 && !alreadyExitedThisWeeklySummary) {
      return "weeklySummary";
    }
    return "game";
  }

  if (phase === "event") {
    if (savedState.currentEventId) {
      return "event";
    }
    if (hasRemainingAgendaItemsRaw(savedState)) {
      return "agenda";
    }
    return "game";
  }

  if (phase === "reflection") {
    if (Array.isArray(savedState.log) && savedState.log.length > 0) {
      return "reflection";
    }
    if (hasRemainingAgendaItemsRaw(savedState)) {
      return "agenda";
    }
    return "game";
  }

  if (phase === "evening") {
    return "evening";
  }

  if (phase === "relationshipEnd" || phase === "relationship-end") {
    return "relationshipEnd";
  }

  if (phase === "soloRecovery" || phase === "solo-recovery") {
    return "soloRecovery";
  }

  // Nieznana faza — bezpieczny fallback, zero crasha.
  return "game";
}

function hasRemainingAgendaItemsRaw(savedState) {
  return Boolean(
    savedState.dailyAgenda &&
    Array.isArray(savedState.dailyAgenda.slots) &&
    savedState.dailyAgenda.slots.some((item) => item && !item.completed)
  );
}

// --------------------------------------------------------------------
// Podgląd — 2-4 krótkie linie, zero JSON, zero liczb technicznych
// (poza spoons current/max, które są celowo widoczne — to fizyczny
// zasób gracza, nie wewnętrzny modifier).
// --------------------------------------------------------------------

export function buildSavePreview(savedState) {
  const validation = validateSaveForContinue(savedState);
  if (!validation.valid) {
    return null;
  }

  const day = savedState.day;
  const monthNumber = savedState.monthProgress && typeof savedState.monthProgress.currentMonth === "number"
    ? savedState.monthProgress.currentMonth
    : 1;
  const monthLabel = MONTH_ORDINALS[monthNumber] ? `Miesiąc ${MONTH_ORDINALS[monthNumber]}` : `Miesiąc ${monthNumber}`;
  const phaseLabel = humanizePhase(savedState.phase);

  const headline = `Dzień ${day} · ${monthLabel} · ${phaseLabel}`;

  const spoons = savedState.resources.spoons;
  const fatigueLine = buildFatigueLine(savedState);
  const spoonsLine = fatigueLine
    ? `Łyżeczki: ${spoons.current}/${spoons.max} · ${fatigueLine}`
    : `Łyżeczki: ${spoons.current}/${spoons.max}`;

  const relationshipLine = buildRelationshipLine(savedState);
  const horizonLine = buildHorizonLine(savedState);
  const lastTraceLine = buildLastRunTrace(savedState);

  const lines = [spoonsLine, relationshipLine, horizonLine, lastTraceLine].filter(Boolean).slice(0, 3);

  return { headline, lines };
}

function buildFatigueLine(savedState) {
  const fatigue = savedState.resources && savedState.resources.fatigue && typeof savedState.resources.fatigue.current === "number"
    ? savedState.resources.fatigue.current
    : null;
  if (fatigue === null) return null;

  if (fatigue >= 5) return "ciało już dawno przekroczyło budżet";
  if (fatigue >= 3) return "ciało już nalicza odsetki";
  if (fatigue >= 1) return "lekkie zmęczenie w tle";
  return "ciało w miarę wypoczęte";
}

function buildRelationshipLine(savedState) {
  const npc = savedState.partner && savedState.npcs ? savedState.npcs[savedState.partner.id] : null;
  const trust = npc && typeof npc.trust === "number" ? npc.trust : null;
  const frustration = npc && typeof npc.frustration === "number" ? npc.frustration : null;
  const conflictState = savedState.partner && savedState.partner.conflict ? savedState.partner.conflict.state : null;

  if (conflictState === "fight" || conflictState === "critical") {
    return "Relacja: napięta, nie ma co udawać inaczej.";
  }
  if (trust === null && frustration === null) {
    return null;
  }
  if (trust !== null && trust >= 60 && (frustration === null || frustration <= 40)) {
    return "Relacja: stabilna, ma gdzie oddychać.";
  }
  if (trust !== null && trust <= 35) {
    return "Relacja: krucha, zaufanie potrzebuje uwagi.";
  }
  return "Relacja: stabilna, ale nie lekka.";
}

function buildHorizonLine(savedState) {
  const critical = savedState.criticalEvent && savedState.criticalEvent.active;
  if (critical && typeof critical.dueDay === "number" && typeof savedState.day === "number") {
    const daysLeft = Math.max(0, critical.dueDay - savedState.day + 1);
    if (daysLeft <= 10) {
      return `Na horyzoncie: Wielki Test za ${daysLeft} ${dayWord(daysLeft)}.`;
    }
  }

  const weekly = savedState.weeklyChallenge && savedState.weeklyChallenge.active;
  if (weekly && typeof weekly.dueDay === "number" && typeof savedState.day === "number") {
    const daysLeft = Math.max(0, weekly.dueDay - savedState.day + 1);
    if (daysLeft <= 3) {
      return `Na horyzoncie: Stawka tygodnia za ${daysLeft} ${dayWord(daysLeft)}.`;
    }
  }

  const texture = savedState.dayTexture && savedState.dayTexture.current;
  if (texture && texture.line) {
    return texture.line;
  }

  return null;
}

function dayWord(n) {
  if (n === 1) return "dzień";
  if (n >= 2 && n <= 4) return "dni";
  return "dni";
}

/**
 * Ostatni zapisany rezultat z logu, skrócony do jednego zdania.
 */
export function buildLastRunTrace(savedState) {
  if (!Array.isArray(savedState.log) || savedState.log.length === 0) {
    return null;
  }
  const lastEntry = savedState.log[savedState.log.length - 1];
  if (!lastEntry || typeof lastEntry.resultText !== "string" || !lastEntry.resultText) {
    return null;
  }

  const firstSentence = lastEntry.resultText.split(/(?<=[.!?])\s+/)[0] || lastEntry.resultText;
  const trimmed = firstSentence.length > 110 ? `${firstSentence.slice(0, 107)}...` : firstSentence;
  return `Ostatnio: ${trimmed}`;
}
