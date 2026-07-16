// datingArcSystem.js
//
// v0.44: Dating Arc / New Connection Foundation.
//
// Krótki etap MIĘDZY solo recovery a pełną nową relacją. TO NIE JEST
// dating sim — nie ma katalogu kandydatów, nie ma paska "zdobądź
// zainteresowanie". To symulacja wchodzenia w kontakt po rozstaniu:
// czy mam na to siłę, czy zachowuję granice, czy nie uciekam od
// poprzedniej relacji, czy umiem nie maskować, czy nowa relacja
// zaczyna się wolno czy kompulsywnie.
//
// Struktura: relacja -> rozpad -> solo recovery -> DATING ARC -> nowa
// relacja -> normalny gameplay. Karta "Możliwość nowej relacji" (patrz
// gameScreen.js) już NIE tworzy partnera od razu — odpala ten system
// (stage="signal"). Partner powstaje dopiero na końcu, w stage
// "define-relationship", i tylko przy wyborze "wejść powoli"/"wejść za
// szybko" — przez startNewRelationshipFromProspect() w
// newRelationshipSeedSystem.js (reużywa CAŁEJ bezpiecznej logiki:
// archiwizacja, relationship model, baggage, resety — ta sama ścieżka
// co stary skrót devTools, tylko z konkretnym prospectem zamiast
// losowego kandydata).
//
// Ten moduł NIE zmienia spoons/trust/frustration bezpośrednio, NIE
// dotyka eventSystem.js/weeklySummaryScreen.js.

import { startNewRelationshipFromProspect } from "./newRelationshipSeedSystem.js?v=440";

const MAX_HISTORY = 30;

const STAGE_ORDER = ["signal", "conversation", "boundary-check", "first-meeting", "define-relationship"];

const STAGE_TITLES = {
  signal: "Sygnał",
  conversation: "Rozmowa",
  "boundary-check": "Granice",
  "first-meeting": "Spotkanie",
  "define-relationship": "Decyzja"
};

// Prospect NIE jest samym imieniem — ma komunikacyjny styl, intencję,
// green/red flag i kontrast wobec poprzedniej relacji. Cztery różne
// archetypy (tempo slow/medium/fast) dają realnie różne "wyczucie"
// wejścia w kontakt, nie tylko inne imię.
const PROSPECT_POOL = [
  {
    id: "kuba",
    name: "Kuba",
    pronouns: "on/jego",
    roleLabel: "ktoś nowy",
    communicationStyle: "pisze rzadko, ale konkretnie",
    relationalIntent: "chce iść powoli, ale szczerze",
    greenFlag: "pyta o granice, zanim je przekroczy",
    redFlag: "czasem znika na kilka dni bez słowa",
    contrastToPreviousRelationship: "mniej intensywny, więcej ciszy",
    pace: "slow",
    firstImpressionText: "Nie próbuje być zabawny na siłę. Pyta więcej, niż mówi."
  },
  {
    id: "ada",
    name: "Ada",
    pronouns: "ona/jej",
    roleLabel: "ktoś nowy",
    communicationStyle: "pisze dużo i szybko",
    relationalIntent: "chce już wiedzieć, czy to coś poważnego",
    greenFlag: "mówi wprost, czego oczekuje",
    redFlag: "chce widywać się codziennie od pierwszego tygodnia",
    contrastToPreviousRelationship: "szybsza, głośniejsza, mniej przestrzeni",
    pace: "fast",
    firstImpressionText: "Odpisuje w minutę. Entuzjazm, o który jeszcze nie prosiłeś/aś."
  },
  {
    id: "tomek",
    name: "Tomek",
    pronouns: "on/jego",
    roleLabel: "ktoś nowy",
    communicationStyle: "unika konkretów, zostaje przy żartach",
    relationalIntent: "nie do końca wie, czego chce",
    greenFlag: "nie naciska na spotkanie",
    redFlag: "zmienia temat, gdy robi się poważnie",
    contrastToPreviousRelationship: "lżejszy, ale trudniej się do niego dostać",
    pace: "slow",
    firstImpressionText: "Rozmowa płynie łatwo. Za łatwo, żeby wiedzieć, co jest pod spodem."
  },
  {
    id: "zoe",
    name: "Zoe",
    pronouns: "ona/jej",
    roleLabel: "ktoś nowy",
    communicationStyle: "pyta wprost, czego dziś potrzebujesz",
    relationalIntent: "otwarcie mówi, że nigdzie się nie spieszy",
    greenFlag: "pyta wprost, czego chcesz, zamiast się domyślać",
    redFlag: "głośno porównuje cię do poprzednich osób",
    contrastToPreviousRelationship: "więcej pytań, mniej założeń",
    pace: "medium",
    firstImpressionText: "Zamiast się domyślać, po prostu pyta. To rzadkie."
  }
];

// Wybory per etap — max 3, bez kosztów, bez przewidywanych efektów
// liczbowych w tekście. "effects" są WEWNĘTRZNE (nigdy pokazywane
// graczowi jako liczba).
const STAGE_CHOICES = {
  signal: [
    {
      id: "notice_and_wait",
      title: "Zauważyć, ale nie odpisywać od razu",
      text: "Dać sobie chwilę, zanim cokolwiek odpowiesz.",
      effects: { curiosity: 1 },
      resultText: "Ciekawość nie musi być obsłużona natychmiast."
    },
    {
      id: "notice_and_respond",
      title: "Odpisać od razu, mimo przeciążenia",
      text: "Odpowiedzieć, chociaż dzień już kosztował.",
      effects: { curiosity: 2, pacePressure: 1 },
      resultText: "Szybka odpowiedź. Trochę szybsza, niż było w planie."
    }
  ],
  conversation: [
    {
      id: "be_honest_about_timing",
      title: "Nazwać, że jesteś po rozstaniu",
      text: "Powiedzieć to wprost, zamiast zakładać, że i tak wyjdzie.",
      effects: { compatibilitySignal: 2, pacePressure: -1 },
      resultText: "Prawda o punkcie startu nie odstrasza od razu."
    },
    {
      id: "play_lightness",
      title: "Zagrać lekkość, choć jej nie czujesz",
      text: "Utrzymać żartobliwy ton, żeby niczego nie komplikować.",
      effects: { curiosity: 1, redFlags: 0 },
      resultText: "Lekkość działa. Przynajmniej na zewnątrz."
    },
    {
      id: "ask_about_pace",
      title: "Zapytać o tempo",
      text: "Zapytać wprost, jak druga strona widzi tempo tego kontaktu.",
      effects: { compatibilitySignal: 1, pacePressure: -1 },
      resultText: "Pytanie o tempo nie jest wymaganiem. Jest mapą."
    }
  ],
  "boundary-check": [
    {
      id: "name_own_boundary",
      title: "Nazwać, czego dziś nie masz siły robić",
      text: "Powiedzieć, gdzie jest dzisiejsza granica, zamiast przekraczać ją po cichu.",
      effects: { compatibilitySignal: 2 },
      resultText: "Granica nazwana na głos waży inaczej niż domyślana."
    },
    {
      id: "push_through_tiredness",
      title: "Zignorować zmęczenie i przyspieszyć",
      text: "Iść dalej, chociaż ciało już protestuje.",
      effects: { pacePressure: 2, redFlags: 1 },
      resultText: "Tempo przyspiesza. Jeszcze nie wiadomo, kosztem czego."
    },
    {
      id: "ask_their_boundary",
      title: "Zapytać o ich granice",
      text: "Zapytać, czego druga strona dziś nie ma siły robić.",
      effects: { compatibilitySignal: 1 },
      resultText: "Pytanie w drugą stronę też jest informacją."
    }
  ],
  "first-meeting": [
    {
      id: "meet_without_masking",
      title: "Spotkać się bez grania roli",
      text: "Pokazać się takim/taką, jaki/a jesteś dzisiaj, nie wersją na pokaz.",
      effects: { compatibilitySignal: 2 },
      resultText: "Nikt nie musiał dziś nikogo udawać."
    },
    {
      id: "meet_but_perform",
      title: "Spotkać się, ale zagrać wersję, która się podoba",
      text: "Pokazać stronę, która najbardziej się sprzedaje.",
      effects: { curiosity: 1, redFlags: 1 },
      resultText: "Wersja na pokaz podobała się. Trochę nieznajomej osobie."
    },
    {
      id: "postpone_meeting",
      title: "Przełożyć spotkanie",
      text: "Dać sobie i drugiej stronie więcej czasu przed spotkaniem.",
      effects: { pacePressure: -1 },
      resultText: "Odłożenie nie jest odmową. Jest tempem."
    }
  ],
  "define-relationship": [
    {
      id: "enter_slow",
      title: "Wejść powoli",
      text: "Zacząć relację, nazywając tempo, którego potrzebujesz.",
      terminal: "enter",
      resultText: "Zaczyna się coś, co nie musi niczego udowadniać od razu."
    },
    {
      id: "enter_fast",
      title: "Wejść za szybko, żeby nie czuć pustki",
      text: "Wejść w to teraz, zanim zdążysz się zawahać.",
      terminal: "enter",
      resultText: "Zaczyna się szybko. Może za szybko, żeby to jeszcze ocenić."
    },
    {
      id: "not_yet",
      title: "Powiedzieć, że jeszcze nie teraz",
      text: "Poprosić o więcej czasu, zanim cokolwiek zostanie nazwane.",
      terminal: "wait",
      resultText: "Nie teraz nie znaczy nigdy. Znaczy dziś nie."
    },
    {
      id: "let_go",
      title: "Odpuścić bez robienia z tego porażki",
      text: "Zamknąć ten wątek, nie nazywając go błędem.",
      terminal: "release",
      resultText: "Nie każda możliwość musi zostać wykorzystana, żeby coś znaczyć."
    }
  ]
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.datingArc istnieje. Bezpieczne dla starych
 * zapisów (sprzed v0.44). Nie zmienia saveVersion.
 */
export function ensureDatingArcState(state) {
  if (!state) {
    return null;
  }

  if (!state.datingArc) {
    state.datingArc = {
      active: false,
      stage: "none",
      prospect: null,
      dayStarted: null,
      curiosity: 0,
      compatibilitySignal: 0,
      pacePressure: 0,
      redFlags: 0,
      readiness: 0,
      history: [],
      lastResult: null
    };
  }

  if (!Array.isArray(state.datingArc.history)) {
    state.datingArc.history = [];
  }

  return state.datingArc;
}

export function isDatingArcActive(state) {
  return !!(state && state.datingArc && state.datingArc.active === true);
}

function generateProspect(state) {
  const historyNames = Array.isArray(state.relationshipHistory)
    ? state.relationshipHistory.map((entry) => (entry && entry.partnerSnapshot ? entry.partnerSnapshot.name : null)).filter(Boolean)
    : [];
  const currentPartnerName = state.partner ? state.partner.name : null;
  const excluded = [...historyNames, currentPartnerName].filter(Boolean);

  const available = PROSPECT_POOL.filter((prospect) => !excluded.includes(prospect.name));
  const pool = available.length > 0 ? available : PROSPECT_POOL;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  return {
    id: `prospect_${picked.id}_${Date.now()}`,
    name: picked.name,
    pronouns: picked.pronouns,
    roleLabel: picked.roleLabel,
    communicationStyle: picked.communicationStyle,
    relationalIntent: picked.relationalIntent,
    greenFlag: picked.greenFlag,
    redFlag: picked.redFlag,
    contrastToPreviousRelationship: picked.contrastToPreviousRelationship,
    pace: picked.pace,
    firstImpressionText: picked.firstImpressionText
  };
}

/**
 * Wołane z gameScreen.js zamiast startNewRelationshipSeed() po
 * kliknięciu karty "Możliwość nowej relacji" — TWORZY prospect i
 * stage "signal", NIGDY partnera.
 */
export function startDatingArc(state, source = "solo-recovery") {
  const arc = ensureDatingArcState(state);
  if (!arc) {
    return null;
  }

  arc.active = true;
  arc.stage = "signal";
  arc.prospect = generateProspect(state);
  arc.dayStarted = state.day;
  arc.curiosity = 0;
  arc.compatibilitySignal = 0;
  arc.pacePressure = 0;
  arc.redFlags = 0;
  arc.readiness = 0;
  arc.lastResult = null;

  arc.history.push({ day: state.day, action: "start", prospectName: arc.prospect.name });
  cleanupHistory(arc);

  return arc;
}

// --------------------------------------------------------------------
// Wybory
// --------------------------------------------------------------------

/**
 * Zwraca 2-3 wybory dla AKTUALNEGO etapu. Zwraca [] jeśli dating arc
 * nie jest aktywny.
 */
export function getDatingArcChoices(state) {
  const arc = ensureDatingArcState(state);
  if (!arc || !arc.active) {
    return [];
  }

  return (STAGE_CHOICES[arc.stage] || []).map((choice) => ({ ...choice }));
}

/**
 * Aplikuje wybór gracza. Dla zwykłych etapów (signal/conversation/
 * boundary-check/first-meeting) przesuwa do następnego etapu. Dla
 * "define-relationship" rozstrzyga terminalnie:
 *   - "enter": startNewRelationshipFromProspect(), dating arc kończy
 *     się, wraca normalny gameplay z partnerem,
 *   - "wait" ("jeszcze nie teraz"): cofa o jeden etap (więcej czasu,
 *     zanim decyzja zostanie podjęta ponownie),
 *   - "release" ("odpuścić"): dating arc się kończy, WRACA solo
 *     recovery, NIE tworzy partnera, zapisuje lekcję.
 */
export function applyDatingArcChoice(state, choiceId) {
  const arc = ensureDatingArcState(state);
  if (!arc || !arc.active) {
    return { applied: false, reason: "Dating arc nie jest aktywny." };
  }

  const stageChoices = STAGE_CHOICES[arc.stage] || [];
  const choice = stageChoices.find((item) => item.id === choiceId);
  if (!choice) {
    return { applied: false, reason: "Nieznany wybór dating arc." };
  }

  const effects = choice.effects || {};
  arc.curiosity = clampStat((arc.curiosity || 0) + (effects.curiosity || 0));
  arc.compatibilitySignal = clampStat((arc.compatibilitySignal || 0) + (effects.compatibilitySignal || 0));
  arc.pacePressure = clampStat((arc.pacePressure || 0) + (effects.pacePressure || 0));
  arc.redFlags = clampStat((arc.redFlags || 0) + (effects.redFlags || 0));
  arc.readiness = clampStat(arc.compatibilitySignal - arc.redFlags);

  let outcome = "advanced";
  let newPartner = null;

  if (choice.terminal === "enter") {
    const result = startNewRelationshipFromProspect(state, arc.prospect, "dating-arc");
    if (result.started) {
      arc.active = false;
      arc.stage = "none";
      arc.lastResult = { applied: true, outcome: "entered", prospectName: arc.prospect.name };
      outcome = "entered";
      newPartner = result.partner;
    } else {
      // Bezpiecznik: jeśli z jakiegoś powodu nie da się utworzyć
      // partnera (np. brak state.player), nie crashujemy — dating arc
      // po prostu zostaje aktywny na tym samym etapie.
      outcome = "blocked";
      arc.lastResult = { applied: false, outcome: "blocked", reason: result.reason };
    }
  } else if (choice.terminal === "wait") {
    const currentIndex = STAGE_ORDER.indexOf(arc.stage);
    arc.stage = STAGE_ORDER[Math.max(0, currentIndex - 1)] || "first-meeting";
    arc.lastResult = { applied: true, outcome: "waiting", prospectName: arc.prospect.name };
    outcome = "waiting";
  } else if (choice.terminal === "release") {
    arc.active = false;
    arc.stage = "none";
    arc.lastResult = { applied: true, outcome: "released", prospectName: arc.prospect.name };
    outcome = "released";

    if (state.soloRecovery) {
      if (!Array.isArray(state.soloRecovery.lessons)) {
        state.soloRecovery.lessons = [];
      }
      if (!state.soloRecovery.lessons.includes("dating-arc-release")) {
        state.soloRecovery.lessons.push("dating-arc-release");
      }
    }
  } else {
    const currentIndex = STAGE_ORDER.indexOf(arc.stage);
    arc.stage = STAGE_ORDER[currentIndex + 1] || "define-relationship";
  }

  arc.history.push({
    day: state.day,
    stage: choice.terminal ? `${arc.stage}-resolved-${outcome}` : arc.stage,
    choiceId: choice.id,
    outcome
  });
  cleanupHistory(arc);

  return { applied: true, outcome, resultText: choice.resultText, newPartner };
}

/**
 * Przesuwa dzień gry o 1 — ten sam rytm "jeden wybór = jeden dzień"
 * co advanceSoloRecoveryDay() w soloRecoverySystem.js. Zwraca null,
 * jeśli dating arc nie jest (już) aktywny — bezpieczne wołanie po
 * terminalnym rozstrzygnięciu (enter/release), gdzie dzień i tak
 * przechodzi przez normalny flow.
 */
export function advanceDatingArcDay(state) {
  if (!state) {
    return null;
  }

  state.day += 1;
  state.phase = "morning";

  return state.datingArc || null;
}

// --------------------------------------------------------------------
// Prezentacja (nigdy liczb do UI gracza)
// --------------------------------------------------------------------

export function getDatingArcStageTitle(state) {
  const arc = ensureDatingArcState(state);
  if (!arc) {
    return "Dating Arc";
  }

  return STAGE_TITLES[arc.stage] || "Dating Arc";
}

/**
 * Krótka linia narracyjna dla aktualnego etapu. Na etapie "signal"
 * używa firstImpressionText prospecta — pierwsze wrażenie jest
 * bardziej konkretne niż ogólny opis etapu.
 */
export function buildDatingArcNarrativeLine(state) {
  const arc = ensureDatingArcState(state);
  if (!arc || !arc.active || !arc.prospect) {
    return "Ktoś pojawia się jako możliwość, nie jako rozwiązanie.";
  }

  if (arc.stage === "signal") {
    return arc.prospect.firstImpressionText;
  }

  const lines = {
    conversation: `Rozmowa z ${arc.prospect.name} balansuje między ciekawością a przeciążeniem.`,
    "boundary-check": `Wraca temat granic, tempa i dostępności — z ${arc.prospect.name} i z sobą.`,
    "first-meeting": `Spotkanie z ${arc.prospect.name} to też sprawdzian, ile z siebie dziś pokazujesz naprawdę.`,
    "define-relationship": `To moment decyzji: czy to, co jest z ${arc.prospect.name}, staje się relacją, czy zostaje możliwością.`
  };

  return lines[arc.stage] || "Coś między wami wciąż się układa.";
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie dating
 * arcu — active, stage, prospect, wszystkie liczniki, ostatnie 10
 * wpisów historii. Te dane NIGDY nie trafiają do UI gracza jako
 * liczby (w grze widać tylko etap, imię prospecta i paski).
 */
export function getDatingArcDebugSummary(state) {
  const arc = ensureDatingArcState(state);
  if (!arc) {
    return null;
  }

  return {
    active: arc.active,
    stage: arc.stage,
    prospect: arc.prospect,
    dayStarted: arc.dayStarted,
    curiosity: arc.curiosity,
    compatibilitySignal: arc.compatibilitySignal,
    pacePressure: arc.pacePressure,
    redFlags: arc.redFlags,
    readiness: arc.readiness,
    lastResult: arc.lastResult,
    recentHistory: arc.history.slice(-10)
  };
}

// --------------------------------------------------------------------
// DevTools
// --------------------------------------------------------------------

/**
 * Przesuwa dating arc o jeden etap w STAGE_ORDER, z pominięciem
 * logiki applyDatingArcChoice — wyłącznie do debugowania, żeby
 * szybko dojść do "define-relationship" bez klikania.
 */
export function forceAdvanceDatingArcStage(state) {
  const arc = ensureDatingArcState(state);
  if (!arc || !arc.active) {
    return null;
  }

  const currentIndex = STAGE_ORDER.indexOf(arc.stage);
  const nextStage = STAGE_ORDER[currentIndex + 1];
  if (nextStage) {
    arc.stage = nextStage;
    arc.history.push({ day: state.day, action: "debug-advance-stage", stage: nextStage });
    cleanupHistory(arc);
  }

  return arc;
}

/**
 * Resetuje dating arc do stanu nieaktywnego. NIE dotyka
 * state.soloRecovery ani state.partner.
 */
export function clearDatingArc(state) {
  const arc = ensureDatingArcState(state);
  if (!arc) {
    return null;
  }

  arc.active = false;
  arc.stage = "none";
  arc.prospect = null;
  arc.curiosity = 0;
  arc.compatibilitySignal = 0;
  arc.pacePressure = 0;
  arc.redFlags = 0;
  arc.readiness = 0;
  arc.lastResult = null;

  arc.history.push({ day: state.day, action: "debug-clear" });
  cleanupHistory(arc);

  return arc;
}

function cleanupHistory(arc) {
  if (arc.history.length > MAX_HISTORY) {
    arc.history = arc.history.slice(arc.history.length - MAX_HISTORY);
  }
}

function clampStat(value) {
  return Math.max(0, Math.min(20, Math.round(value)));
}
