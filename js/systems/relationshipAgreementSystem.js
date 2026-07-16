// relationshipAgreementSystem.js
//
// v0.39: Relationship Agreement Conversation.
//
// Ten system pozwala decyzjom gracza wpływać na clarity modelu relacji.
// Nie zmienia automatycznie całego modelu relacji w ciężki sposób.
// Chodzi o to, żeby ustalenia nie były tylko ustawieniem devTools, ale
// czymś, o czym można rozmawiać w gameplayu.
//
// Najważniejsze: rozmowa o zasadach nie jest zdradą. Unikanie rozmowy
// może jednak zwiększać mgłę, w której późniejsze sekrety robią się
// groźniejsze.

import {
  ensureRelationshipModelState,
  getRelationshipModelContext,
  setRelationshipModelClarity
} from "./relationshipModelSystem.js?v=340";

const NOTES = {
  clarified: [
    "Nie wszystko stało się proste. Ale przynajmniej część zasad wyszła z domysłów.",
    "Nazwanie zasad nie usunęło napięcia. Usunęło trochę mgły."
  ],
  renegotiated: [
    "To nie była prośba o natychmiastową odpowiedź. Bardziej sprawdzenie, czy mapa nadal pasuje do terenu.",
    "Rozmowa nie zmieniła wszystkiego. Ale otworzyła miejsce, którego wcześniej nie było."
  ],
  avoided: [
    "Temat nie zniknął. Po prostu dostał więcej czasu, żeby urosnąć w ciszy.",
    "Uniknięcie rozmowy przyniosło ulgę teraz. Zasady zostały tam, gdzie były: częściowo w głowach."
  ]
};

export function applyRelationshipAgreementFromChoice(state, event, choice) {
  const action = choice ? choice.agreementAction : null;
  if (!action) {
    return { applied: false };
  }

  const model = ensureRelationshipModelState(state);
  if (!model) {
    return { applied: false };
  }

  const beforeContext = getRelationshipModelContext(state);
  const clarityBefore = model.clarity;
  const clarityChange = Number(action.clarityChange || 0);
  const clarityAfter = clamp(clarityBefore + clarityChange, 0, 100);

  setRelationshipModelClarity(state, clarityAfter);

  const noteKind = action.noteKind || (clarityChange >= 0 ? "clarified" : "avoided");
  const note = pickRandom(NOTES[noteKind] || NOTES.clarified);
  const afterContext = getRelationshipModelContext(state);

  const entry = {
    day: state.day,
    eventId: event ? event.id : null,
    choiceId: choice ? choice.id : null,
    clarityBefore,
    clarityAfter,
    clarityChange: clarityAfter - clarityBefore,
    modelType: afterContext ? afterContext.type : null,
    note
  };

  const updatedModel = ensureRelationshipModelState(state);
  updatedModel.history.push({
    day: state.day,
    action: "gameplay-agreement-conversation",
    clarity: clarityAfter,
    eventId: event ? event.id : null,
    choiceId: choice ? choice.id : null
  });

  if (updatedModel.history.length > 30) {
    updatedModel.history = updatedModel.history.slice(updatedModel.history.length - 30);
  }

  return {
    applied: true,
    clarityBefore,
    clarityAfter,
    clarityChange: clarityAfter - clarityBefore,
    modelType: afterContext ? afterContext.type : beforeContext ? beforeContext.type : null,
    note,
    entry
  };
}

export function buildReflectionAgreementLine(state, lastLogEntry) {
  if (!lastLogEntry || !lastLogEntry.agreementEffect || !lastLogEntry.agreementEffect.applied) {
    return null;
  }

  return lastLogEntry.agreementEffect.note || null;
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
