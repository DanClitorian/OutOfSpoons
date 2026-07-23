// criticalEventSystem.js
//
// v0.20: Monthly Critical Event / Wielki Test Foundation.
//
// Drugi, dłuższy horyzont napięcia obok Weekly Stakes
// (weeklyChallengeSystem.js): zamiast 7-dniowego cyklu, tu jest
// 28-dniowy "miesięczny" cykl z jednym dużym wydarzeniem na horyzoncie.
// Architektura jest CELOWO bliźniacza do weeklyChallengeSystem.js
// (te same wzorce: pula szablonów, idempotentna ocena po dueDay,
// generowanie kolejnego po ocenie) — to dwa RÓŻNE systemy, przechowywane
// w osobnych polach stanu (state.weeklyChallenge vs state.criticalEvent)
// i NIE dzielą efektów mechanicznych:
//
//   Weekly Stakes:    +1 max spoons (cap 14) / -2 current spoons
//   Critical Events:  zmiana trust / frustration / current spoons
//                      (BEZ max spoons — to zastrzeżone dla Weekly Stakes)
//
// v0.25: Relationship Scars. Porażka w Wielkim Teście może dodatkowo
// zostawić trwały ślad w relacji — patrz applyScarFromCriticalResult()
// wołane wewnątrz evaluateCriticalEvent() PO ustaleniu porażki, PRZED
// zapisaniem lastResult. Idempotencja evaluateCriticalEvent() (guard
// na lastEvaluatedDueDay) automatycznie chroni też dodanie blizny —
// cały ten blok kodu wykonuje się dokładnie raz na dueDay.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w
// state.criticalEvent. Ekrany (weeklySummaryScreen.js, gameScreen.js)
// czytają z niego dane do wyświetlenia.

import { applyScarFromCriticalResult } from "./relationshipScarsSystem.js";

// --------------------------------------------------------------------
// Pula Wielkich Testów
// --------------------------------------------------------------------

const CRITICAL_EVENT_POOL = [
  {
    id: "family_visit",
    title: "Wizyta rodziny",
    description: "Za kilka tygodni trzeba będzie utrzymać spokój w sytuacji pełnej niewypowiedzianych oczekiwań.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 60 },
        { stat: "frustration", operator: "<=", value: 45 },
        { stat: "spoons", operator: ">=", value: 4 }
      ]
    },
    successText: "Nie było idealnie. Ale nie musiało być. Przeszliście przez to bez rozsadzania relacji od środka.",
    failureText: "Pytania rodziny zostały bez odpowiedzi, a milczenie zamieniło się w osobny temat do przegadania później."
  },
  {
    id: "work_deadline",
    title: "Deadline projektu",
    description: "Duży projekt w pracy zbliża się do finału i będzie chciał więcej, niż macie do oddania.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "frustration", operator: "<=", value: 50 }
      ]
    },
    successText: "Projekt poszedł, zanim zdążył się zamienić w katastrofę. Zmęczenie zostaje, ale bez wyrzutów sumienia.",
    failureText: "To nie był koniec świata. Bardziej rachunek z odsetkami, który przechodzi na kolejny miesiąc."
  },
  {
    id: "trip_together",
    title: "Wspólny wyjazd",
    description: "Zaplanowany wyjazd wymaga więcej niż wolnego czasu — wymaga bliskości, którą trzeba było odkładać przez cały miesiąc.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 65 },
        { stat: "spoons", operator: ">=", value: 5 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    },
    successText: "Wyjazd nie naprawił wszystkiego, ale dał wam coś, czego brakowało od tygodni: wspólny czas bez agendy.",
    failureText: "Wyjazd był, ale bliskości w nim zabrakło — wróciliście do domu bardziej zmęczeni niż wypoczęci."
  },
  {
    id: "moving_house",
    title: "Przeprowadzka",
    description: "Pakowanie całego życia do pudeł to test na cierpliwość, logistykę i to, ile jeszcze macie w sobie.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "trust", operator: ">=", value: 50 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    },
    successText: "Pudła się skończyły, a wy wciąż ze sobą rozmawiacie — to już jest coś.",
    failureText: "Przeprowadzka pochłonęła więcej z was, niż planowaliście oddać. Mieszkanie jest nowe, napięcie stare."
  },
  {
    id: "public_event",
    title: "Publiczne wydarzenie",
    description: "Trzeba będzie wyjść na duże wydarzenie towarzyskie i przez cały wieczór trzymać formę.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "frustration", operator: "<=", value: 50 },
        { stat: "trust", operator: ">=", value: 45 }
      ]
    },
    successText: "Udało się przejść przez wieczór bez zdejmowania maski w niewłaściwym momencie.",
    failureText: "Maska pękła gdzieś między trzecim toastem a niewygodnym pytaniem. Nikt tego nie nazwał, ale wszyscy poczuli."
  },
  {
    id: "future_conversation",
    title: "Rozmowa o przyszłości",
    description: "Temat, który odkładaliście z tygodnia na tydzień, w końcu domaga się rozmowy na głos.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 70 },
        { stat: "frustration", operator: "<=", value: 50 }
      ]
    },
    successText: "Rozmowa, której się baliście, okazała się mniej groźna niż tygodnie jej unikania.",
    failureText: "Temat wrócił, zawisł w powietrzu, i znowu nikt nie powiedział tego na głos."
  }
];

// v0.20: efekty są WSPÓLNE dla wszystkich wydarzeń w puli (tak jak
// reward/penalty w weeklyChallengeSystem.js) — łatwe do zbalansowania
// później per-wydarzenie, jeśli okaże się to potrzebne.
const SUCCESS_EFFECT = { trustChange: 8, frustrationChange: -6, spoonsChange: 2 };
const FAILURE_EFFECT = { trustChange: -8, frustrationChange: 8, spoonsChange: -3 };

const STAT_LABELS = {
  trust: "Zaufanie",
  frustration: "Frustracja",
  spoons: "Spoons"
};

const OPERATOR_SYMBOLS = {
  ">=": "≥",
  "<=": "≤",
  ">": ">",
  "<": "<",
  "==": "="
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.criticalEvent istnieje. Bezpieczne dla starych
 * zapisów (sprzed v0.20) — jeśli pole nie istnieje, tworzy je od zera,
 * nie nadpisuje istniejącego aktywnego wydarzenia. Naprawia brakującą
 * history, jeśli zapis jest stary/niepełny.
 */
export function ensureCriticalEventState(state) {
  if (!state.criticalEvent) {
    state.criticalEvent = {
      active: null,
      lastResult: null,
      lastEvaluatedDueDay: null,
      history: []
    };
  }

  if (!Array.isArray(state.criticalEvent.history)) {
    state.criticalEvent.history = [];
  }

  return state.criticalEvent;
}

/**
 * Generuje Wielki Test na nadchodzące 28 dni, jeśli nie ma już
 * aktywnego. Unika (jeśli to możliwe) powtórzenia id ostatnio
 * ocenionego wydarzenia. dueDay = arcStartDay + 27 (28-dniowy cykl,
 * licząc dzień startu włącznie — jeśli wygeneruje się dnia 1, test
 * wypada dnia 28, dokładnie jak w specyfikacji).
 */
export function generateNextCriticalEvent(state) {
  const criticalState = ensureCriticalEventState(state);

  if (criticalState.active) {
    return criticalState.active;
  }

  const arcStartDay = state.day;
  const dueDay = arcStartDay + 27;

  const previousId = criticalState.lastResult ? criticalState.lastResult.id : null;
  const candidates = previousId
    ? CRITICAL_EVENT_POOL.filter((template) => template.id !== previousId)
    : CRITICAL_EVENT_POOL;
  const pool = candidates.length > 0 ? candidates : CRITICAL_EVENT_POOL;

  const template = pool[Math.floor(Math.random() * pool.length)];

  const event = {
    id: template.id,
    title: template.title,
    description: template.description,
    arcStartDay,
    dueDay,
    condition: template.condition,
    successText: template.successText,
    failureText: template.failureText,
    successEffect: SUCCESS_EFFECT,
    failureEffect: FAILURE_EFFECT,
    status: "active"
  };

  criticalState.active = event;
  return event;
}

/**
 * Ocenia aktywny Wielki Test, jeśli jego dueDay już minął (dueDay <=
 * ukończony dzień = state.day - 1, dokładnie jak w
 * weeklyChallengeSystem.js). Stosuje successEffect albo failureEffect,
 * zapisuje wynik do lastResult/history.
 *
 * IDEMPOTENTNE: jeśli wydarzenie dla danego dueDay zostało już ocenione
 * (criticalState.lastEvaluatedDueDay === event.dueDay), zwraca
 * zapamiętany wynik i NIC nie zmienia w stanie — bezpieczne przy
 * wielokrotnym renderze weekly summary.
 *
 * Zwraca null, jeśli nie ma aktywnego wydarzenia albo jeszcze nie minął
 * jego termin (np. pierwsze 27 dni gry).
 */
export function evaluateCriticalEvent(state) {
  const criticalState = ensureCriticalEventState(state);
  const event = criticalState.active;

  if (!event) {
    return null;
  }

  const completedDay = state.day - 1;
  if (event.dueDay > completedDay) {
    return null;
  }

  if (criticalState.lastEvaluatedDueDay === event.dueDay) {
    return criticalState.lastResult;
  }

  const success = checkEventSuccess(event, state);
  const effect = success ? event.successEffect : event.failureEffect;

  applyEffect(state, effect);

  event.status = success ? "success" : "failed";

  const result = {
    id: event.id,
    title: event.title,
    dueDay: event.dueDay,
    // v0.30.5: monthlyLoopSystem.js#evaluateMonthlyLoopAfterWeeklySummary
    // czyta lastResult.completedDay, żeby rozpoznać domknięcie
    // pierwszego miesięcznego cyklu. To pole nigdy wcześniej nie było
    // zapisywane na obiekcie result — lokalna zmienna `completedDay`
    // (patrz linijka wyżej) była liczona, ale nigdy nie trafiała do
    // stanu. Bez tego pola miesięczne podsumowanie nie mogło się
    // uruchomić przez normalną rozgrywkę, tylko przez
    // window.oosDev.forceMonthSummary().
    completedDay,
    success,
    text: success ? event.successText : event.failureText,
    effect
  };

  // v0.25: Relationship Scars. TYLKO po porażce (applyScarFromCriticalResult
  // sama sprawdza criticalResult.success i wychodzi wcześnie przy
  // sukcesie). Zapisuje ewentualne scarId wprost na obiekcie `result`,
  // który za chwilę trafia do criticalState.lastResult — to jest
  // jednocześnie mechanizm idempotencji (patrz relationshipScarsSystem.js).
  applyScarFromCriticalResult(state, result);

  criticalState.lastResult = result;
  criticalState.history.push(result);
  criticalState.lastEvaluatedDueDay = event.dueDay;
  criticalState.active = null;

  return result;
}

function checkEventSuccess(event, state) {
  const requirements = (event.condition && event.condition.requirements) || [];
  const context = buildEvaluationContext(state);
  return requirements.every((requirement) => checkRequirement(requirement, context));
}

function checkRequirement(requirement, context) {
  const actual = context[requirement.stat];

  switch (requirement.operator) {
    case ">=":
      return actual >= requirement.value;
    case "<=":
      return actual <= requirement.value;
    case ">":
      return actual > requirement.value;
    case "<":
      return actual < requirement.value;
    case "==":
      return actual === requirement.value;
    default:
      return false;
  }
}

function buildEvaluationContext(state) {
  const npc = getPartnerNpc(state);

  return {
    spoons: state.resources.spoons.current,
    trust: npc ? npc.trust : 0,
    frustration: npc ? npc.frustration : 0
  };
}

/**
 * Aplikuje efekt (successEffect albo failureEffect) do istniejących
 * zasobów: aktualnych spoons (clamp 0..max — NIE max spoons, to
 * zastrzeżone dla Weekly Stakes) oraz trust/frustration partnera
 * (clamp 0..100).
 */
function applyEffect(state, effect) {
  if (!effect) {
    return;
  }

  if (typeof effect.spoonsChange === "number") {
    const spoons = state.resources.spoons;
    spoons.current = clamp(spoons.current + effect.spoonsChange, 0, spoons.max);
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    if (typeof effect.trustChange === "number") {
      npc.trust = clamp(npc.trust + effect.trustChange, 0, 100);
    }

    if (typeof effect.frustrationChange === "number") {
      npc.frustration = clamp(npc.frustration + effect.frustrationChange, 0, 100);
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

// --------------------------------------------------------------------
// Odczyt / prezentacja
// --------------------------------------------------------------------

/**
 * Zwraca aktualnie aktywny Wielki Test (albo null, jeśli nie ma
 * żadnego — praktycznie nie powinno się zdarzyć po v0.20, bo
 * gameScreen.js generuje pierwszy już na starcie gry).
 */
export function getCurrentCriticalEvent(state) {
  const criticalState = ensureCriticalEventState(state);
  return criticalState.active;
}

/**
 * Zwraca liczbę dni pozostałych do terminu aktywnego Wielkiego Testu,
 * licząc INKLUZYWNIE — tak samo jak getWeeklyChallengeCountdown() w
 * weeklyChallengeSystem.js (świeżo wygenerowany test na 28 dni pokazuje
 * "Pozostało: 28 dni", nie 27).
 */
export function getCriticalEventCountdown(state) {
  const event = getCurrentCriticalEvent(state);

  if (!event) {
    return null;
  }

  return Math.max(0, event.dueDay - state.day + 1);
}

/**
 * Zamienia warunek Wielkiego Testu na czytelny tekst, np.
 * "Zaufanie ≥ 65 i Spoons ≥ 5 i Frustracja ≤ 55".
 */
export function formatCriticalEventCondition(event) {
  if (!event || !event.condition || !Array.isArray(event.condition.requirements)) {
    return "";
  }

  return event.condition.requirements
    .map((requirement) => formatRequirement(requirement))
    .join(" i ");
}

function formatRequirement(requirement) {
  const label = STAT_LABELS[requirement.stat] || requirement.stat;
  const symbol = OPERATOR_SYMBOLS[requirement.operator] || requirement.operator;
  return `${label} ${symbol} ${requirement.value}`;
}

// v0.60.1: hotfix — formatCriticalEventCondition() powyżej generuje
// tekst matematyczny ("Zaufanie ≥ 65 i Spoons ≥ 5 i Frustracja ≤ 55"),
// który NIGDY nie powinien trafiać przed gracza (patrz
// weeklySummaryScreen.js, naprawione w tym samym hotfixie). Warunek
// nadal istnieje i działa pod spodem (checkEventSuccess/checkRequirement
// czytają event.condition.requirements bezpośrednio, zupełnie
// niezależnie od tego formattera) — formatCriticalEventCondition/
// OPERATOR_SYMBOLS zostają NIETKNIĘTE. To WYŁĄCZNIE dodatkowa,
// narracyjna alternatywa bez liczb i operatorów.
//
// Ta sama trójka statów co w weeklyChallengeSystem.js (trust >=,
// frustration <=, spoons >=) — ton nieco cięższy, bo to Wielki Test,
// nie zwykły tydzień.
const NARRATIVE_HINTS_BY_STAT_SET = {
  trust: [
    "To będzie testem zaufania bardziej niż czegokolwiek innego.",
    "Liczy się dziś to, ile wiary zostało w tej relacji."
  ],
  frustration: [
    "To przetrwa tylko, jeśli napięcie nie przejmie całej sceny.",
    "Chodzi o to, żeby nie wejść w to już podpalonym/ą."
  ],
  spoons: [
    "To będzie wymagało realnej rezerwy sił, nie tylko dobrych chęci.",
    "Bez zapasu w ciele ten moment zaboli bardziej, niż musi."
  ],
  "frustration,trust": [
    "To przetrwa tylko wtedy, gdy zaufanie przeważy nad napięciem.",
    "Liczy się, czy zostanie więcej spokoju niż pretensji."
  ],
  "spoons,trust": [
    "Potrzeba na to i sił, i zaufania — jedno bez drugiego nie wystarczy.",
    "To zada pytanie o rezerwę: ciała i relacji naraz."
  ],
  "frustration,spoons": [
    "To sprawdzi, czy starczy sił, zanim napięcie weźmie górę.",
    "Bez oddechu i bez spokoju to będzie ciężej, niż powinno."
  ],
  "frustration,spoons,trust": [
    "To sprawdzi wszystko naraz: siłę, zaufanie i to, ile jeszcze da się znieść.",
    "Nie ma tu jednej rzeczy do ocalenia. Jest kilka naraz, i żadna nie jest zbędna."
  ]
};

const DEFAULT_NARRATIVE_HINT = "Coś w tym momencie wymaga uważności.";

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * v0.60.1: Zamiennik formatCriticalEventCondition() do UI gracza. Zero
 * liczb, zero operatorów, zero słowa "Warunek". Zawsze zwraca jedno
 * zdanie.
 */
export function buildCriticalEventNarrativeHint(event) {
  if (!event || !event.condition || !Array.isArray(event.condition.requirements)) {
    return DEFAULT_NARRATIVE_HINT;
  }

  const stats = Array.from(new Set(event.condition.requirements.map((r) => r.stat))).sort();
  const key = stats.join(",");
  const pool = NARRATIVE_HINTS_BY_STAT_SET[key];
  return pool ? pickRandom(pool) : DEFAULT_NARRATIVE_HINT;
}

/**
 * Buduje gotowy do wyświetlenia zestaw danych dla weekly summary:
 * wynik ostatnio ocenionego Wielkiego Testu (jeśli jest) + nadchodzące
 * wydarzenie wraz z sformatowanym warunkiem i odliczaniem dni.
 */
export function buildCriticalEventSummary(state) {
  const criticalState = ensureCriticalEventState(state);
  const upcoming = criticalState.active;

  return {
    lastResult: criticalState.lastResult,
    upcoming,
    upcomingConditionText: upcoming ? formatCriticalEventCondition(upcoming) : "",
    // v0.60.1: wersja dla UI gracza — zero liczb/operatorów.
    upcomingNarrativeHint: upcoming ? buildCriticalEventNarrativeHint(upcoming) : "",
    upcomingDaysLeft: upcoming ? getCriticalEventCountdown(state) : null
  };
}
