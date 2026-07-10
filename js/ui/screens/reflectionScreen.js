// reflectionScreen.js
//
// Ekran wieczornej refleksji: pokazuje konsekwencje decyzji podjętej
// w wydarzeniu oraz aktualny stan spoons. Przycisk zapisuje grę
// i przechodzi do poranka kolejnego dnia.
//
// v0.5: oprócz tekstu rezultatu (resultText) pokazujemy teraz wprost
// mechaniczne skutki wyboru — sekcję "Konsekwencje" z trzema wartościami
// ze znakiem (spoons/zaufanie/frustracja) i krótką, nieoceniającą
// interpretacją pod nimi. Wcześniej gracz widział tylko opis fabularny —
// to za mało, żeby zrozumieć, co faktycznie się zmieniło w mechanice gry.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const wrapper = document.createElement("div");
  wrapper.className = "screen reflection-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczorna refleksja";
  wrapper.appendChild(title);

  const result = document.createElement("p");
  result.className = "reflection-text";
  result.textContent = resultText;
  wrapper.appendChild(result);

  if (consequences) {
    wrapper.appendChild(renderConsequences(consequences));
  }

  const summary = document.createElement("p");
  summary.className = "spoons-summary";
  summary.textContent = `Zostało Ci ${state.resources.spoons.current} z ${state.resources.spoons.max} spoons na dziś.`;
  wrapper.appendChild(summary);

  const saveButton = document.createElement("button");
  saveButton.className = "primary-button";
  saveButton.textContent = "Zapisz i przejdź do kolejnego dnia";
  saveButton.addEventListener("click", () => {
    advanceToNextDay();
    saveGame();
    showScreen("game");
  });
  wrapper.appendChild(saveButton);

  container.appendChild(wrapper);
}

/**
 * Formatuje liczbę ze znakiem: dodatnie dostają jawny "+", ujemne mają
 * "-" (naturalnie, z zapisu liczby), a zero jest pokazywane jako "0" —
 * NIE ukrywamy zer, żeby gracz wiedział, że coś się nie zmieniło.
 */
function formatSignedNumber(value) {
  if (value > 0) {
    return `+${value}`;
  }
  if (value < 0) {
    return `${value}`;
  }
  return "0";
}

/**
 * Buduje sekcję "Konsekwencje": listę trzech wartości mechanicznych
 * oraz krótką interpretację pod nimi (jeśli jest co powiedzieć).
 */
function renderConsequences(consequences) {
  const section = document.createElement("div");
  section.className = "consequences";

  const heading = document.createElement("p");
  heading.className = "consequences-heading";
  heading.textContent = "Konsekwencje:";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "consequences-list";
  list.appendChild(buildConsequenceItem("Spoons", consequences.spoonsChange));
  list.appendChild(buildConsequenceItem("Zaufanie", consequences.trustChange));
  list.appendChild(buildConsequenceItem("Frustracja", consequences.frustrationChange));
  section.appendChild(list);

  const interpretation = buildInterpretation(consequences);
  if (interpretation) {
    const interpretationText = document.createElement("p");
    interpretationText.className = "consequences-interpretation";
    interpretationText.textContent = interpretation;
    section.appendChild(interpretationText);
  }

  return section;
}

/**
 * Buduje pojedynczy wiersz konsekwencji: etykieta + wartość ze znakiem.
 */
function buildConsequenceItem(label, value) {
  const item = document.createElement("li");
  item.className = "consequences-item";

  const labelSpan = document.createElement("span");
  labelSpan.className = "consequences-label";
  labelSpan.textContent = `${label}:`;
  item.appendChild(labelSpan);

  const valueSpan = document.createElement("span");
  valueSpan.className = "consequences-value";
  valueSpan.textContent = formatSignedNumber(value);
  item.appendChild(valueSpan);

  return item;
}

/**
 * Buduje krótką, nieoceniającą interpretację konsekwencji. Sklejamy
 * wszystkie pasujące zdania (dla zaufania, frustracji i spoons) w jeden
 * krótki akapit — wybór gracza często zmienia więcej niż jedną wartość
 * naraz, więc gracz powinien zobaczyć wszystkie istotne skutki, nie
 * tylko jeden wybrany arbitralnie.
 */
function buildInterpretation(consequences) {
  const sentences = [];

  if (consequences.trustChange > 0) {
    sentences.push("Ta decyzja trochę wzmocniła poczucie bezpieczeństwa w relacji.");
  } else if (consequences.trustChange < 0) {
    sentences.push("Ta decyzja mogła zostawić w relacji trochę niepewności.");
  }

  if (consequences.frustrationChange > 0) {
    sentences.push("Frustracja partnera wzrosła.");
  } else if (consequences.frustrationChange < 0) {
    sentences.push("Napięcie trochę opadło.");
  }

  if (consequences.spoonsChange < 0) {
    sentences.push("Koszt tej decyzji poczujesz jeszcze dziś.");
  }

  if (sentences.length === 0) {
    return null;
  }

  return sentences.join(" ");
}
