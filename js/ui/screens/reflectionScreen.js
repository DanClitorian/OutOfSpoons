// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";

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

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button";
  endDayButton.textContent = "Zakończ dzień";
  endDayButton.addEventListener("click", () => {
    state.phase = "evening";
    showScreen("evening");
  });
  wrapper.appendChild(endDayButton);

  container.appendChild(wrapper);
}

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

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    list.appendChild(buildConsequenceItem("Przeciążenie", consequences.fatigueChange));
  }

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

  if (consequences.fatigueChange > 0) {
    sentences.push("Ta decyzja zwiększyła przeciążenie, które przejdzie na kolejny dzień.");
  }

  if (sentences.length === 0) {
    return null;
  }

  return sentences.join(" ");
}

function formatSignedNumber(value) {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "0";
}
