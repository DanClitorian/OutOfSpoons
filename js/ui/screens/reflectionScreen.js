// reflectionScreen.js
//
// Ekran wieczornej refleksji: pokazuje konsekwencje decyzji podjętej
// w wydarzeniu oraz aktualny stan spoons. Przycisk zapisuje grę
// i przechodzi do poranka kolejnego dnia.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");

  const wrapper = document.createElement("div");
  wrapper.className = "screen reflection-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczorna refleksja";
  wrapper.appendChild(title);

  const result = document.createElement("p");
  result.className = "reflection-text";
  result.textContent = resultText;
  wrapper.appendChild(result);

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
