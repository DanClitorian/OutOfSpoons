// relationshipModelSystem.js
//
// v0.34: Relationship Model Foundation.
//
// Fundament rozróżniania modeli relacji: monogamia, poliamoria,
// relacja otwarta, relacja nieustalona/ambiwalentna. TO NIE JEST
// jeszcze system zdrady, romansu, seksu ani rozstania — ten update
// przygotowuje bazę, żeby PRZYSZŁE systemy mogły oceniać zachowanie
// gracza w kontekście ustaleń relacyjnych, a nie według jednego
// moralnego schematu.
//
// NAJWAŻNIEJSZA ZASADA PROJEKTOWA: zdrada w Out of Spoons nie oznacza
// automatycznie "pragnąłem/pragnęłam kogoś innego". Zdrada oznacza:
// złamanie ustaleń, ukrywanie ważnych informacji, odebranie
// partnerowi możliwości świadomej decyzji albo zarządzanie prawdą pod
// własną wygodę. W poliamorii romans nie musi być zdradą. W monogamii
// romans poza relacją zwykle ma inny ciężar. W relacji otwartej seks
// może być zgodny z ustaleniami, ale ukrywanie, brak bezpieczeństwa
// albo przekroczenie granic nadal mogą być zdradą. W relacji
// nieustalonej największym zagrożeniem jest domyślanie się zasad
// zamiast rozmowy.
//
// classifyRelationalAction() jest fundamentem dla PRZYSZŁYCH systemów
// (romans/zdrada) — w v0.34 nie musi być jeszcze używany w gameplayu.
// Ten moduł NIE renderuje UI, NIE zmienia spoons/trust/frustration,
// NIE blokuje wyborów.

const MAX_HISTORY = 30;

// v0.34: schema NIE ma "unclear" w flirting/dating/sex (tylko w
// secrecy) — zgodnie z jawną uwagą ticketu, żeby nie łamać własnego
// schematu dozwolonych wartości. Model "ambiguous" dostaje więc
// ostrożne "ask-first" wszędzie tam, gdzie "unclear" nie jest
// dozwoloną wartością, plus niską clarity, żeby sama niejasność była
// czytelna przez inny kanał (clarity), nie przez łamanie enuma.
const DEFAULT_AGREEMENTS = {
  monogamy: {
    flirting: "ask-first",
    dating: "not-allowed",
    sex: "not-allowed",
    emotionalDisclosure: "before",
    secrecy: "not-allowed",
    metamourContact: "avoid"
  },
  polyamory: {
    flirting: "allowed",
    dating: "ask-first",
    sex: "ask-first",
    emotionalDisclosure: "before",
    secrecy: "not-allowed",
    metamourContact: "neutral"
  },
  open: {
    flirting: "allowed",
    dating: "ask-first",
    sex: "allowed",
    emotionalDisclosure: "before",
    secrecy: "not-allowed",
    metamourContact: "neutral"
  },
  ambiguous: {
    flirting: "ask-first",
    dating: "ask-first",
    sex: "ask-first",
    emotionalDisclosure: "after",
    secrecy: "unclear",
    metamourContact: "neutral"
  }
};

const DEFAULT_CLARITY = {
  monogamy: 70,
  polyamory: 70,
  open: 65,
  ambiguous: 30
};

const TYPE_LABELS = {
  monogamy: "Monogamia",
  polyamory: "Poliamoria",
  open: "Relacja otwarta",
  ambiguous: "Relacja nieustalona"
};

const MORNING_LINES_LOW_CLARITY = [
  "Ustalenia relacji są dziś bardziej domysłem niż mapą.",
  "Relacja ma zasady. Problem w tym, że część z nich żyje tylko w głowie.",
  "To, co wolno, zależy dziś od tego, czy ktoś odważy się zapytać."
];

// v0.60.1: hotfix — poprzednie linie mówiły O modelu ("Ten model
// opiera się na...") zamiast być zdaniem Z gry. Usunięte słowa
// "model"/"typ relacji" — to ma brzmieć jak myśl, nie jak
// dokumentacja.
const AGENDA_LINES = {
  monogamy: "Tu ciężar zaczyna się nie od fascynacji, tylko od tego, co zostaje przed kimś ukryte.",
  polyamory: "Tu nie sama fascynacja robi ciężar. Ciężar robi cisza wokół niej.",
  open: "Wolność tu nie znaczy brak granic. Znaczy tylko, że są inaczej rozłożone.",
  ambiguous: "Nic tu nie zostało do końca nazwane. Domysły i tak swoje kosztują."
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.relationshipModel istnieje. Bezpieczne dla
 * starych zapisów (sprzed v0.34) — domyślny model to poliamoria.
 * Nie zmienia saveVersion.
 */
export function ensureRelationshipModelState(state) {
  if (!state) {
    return null;
  }

  if (!state.relationshipModel) {
    state.relationshipModel = {
      type: "polyamory",
      clarity: DEFAULT_CLARITY.polyamory,
      agreements: { ...DEFAULT_AGREEMENTS.polyamory },
      lastDiscussedDay: null,
      history: []
    };
  }

  if (!state.relationshipModel.agreements) {
    const fallbackType = DEFAULT_AGREEMENTS[state.relationshipModel.type] ? state.relationshipModel.type : "polyamory";
    state.relationshipModel.agreements = { ...DEFAULT_AGREEMENTS[fallbackType] };
  }

  if (typeof state.relationshipModel.clarity !== "number") {
    state.relationshipModel.clarity = DEFAULT_CLARITY.polyamory;
  }

  if (!Array.isArray(state.relationshipModel.history)) {
    state.relationshipModel.history = [];
  }

  return state.relationshipModel;
}

/**
 * Zwraca bezpieczny, gotowy do odczytu obiekt kontekstu — używany
 * przez UI i przez przyszłe systemy. Nigdy nie zwraca referencji do
 * wewnętrznego obiektu agreements (kopia), żeby przypadkowa mutacja
 * po stronie wywołującej nie zepsuła stanu.
 */
export function getRelationshipModelContext(state) {
  const model = ensureRelationshipModelState(state);
  if (!model) {
    return null;
  }

  return {
    type: model.type,
    label: TYPE_LABELS[model.type] || TYPE_LABELS.polyamory,
    clarity: model.clarity,
    clarityLabel: getClarityLabel(model.clarity),
    agreements: { ...model.agreements },
    riskProfile: buildRiskProfile(model)
  };
}

function getClarityLabel(clarity) {
  if (clarity >= 70) {
    return "jasne";
  }

  if (clarity >= 45) {
    return "częściowo jasne";
  }

  if (clarity >= 20) {
    return "niejasne";
  }

  return "bardzo niejasne";
}

// Krótki, wewnętrzny opis tego, które kategorie są dla TEGO modelu
// najbardziej wrażliwe — do użytku przez przyszłe systemy (romans/
// zdrada), nigdy pokazywany wprost graczowi jako lista.
function buildRiskProfile(model) {
  const risky = [];

  if (model.agreements.secrecy !== "not-allowed") {
    risky.push("secrecy");
  }

  if (model.type === "monogamy") {
    risky.push("dating", "sex", "emotional-affair");
  }

  if (model.clarity < 45) {
    risky.push("ambiguity");
  }

  return Array.from(new Set(risky));
}

// --------------------------------------------------------------------
// Klasyfikacja akcji (fundament dla przyszłych systemów)
// --------------------------------------------------------------------

/**
 * Helper dla PRZYSZŁYCH systemów romansu/zdrady — w v0.34 nie musi
 * być jeszcze używany w gameplayu. Ocenia potencjalną akcję relacyjną
 * w kontekście AKTUALNEGO modelu relacji. Nigdy nie nazywa wszystkiego
 * zdradą automatycznie — logika różni się realnie między modelami,
 * zgodnie z NAJWAŻNIEJSZĄ ZASADĄ PROJEKTOWĄ (patrz nagłówek pliku).
 */
export function classifyRelationalAction(state, action) {
  const model = ensureRelationshipModelState(state);

  if (!model || !action || !action.type) {
    return {
      modelType: model ? model.type : null,
      isPotentialBreach: false,
      severity: "none",
      reason: "Brak wystarczających danych do oceny.",
      suggestedTags: []
    };
  }

  const disclosed = action.disclosed === true;
  const askedFirst = action.askedFirst === true;

  // Rozmowa o granicach relacji / renegocjacja zasad NIGDY nie jest
  // breach, niezależnie od modelu — to dokładne przeciwieństwo zdrady
  // w duchu tego systemu.
  if (action.type === "disclosure" || action.type === "renegotiation") {
    return {
      modelType: model.type,
      isPotentialBreach: false,
      severity: "none",
      reason: "Rozmowa o granicach relacji nie jest złamaniem ustaleń — jest jego przeciwieństwem.",
      suggestedTags: ["repair", "communication"]
    };
  }

  // "secrecy" jako typ akcji reprezentuje samo ukrywanie — uderza
  // bezpośrednio w agreements.secrecy, więc traktowane poważnie w
  // każdym modelu poza ambiguous (gdzie secrecy samo w sobie jest
  // "unclear", więc nie karzemy automatycznie tak mocno).
  if (action.type === "secrecy") {
    if (model.type === "ambiguous") {
      return {
        modelType: model.type,
        isPotentialBreach: true,
        severity: "medium",
        reason: "Ukrywanie czegoś w relacji bez jasnych zasad zwiększa ryzyko, ale nie przesądza o niczym samo w sobie.",
        suggestedTags: ["secrecy", "ambiguity"]
      };
    }

    return {
      modelType: model.type,
      isPotentialBreach: true,
      severity: "high",
      reason: "Ukrywanie informacji łamie zgodę na jawność, niezależnie od tego, co dokładnie zostało ukryte.",
      suggestedTags: ["secrecy"]
    };
  }

  const agreementKey = mapActionTypeToAgreementKey(action.type);
  const agreementValue = agreementKey ? model.agreements[agreementKey] : null;

  if (model.type === "monogamy") {
    return classifyForMonogamy(action, disclosed);
  }

  if (model.type === "polyamory") {
    return classifyForPolyamory(action, disclosed, askedFirst, agreementValue);
  }

  if (model.type === "open") {
    return classifyForOpen(model, action, disclosed, askedFirst, agreementValue);
  }

  return classifyForAmbiguous(disclosed);
}

function mapActionTypeToAgreementKey(actionType) {
  if (actionType === "flirt") {
    return "flirting";
  }

  if (actionType === "date") {
    return "dating";
  }

  if (actionType === "sex") {
    return "sex";
  }

  // "emotional-affair" nie ma własnego pola w schemacie agreements —
  // najbliższy proxy to "dating" (romantyczne zaangażowanie), a nie
  // "emotionalDisclosure" (które opisuje TERMIN ujawnienia, nie
  // dozwolenie).
  if (actionType === "emotional-affair") {
    return "dating";
  }

  return null;
}

// monogamy: flirt/date/sex/emotional-affair poza relacją częściej daje
// breach, szczególnie jeśli undisclosed — niezależnie od tego, co
// dokładnie mówią agreements (w monogamii te agreements i tak są
// domyślnie restrykcyjne).
function classifyForMonogamy(action, disclosed) {
  if (!["flirt", "date", "sex", "emotional-affair"].includes(action.type)) {
    return {
      modelType: "monogamy",
      isPotentialBreach: false,
      severity: "none",
      reason: "Ta akcja nie dotyczy bezpośrednio ustaleń o wyłączności.",
      suggestedTags: []
    };
  }

  if (!disclosed) {
    return {
      modelType: "monogamy",
      isPotentialBreach: true,
      severity: "high",
      reason:
        "W modelu monogamicznym bliskość poza relacją, o której partner nie wie, uderza w samo założenie wyłączności.",
      suggestedTags: ["monogamy-breach", "secrecy"]
    };
  }

  const severity = action.type === "flirt" ? "medium" : "high";
  return {
    modelType: "monogamy",
    isPotentialBreach: true,
    severity,
    reason:
      "Nawet ujawniona bliskość poza relacją wykracza poza założenia modelu monogamicznego — ujawnienie zmniejsza ciężar, nie usuwa go.",
    suggestedTags: ["monogamy-breach"]
  };
}

// polyamory: sam flirt/date/sex nie jest automatycznie breach; breach
// zależy od ask-first/disclosure/secrecy.
function classifyForPolyamory(action, disclosed, askedFirst, agreementValue) {
  if (!agreementValue) {
    return {
      modelType: "polyamory",
      isPotentialBreach: false,
      severity: "none",
      reason: "Ta akcja nie dotyczy bezpośrednio ustaleń tej relacji.",
      suggestedTags: []
    };
  }

  if (agreementValue === "not-allowed") {
    return {
      modelType: "polyamory",
      isPotentialBreach: true,
      severity: disclosed ? "medium" : "high",
      reason: "To wykracza poza to, na co ta relacja się zgodziła — nawet w poliamorii są granice.",
      suggestedTags: ["boundary-breach"]
    };
  }

  if (agreementValue === "ask-first" && !askedFirst) {
    return {
      modelType: "polyamory",
      isPotentialBreach: true,
      severity: disclosed ? "low" : "medium",
      reason:
        "Sama otwartość tej relacji nie zastępuje zapytania najpierw — pominięcie tego kroku jest złamaniem ustaleń, nie samego faktu.",
      suggestedTags: ["ask-first-breach"]
    };
  }

  if (!disclosed) {
    return {
      modelType: "polyamory",
      isPotentialBreach: true,
      severity: "medium",
      reason: "Sama fascynacja czy bliskość nie jest tu problemem — ukrycie jej już jest.",
      suggestedTags: ["secrecy"]
    };
  }

  return {
    modelType: "polyamory",
    isPotentialBreach: false,
    severity: "none",
    reason: "Ta akcja mieści się w ustaleniach tej relacji.",
    suggestedTags: []
  };
}

// open: sex może być mniej problematyczny niż dating/emotional-affair,
// ale secrecy nadal mocno zwiększa ryzyko.
function classifyForOpen(model, action, disclosed, askedFirst, agreementValue) {
  if (action.type === "sex") {
    if (!disclosed && model.agreements.secrecy === "not-allowed") {
      return {
        modelType: "open",
        isPotentialBreach: true,
        severity: "medium",
        reason: "Seks poza relacją może mieścić się w ustaleniach — ukrycie go już nie.",
        suggestedTags: ["secrecy"]
      };
    }

    if (agreementValue === "not-allowed") {
      return {
        modelType: "open",
        isPotentialBreach: true,
        severity: "medium",
        reason: "Ta relacja otwarta akurat tego nie obejmuje.",
        suggestedTags: ["boundary-breach"]
      };
    }

    return {
      modelType: "open",
      isPotentialBreach: false,
      severity: "none",
      reason: "Seks poza relacją może być zgodny z ustaleniami tego modelu.",
      suggestedTags: []
    };
  }

  if (action.type === "date" || action.type === "emotional-affair") {
    if (!disclosed) {
      return {
        modelType: "open",
        isPotentialBreach: true,
        severity: "high",
        reason:
          "Relacja otwarta zwykle rozdziela wolność seksualną od głębszego zaangażowania — ukryte zaangażowanie emocjonalne waży więcej niż ukryty seks.",
        suggestedTags: ["secrecy", "emotional-boundary"]
      };
    }

    if (agreementValue === "not-allowed") {
      return {
        modelType: "open",
        isPotentialBreach: true,
        severity: "medium",
        reason: "Ten typ bliskości wykracza poza to, co ta relacja otwarta obejmuje.",
        suggestedTags: ["boundary-breach"]
      };
    }

    if (agreementValue === "ask-first" && !askedFirst) {
      return {
        modelType: "open",
        isPotentialBreach: true,
        severity: "low",
        reason: "Nawet w relacji otwartej głębsze zaangażowanie zwykle wymaga rozmowy najpierw.",
        suggestedTags: ["ask-first-breach"]
      };
    }

    return {
      modelType: "open",
      isPotentialBreach: false,
      severity: "none",
      reason: "Ta akcja mieści się w ustaleniach tej relacji otwartej.",
      suggestedTags: []
    };
  }

  // flirt i inne, mniej zdefiniowane typy akcji.
  if (!disclosed) {
    return {
      modelType: "open",
      isPotentialBreach: true,
      severity: "low",
      reason: "Sam flirt rzadko jest tu problemem — ukrycie zwykle waży więcej niż sam fakt.",
      suggestedTags: ["secrecy"]
    };
  }

  return {
    modelType: "open",
    isPotentialBreach: false,
    severity: "none",
    reason: "Flirt mieści się w ustaleniach tej relacji otwartej.",
    suggestedTags: []
  };
}

// ambiguous: brak jasności zwiększa ryzyko, ale nie nazywamy
// wszystkiego zdradą automatycznie — najwyższa severity tutaj to
// "medium", nigdy "high", bo bez ustaleń nie ma jasnej podstawy do
// oceny "high".
function classifyForAmbiguous(disclosed) {
  if (!disclosed) {
    return {
      modelType: "ambiguous",
      isPotentialBreach: true,
      severity: "medium",
      reason: "Bez jasnych ustaleń domyślanie się zasad i ukrywanie czegokolwiek jest największym ryzykiem tej relacji.",
      suggestedTags: ["ambiguity", "secrecy"]
    };
  }

  return {
    modelType: "ambiguous",
    isPotentialBreach: false,
    severity: "low",
    reason: "Relacja nie ma jeszcze jasno nazwanych zasad — to samo w sobie jest ryzykiem, ale nie czyni tej konkretnej akcji zdradą.",
    suggestedTags: ["ambiguity"]
  };
}

// --------------------------------------------------------------------
// Odczyt / prezentacja (nigdy liczb agreements/clarity wprost do UI gracza)
// --------------------------------------------------------------------

/**
 * Krótka linia do poranka — TYLKO jeśli model jest niejasny
 * (type === "ambiguous" albo clarity < 45). Jeśli model jest jasny,
 * zwraca null (celowo "nie spamuje" codziennie).
 */
export function buildRelationshipModelMorningLine(state) {
  const model = ensureRelationshipModelState(state);
  if (!model) {
    return null;
  }

  const isUnclear = model.type === "ambiguous" || model.clarity < 45;
  if (!isUnclear) {
    return null;
  }

  return pickRandom(MORNING_LINES_LOW_CLARITY);
}

/**
 * Krótka linia do relationship slotu / agendy — ZAWSZE zwraca jedno
 * zdanie, dopasowane do aktualnego typu modelu. Bez liczb.
 */
export function buildRelationshipModelAgendaLine(state) {
  const model = ensureRelationshipModelState(state);
  if (!model) {
    return null;
  }

  return AGENDA_LINES[model.type] || AGENDA_LINES.polyamory;
}

// --------------------------------------------------------------------
// DevTools
// --------------------------------------------------------------------

/**
 * Zmienia typ modelu relacji i ustawia sensowne domyślne agreements +
 * clarity dla tego modelu. Dopisuje wpis do historii.
 */
export function setRelationshipModelType(state, type) {
  const model = ensureRelationshipModelState(state);
  if (!model) {
    return null;
  }

  const validType = DEFAULT_AGREEMENTS[type] ? type : "polyamory";

  model.type = validType;
  model.agreements = { ...DEFAULT_AGREEMENTS[validType] };
  model.clarity = DEFAULT_CLARITY[validType];
  model.lastDiscussedDay = state.day;

  model.history.push({
    day: state.day,
    action: "type-changed",
    type: validType
  });
  cleanupHistory(model);

  return model;
}

/**
 * Ustawia clarity (0-100, clamp). Dopisuje wpis do historii.
 */
export function setRelationshipModelClarity(state, clarity) {
  const model = ensureRelationshipModelState(state);
  if (!model) {
    return null;
  }

  const clamped = Math.max(0, Math.min(100, Math.round(Number(clarity) || 0)));
  model.clarity = clamped;

  model.history.push({
    day: state.day,
    action: "clarity-changed",
    clarity: clamped
  });
  cleanupHistory(model);

  return model;
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie modelu
 * relacji — type, clarity, agreements, ostatnie 7 wpisów historii.
 */
export function getRelationshipModelDebugSummary(state) {
  const model = ensureRelationshipModelState(state);
  if (!model) {
    return null;
  }

  return {
    type: model.type,
    clarity: model.clarity,
    agreements: { ...model.agreements },
    lastDiscussedDay: model.lastDiscussedDay,
    recentHistory: model.history.slice(-7)
  };
}

function cleanupHistory(model) {
  if (model.history.length > MAX_HISTORY) {
    model.history = model.history.slice(model.history.length - MAX_HISTORY);
  }
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
