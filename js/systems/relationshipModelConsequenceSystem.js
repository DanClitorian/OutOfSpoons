// relationshipModelConsequenceSystem.js
//
// v0.56: Relationship Model Consequence Pass.
//
// Model relacji (monogamia/poliamoria/otwarta/nieustalona) istniał od
// v0.34 jako fundament (relationshipModelSystem.js#classifyRelationalAction),
// ale realnie wpływał tylko na romance/secrecy. Ten moduł rozszerza go
// na ZWYKŁE decyzje — interpretuje te same wybory PRZEZ PRYZMAT
// kontraktu relacji, zamiast oceniać je jednym uniwersalnym schematem.
//
// NAJWAŻNIEJSZA ZASADA: żaden model nie jest "lepszy". Monogamia nie
// jest karana, poliamoria nie jest "trybem bez zazdrości", relacja
// otwarta nie jest "bez granic". Zmienia się WYŁĄCZNIE znaczenie tych
// samych faktów (sekret, ujawnienie, unik, szczerość) — nie ich ocena
// moralna.
//
// Ten system NIE duplikuje secrecyConsequenceSystem/romanceInterestSystem/
// relationshipAgreementSystem:
//   - jeśli choice.agreementAction istnieje, agreementSystem już
//     zmienił clarity — ten moduł wtedy NIC nie robi (return applied:false),
//   - jeśli choice.romanceAction istnieje, secrecyConsequenceSystem już
//     policzył trust/frustration na bazie classifyRelationalAction —
//     ten moduł dokłada WYŁĄCZNIE clarity (sygnał, którego tamten
//     system nigdy nie dotyka),
//   - w pozostałych przypadkach (zwykłe eventy, metamour, tekst wyboru)
//     ten moduł jest jedynym źródłem efektu.

import {
  ensureRelationshipModelState,
  setRelationshipModelClarity
} from "./relationshipModelSystem.js?v=340";

const MAX_RECENT = 3;

const AVOIDANCE_PHRASES = ["udawa", "zniknąć", "znikasz", "przemilcz", "unik", "wymyk"];
const HONESTY_PHRASES = ["wprost", "uczciwie", "nazwać", "nazywasz", "powiedzieć", "mówisz to, co"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// --------------------------------------------------------------------
// Stan (zagnieżdżony w state.relationshipModel — lazy-init, zero zmian
// saveVersion, zero migracji)
// --------------------------------------------------------------------

export function ensureRelationshipModelConsequenceState(state) {
  const model = ensureRelationshipModelState(state);
  if (!model) return null;

  if (!model.consequence || typeof model.consequence !== "object") {
    model.consequence = {
      lastEvaluatedDay: null,
      lastNote: null,
      lastSourceEventId: null,
      lastSourceChoiceId: null,
      recentFriction: 0,
      recentAlignment: 0
    };
  }

  return model.consequence;
}

// --------------------------------------------------------------------
// Główna logika — wołane z eventSystem.js#applyChoice, PO agreementResult
// --------------------------------------------------------------------

/**
 * `context` = { romanceResult, metamourResult, agreementResult } —
 * już policzone przez eventSystem w tym samym applyChoice, żeby ten
 * moduł nigdy nie musiał zgadywać, co się wydarzyło.
 *
 * Zwraca { applied, trustChange, frustrationChange, clarityChange,
 * note, memoryType, memoryIntensity }. trust/frustration/clarity są
 * już ZAAPLIKOWANE do state wewnątrz tej funkcji (clarity przez
 * setRelationshipModelClarity) — trust/frustration zwracane są jako
 * delty do zaaplikowania przez eventSystem.js (ta sama konwencja co
 * secrecyResult.trustChange/frustrationChange).
 */
export function applyRelationshipModelConsequenceFromChoice(state, event, choice, context = {}) {
  const consequence = ensureRelationshipModelConsequenceState(state);
  const model = ensureRelationshipModelState(state);
  if (!consequence || !model || !event || !choice) {
    return { applied: false, trustChange: 0, frustrationChange: 0, clarityChange: 0 };
  }

  // Rozmowa o ustaleniach ma WŁASNY, już policzony efekt na clarity —
  // nie dublujemy go.
  if (context.agreementResult && context.agreementResult.applied) {
    return { applied: false, trustChange: 0, frustrationChange: 0, clarityChange: 0 };
  }

  const result =
    evaluateRomanceSignal(model, context.romanceResult) ||
    evaluateMetamourSignal(model, context.metamourResult) ||
    evaluateTextSignal(model, choice);

  if (!result) {
    return { applied: false, trustChange: 0, frustrationChange: 0, clarityChange: 0 };
  }

  const clarityBefore = model.clarity;
  const clarityAfter = clamp(clarityBefore + result.clarityChange, 0, 100);
  if (clarityAfter !== clarityBefore) {
    setRelationshipModelClarity(state, clarityAfter);
  }

  consequence.lastEvaluatedDay = state.day;
  consequence.lastNote = result.note;
  consequence.lastSourceEventId = event.id;
  consequence.lastSourceChoiceId = choice.id;

  const isFriction = result.clarityChange < 0 || result.frustrationChange > 0;
  const isAlignment = result.clarityChange > 0 && result.frustrationChange <= 0;
  if (isFriction) {
    consequence.recentFriction = Math.min(MAX_RECENT, consequence.recentFriction + 1);
    consequence.recentAlignment = Math.max(0, consequence.recentAlignment - 1);
  } else if (isAlignment) {
    consequence.recentAlignment = Math.min(MAX_RECENT, consequence.recentAlignment + 1);
    consequence.recentFriction = Math.max(0, consequence.recentFriction - 1);
  }

  return {
    applied: true,
    trustChange: result.trustChange,
    frustrationChange: result.frustrationChange,
    clarityChange: clarityAfter - clarityBefore,
    note: result.note,
    memoryType: result.memoryType,
    memoryIntensity: result.memoryIntensity
  };
}

// --------------------------------------------------------------------
// Sygnał 1: romance/secrecy — TYLKO clarity. Trust/frustration są już
// policzone przez secrecyConsequenceSystem na bazie tej samej
// klasyfikacji (classifyRelationalAction) — nie dotykamy ich tutaj.
// --------------------------------------------------------------------

function evaluateRomanceSignal(model, romanceResult) {
  if (!romanceResult || !romanceResult.applied) return null;

  const classification = romanceResult.classification || {};
  const disclosed = romanceResult.disclosed === true;
  const severity = classification.severity || "none";
  const isBreach = classification.isPotentialBreach === true;

  let clarityChange;
  if (disclosed) {
    clarityChange = isBreach ? 2 : 3;
  } else {
    const table = { low: -3, medium: -5, high: -7 };
    clarityChange = table[severity] || -3;
    // Model nieustalony: sekret w mgle jest szczególnie kosztowny dla
    // clarity — nie ma nawet ustaleń, które by go ograniczały.
    if (model.type === "ambiguous") clarityChange -= 1;
  }

  return {
    trustChange: 0,
    frustrationChange: 0,
    clarityChange: clamp(clarityChange, -8, 8),
    note: buildRomanceNote(model.type, disclosed, isBreach),
    memoryType: disclosed ? "honesty" : "secrecy",
    memoryIntensity: Math.abs(clarityChange) >= 6 ? 3 : 2
  };
}

function buildRomanceNote(type, disclosed, isBreach) {
  if (disclosed) {
    if (type === "monogamy") {
      return "Powiedzenie tego na głos nie usuwa ciężaru wyłączności, ale zostawia partnerowi prawo do reakcji.";
    }
    if (type === "ambiguous") {
      return "Bez jasnych ustaleń nawet szczerość ląduje w mgle. Ale przynajmniej ląduje na widoku.";
    }
    return isBreach
      ? "Ujawnienie nie unieważnia tego, że to wykracza poza ustalenia — ale zostawia partnerowi wybór."
      : "Nazwanie tego na głos trzyma je w granicach tego, na co ta relacja się zgodziła.";
  }

  if (type === "monogamy") {
    return "Ukrycie działa krótkoterminowo. Ustalenia zapamiętują więcej niż telefon.";
  }
  if (type === "ambiguous") {
    return "Bez nazwanych zasad sekret nie łamie niczego konkretnego — i właśnie dlatego waży najbardziej.";
  }
  return "Ta relacja opiera się na jawności. Sekret nie łamie faktu — łamie zgodę na przejrzystość.";
}

// --------------------------------------------------------------------
// Sygnał 2: metamour — model decyduje, jak bardzo to "zwykłe".
// --------------------------------------------------------------------

function evaluateMetamourSignal(model, metamourResult) {
  if (!metamourResult || !metamourResult.applied) return null;
  const tensionChange = Number(metamourResult.tensionChange) || 0;
  if (tensionChange === 0) return null;

  if (model.type === "ambiguous") {
    return {
      trustChange: 0,
      frustrationChange: 0,
      clarityChange: clamp(tensionChange > 0 ? -3 : 1, -8, 8),
      note: "Sieć relacji jest tu jeszcze jednym miejscem, gdzie nikt do końca nie wie, jakie są zasady.",
      memoryType: "metamour",
      memoryIntensity: 2
    };
  }

  if (model.type === "monogamy" && tensionChange > 0) {
    return {
      trustChange: 0,
      frustrationChange: 1,
      clarityChange: 0,
      note: "To nie jest temat, który ta relacja spodziewała się często odwiedzać.",
      memoryType: "metamour",
      memoryIntensity: 2
    };
  }

  // poly/open: metamour to normalna część świata — czułość i zazdrość
  // mogą współistnieć, bez dodatkowej kary ponad to, co już policzył
  // metamourSystem. Zwracamy null: brak nowego efektu, ale to NIE
  // znaczy "model nie zauważa" — po prostu nie każdy sygnał zasługuje
  // na osobną notkę (patrz zasada projektowa w nagłówku pliku).
  return null;
}

// --------------------------------------------------------------------
// Sygnał 3: sama treść wyboru — szczerość albo unik, nawet bez
// romance/metamour w tle. To najczęstsza ścieżka (zwykłe eventy).
// --------------------------------------------------------------------

function evaluateTextSignal(model, choice) {
  const text = `${choice.label || ""} ${choice.resultText || ""}`.toLowerCase();
  const isAvoidant = AVOIDANCE_PHRASES.some((p) => text.includes(p));
  const isHonest = HONESTY_PHRASES.some((p) => text.includes(p));

  if (!isAvoidant && !isHonest) return null;

  if (isHonest) {
    if (model.type === "ambiguous") {
      return {
        trustChange: 1,
        frustrationChange: 0,
        clarityChange: 5,
        note: "W jasnej relacji ta rozmowa ma gdzie opaść. W niejasnej zaczyna odbijać się od ścian — ale przynajmniej dziś ktoś ją nazwał.",
        memoryType: "clarity",
        memoryIntensity: 2
      };
    }
    return {
      trustChange: 0,
      frustrationChange: 0,
      clarityChange: 2,
      note: "Szczerość pomaga, ale nie unieważnia ciężaru tego, o czym mówicie.",
      memoryType: "honesty",
      memoryIntensity: 1
    };
  }

  // isAvoidant
  if (model.type === "monogamy") {
    return {
      trustChange: 0,
      frustrationChange: 2,
      clarityChange: -3,
      note: "W relacji, która opiera się na wyłączności, unik szybciej zaczyna wyglądać jak coś do ukrycia.",
      memoryType: "boundary",
      memoryIntensity: 2
    };
  }
  if (model.type === "ambiguous") {
    return {
      trustChange: 0,
      frustrationChange: 1,
      clarityChange: -5,
      note: "To nie była tylko decyzja. Dotknęła zasad, których i tak nikt jeszcze nie nazwał.",
      memoryType: "clarity",
      memoryIntensity: 2
    };
  }
  return {
    trustChange: 0,
    frustrationChange: 1,
    clarityChange: -3,
    note: "Ta relacja liczy na przejrzystość. Unik nie łamie żadnej reguły wprost — po prostu jej nie karmi.",
    memoryType: "boundary",
    memoryIntensity: 1
  };
}

// --------------------------------------------------------------------
// Reflection — jedno zdanie, TYLKO gdy system faktycznie zadziałał
// przy TYM wyborze.
// --------------------------------------------------------------------

export function buildRelationshipModelReflectionLine(state, lastLogEntry) {
  if (!lastLogEntry || !lastLogEntry.relationshipModelEffect || !lastLogEntry.relationshipModelEffect.applied) {
    return null;
  }
  return lastLogEntry.relationshipModelEffect.note || null;
}

// --------------------------------------------------------------------
// Weekly summary — maks. jedno zdanie, tylko gdy jest co powiedzieć.
// --------------------------------------------------------------------

export function buildRelationshipModelWeeklyLine(state) {
  const model = ensureRelationshipModelState(state);
  const consequence = ensureRelationshipModelConsequenceState(state);
  if (!model || !consequence) return null;

  if (consequence.recentFriction >= 2) {
    return "Najwięcej napięcia nie było w samych wydarzeniach, tylko w tym, co one znaczyły wobec waszych ustaleń.";
  }

  if (model.type === "ambiguous" || model.clarity < 45) {
    return "Ten tydzień nie zmienił typu relacji, ale pokazał, gdzie jej zasady są jasne, a gdzie działają tylko na słowo honoru.";
  }

  if (consequence.recentAlignment >= 2 && model.clarity >= 45) {
    return "Jasność pomagała, gdy decyzje były trudne. Nie rozwiązywała ich za ciebie.";
  }

  return null;
}

// --------------------------------------------------------------------
// Lekkie ważenie eventów — bez forced spawn, nigdy negatywne (żaden
// model nie jest "gorszy", więc żaden nie dostaje kary wagi).
// --------------------------------------------------------------------

export function getRelationshipModelWeightTags(state) {
  const model = ensureRelationshipModelState(state);
  const consequence = ensureRelationshipModelConsequenceState(state);
  if (!model) return new Set();

  const flags = new Set();
  if (model.type === "ambiguous" || model.clarity < 45) flags.add("low-clarity");
  if (model.type === "polyamory" || model.type === "open") flags.add("poly-open");
  if (model.type === "monogamy") flags.add("monogamy");
  if (consequence && consequence.recentFriction >= 2) flags.add("recent-friction");

  return flags;
}
