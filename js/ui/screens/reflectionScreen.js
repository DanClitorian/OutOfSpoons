// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";

import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";

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
    wrapper.appendChild(renderImpactPanel(consequences, state));
  }

  const summary = document.createElement("p");
  summary.className = "spoons-summary";
  summary.textContent = `Zostało Ci ${state.resources.spoons.current} z ${state.resources.spoons.max} spoons na dziś.`;
  wrapper.appendChild(summary);

  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button";
  endDayButton.textContent = goesBackToAgenda
    ? "Wróć do agendy dnia"
    : "Zakończ dzień";

  endDayButton.addEventListener("click", () => {
    if (goesBackToAgenda) {
      saveGame(state);
      showScreen("agenda");
    } else {
      state.phase = "evening";
      saveGame(state);
      showScreen("evening");
    }
  });

  wrapper.appendChild(endDayButton);

  container.appendChild(wrapper);
}

// CLEAN v0.15 reflection impact panel START
// v0.15: RPG Gameplay Shell. Opakowuje istniejące konsekwencje w bardziej
// "gameplayowy" panel z wyraźnym nagłówkiem, żeby refleksja mocniej
// pokazywała skutek decyzji, zamiast wyglądać jak sam tekst.
function renderImpactPanel(consequences, state) {
  const panel = document.createElement("div");
  panel.className = "reflection-impact-panel";

  const title = document.createElement("p");
  title.className = "reflection-impact-title";
  title.textContent = "Skutek decyzji";
  panel.appendChild(title);

  panel.appendChild(renderConsequences(consequences));

  const dayProgress = buildDayProgressLine(state);
  if (dayProgress) {
    panel.appendChild(dayProgress);
  }

  return panel;
}

function buildDayProgressLine(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;

  const line = document.createElement("p");
  line.className = "reflection-day-progress";
  line.textContent = `Postęp dnia: ${completed}/${total}`;
  return line;
}
// CLEAN v0.15 reflection impact panel END

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
