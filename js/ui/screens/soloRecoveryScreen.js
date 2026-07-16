// soloRecoveryScreen.js
//
// v0.42: ekran Solo / Rekonstrukcja.
// To nie jest dating sim. To krótki etap po relacji, w którym gracz
// wybiera, jak poradzić sobie z echem poprzedniej historii.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureSoloRecoveryState,
  getSoloRecoveryChoices,
  applySoloRecoveryChoice,
  advanceSoloRecoveryDay,
  getSoloRecoveryDebugSummary
} from "../../systems/soloRecoverySystem.js?v=420";

export function renderSoloRecoveryScreen(container) {
  const state = getState();
  const solo = ensureSoloRecoveryState(state);
  const summary = getSoloRecoveryDebugSummary(state);
  const choices = getSoloRecoveryChoices(state);

  const wrapper = document.createElement("section");
  wrapper.className = "oos-solo-recovery";

  const card = document.createElement("article");
  card.className = "oos-solo-recovery__card";

  const eyebrow = document.createElement("div");
  eyebrow.className = "oos-solo-recovery__eyebrow";
  eyebrow.textContent = `Dzień ${state.day} · Rekonstrukcja`;
  card.appendChild(eyebrow);

  const title = document.createElement("h1");
  title.className = "oos-solo-recovery__title";
  title.textContent = "Co we mnie zostało?";
  card.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "oos-solo-recovery__intro";
  intro.textContent =
    "Ten etap nie polega na szukaniu następcy. Przez chwilę gra pyta nie o to, kto Cię wybierze, tylko na co Ty masz jeszcze miejsce.";
  card.appendChild(intro);

  const stats = document.createElement("div");
  stats.className = "oos-solo-recovery__stats";
  stats.appendChild(createStat("Dni osobno", summary.daysInSolitude));
  stats.appendChild(createStat("Samowiedza", summary.selfKnowledge));
  stats.appendChild(createStat("Przeciążenie społeczne", summary.socialExhaustion));
  stats.appendChild(createStat("Integralność granic", summary.boundaryIntegrity));
  card.appendChild(stats);

  if (solo && solo.readyForNewRelationship) {
    const ready = document.createElement("p");
    ready.className = "oos-solo-recovery__ready";
    ready.textContent =
      "Jesteś bliżej momentu, w którym nowa relacja nie musi być tylko ucieczką. Sama gra jeszcze jej nie generuje — to następny most.";
    card.appendChild(ready);
  }

  const choiceList = document.createElement("div");
  choiceList.className = "oos-solo-recovery__choices";

  for (const choice of choices) {
    const button = document.createElement("button");
    button.className = "oos-solo-recovery__choice";
    button.type = "button";

    const choiceTitle = document.createElement("strong");
    choiceTitle.textContent = choice.title;
    button.appendChild(choiceTitle);

    const choiceText = document.createElement("span");
    choiceText.textContent = choice.text;
    button.appendChild(choiceText);

    button.addEventListener("click", () => {
      const result = applySoloRecoveryChoice(state, choice.id);
      if (result && result.applied) {
        advanceSoloRecoveryDay(state);
        saveGame(state);
      }
      showScreen("game");
    });

    choiceList.appendChild(button);
  }

  card.appendChild(choiceList);

  const actions = document.createElement("div");
  actions.className = "oos-solo-recovery__actions";

  const backButton = document.createElement("button");
  backButton.className = "oos-solo-recovery__back";
  backButton.textContent = "Wróć do poranka";
  backButton.addEventListener("click", () => {
    saveGame(state);
    showScreen("game");
  });
  actions.appendChild(backButton);

  card.appendChild(actions);
  wrapper.appendChild(card);
  container.appendChild(wrapper);
}

function createStat(label, value) {
  const item = document.createElement("div");
  item.className = "oos-solo-recovery__stat";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  item.appendChild(labelEl);

  const valueEl = document.createElement("strong");
  valueEl.textContent = String(value ?? 0);
  item.appendChild(valueEl);

  return item;
}
