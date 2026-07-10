// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.
//
// v0.16: Visual Novel RPG Layout Redesign. To jest ekran, na którym
// gracz PIERWSZY RAZ widzi dokładne liczby dla swojej decyzji (event
// screen celowo ich już nie pokazuje — patrz eventScreen.js). Dlatego
// konsekwencje są tu teraz dużymi, wyraźnymi kaflami (vn-consequence-*),
// a nie cichą listą tekstu.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";
import {
  createVnShell,
  createScenePanel,
  createPlayerCard,
  createActionPanel,
  createConsequencePanel
} from "../vnLayout.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const sceneExtra = [];
  if (consequences) {
    sceneExtra.push(renderImpactPanel(consequences, state));
  }

  const scene = createScenePanel({
    symbol: "✍️",
    symbolModifier: "reflection",
    title: "Skutek decyzji",
    text: resultText,
    extra: sceneExtra
  });

  const side = createPlayerCard(state, `Dzień ${state.day} · Refleksja`);

  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button vn-choice-button";
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

  const actions = createActionPanel([endDayButton]);

  const shell = createVnShell({
    screenClass: "reflection",
    phaseLabel: "Refleksja",
    scene,
    side,
    actions
  });

  container.appendChild(shell);
}

// CLEAN v0.16 reflection impact panel START
// v0.16: konsekwencje jako duże kafle (vn-consequence-grid) zamiast
// cichej listy <ul>. Dane i interpretacja tekstowa są dokładnie te
// same co w v0.15 — zmienia się tylko prezentacja.
function renderImpactPanel(consequences, state) {
  const panel = document.createElement("div");
  panel.className = "reflection-impact-panel";

  const title = document.createElement("p");
  title.className = "reflection-impact-title";
  title.textContent = "Skutek decyzji";
  panel.appendChild(title);

  const items = [
    { label: "Spoons", value: consequences.spoonsChange },
    { label: "Zaufanie", value: consequences.trustChange },
    { label: "Frustracja", value: consequences.frustrationChange }
  ];

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    items.push({ label: "Przeciążenie", value: consequences.fatigueChange });
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
