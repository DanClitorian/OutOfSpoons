// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.
//
// v0.16: to jest ekran, na którym gracz PIERWSZY RAZ widzi dokładne
// liczby dla swojej decyzji (event screen celowo ich już nie pokazuje —
// patrz eventScreen.js). Dlatego konsekwencje są tu dużymi, wyraźnymi
// kaflami (vn-consequence-*), a nie cichą listą tekstu.
//
// v0.17: Asset-Based VN UI Implementation — scena używa teraz tła
// assets/scenes/scene-reflection.png, a tekst wyniku decyzji trafia do
// osobnego narrative-strip. Kafle konsekwencji dostały ikony (🥄🤝🌡️).

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";
import {
  createVnShell,
  createTopBar,
  createScenePanel,
  createNarrativeStrip,
  createPlayerCard,
  createActionPanel,
  createConsequencePanel
} from "../vnLayout.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const topbar = createTopBar(state, "reflection");
  const side = createPlayerCard(state, "reflection");

  const scene = createScenePanel({
    symbolModifier: "reflection",
    title: "Skutek decyzji"
  });

  const narrative = createNarrativeStrip(resultText);

  const panelChildren = [];
  if (consequences) {
    panelChildren.push(renderImpactPanel(consequences, state));
  }

  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button vn-choice-button";
  endDayButton.textContent = goesBackToAgenda
    ? "Wróć do planu dnia"
    : "Zamknij dzień";

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

  panelChildren.push(endDayButton);

  const actions = createActionPanel(panelChildren, "stack");

  const shell = createVnShell({
    screenClass: "reflection",
    topbar,
    side,
    scene,
    narrative,
    actions
  });

  container.appendChild(shell);
}

// CLEAN v0.16 reflection impact panel START
// konsekwencje jako duże kafle (vn-consequence-grid) z ikonami.
function renderImpactPanel(consequences, state) {
  const panel = document.createElement("div");
  panel.className = "reflection-impact-panel";

  const title = document.createElement("p");
  title.className = "reflection-impact-title";
  title.textContent = "Skutek decyzji";
  panel.appendChild(title);

  const items = [
    { icon: "🥄", label: "Spoons", value: consequences.spoonsChange },
    { icon: "🤝", label: "Zaufanie", value: consequences.trustChange },
    { icon: "🌡️", label: "Frustracja", value: consequences.frustrationChange }
  ];

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    items.push({ icon: "🌀", label: "Przeciążenie", value: consequences.fatigueChange });
  }

  panel.appendChild(createConsequencePanel(items));

  const interpretation = buildInterpretation(consequences);
  if (interpretation) {
    const interpretationText = document.createElement("p");
    interpretationText.className = "consequences-interpretation";
    interpretationText.textContent = interpretation;
    panel.appendChild(interpretationText);
  }

  const spoonsSummary = document.createElement("p");
  spoonsSummary.className = "spoons-summary";
  spoonsSummary.textContent = `Zostało Ci ${state.resources.spoons.current} z ${state.resources.spoons.max} spoons na dziś.`;
  panel.appendChild(spoonsSummary);

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
// CLEAN v0.16 reflection impact panel END

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
