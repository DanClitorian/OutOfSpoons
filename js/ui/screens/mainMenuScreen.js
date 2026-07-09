// mainMenuScreen.js
//
// Ekran menu głównego: pozwala rozpocząć nową grę albo, jeśli istnieje
// zapis, kontynuować poprzednią rozgrywkę od miejsca, w którym została
// zapisana (poranek / wydarzenie / refleksja).

import { showScreen } from "../uiManager.js";
import { hasSavedGame, loadGame } from "../../state/saveManager.js";

export function renderMainMenu(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "screen main-menu";

  const title = document.createElement("h1");
  title.textContent = "Out of Spoons";
  wrapper.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = "Zarządzaj swoją pojemnością. Dzień po dniu.";
  wrapper.appendChild(subtitle);

  const newGameButton = document.createElement("button");
  newGameButton.className = "primary-button";
  newGameButton.textContent = "Nowa gra";
  newGameButton.addEventListener("click", () => {
    showScreen("characterCreator");
  });
  wrapper.appendChild(newGameButton);

  if (hasSavedGame()) {
    const continueButton = document.createElement("button");
    continueButton.className = "secondary-button";
    continueButton.textContent = "Kontynuuj";
    continueButton.addEventListener("click", () => {
      handleContinue();
    });
    wrapper.appendChild(continueButton);
  }

  container.appendChild(wrapper);
}

/**
 * Wczytuje zapisaną grę i przechodzi do właściwego ekranu w zależności
 * od tego, na jakiej fazie dnia gra została zapisana.
 */
function handleContinue() {
  const state = loadGame();
  if (!state) {
    // Zapis nieudany / niekompatybilny — zostajemy w menu.
    return;
  }

  if (!state.player) {
    // Zapis bez postaci (np. bardzo stary format) — traktujemy jak brak
    // użytecznego zapisu, zamiast wywalać błąd gdzieś dalej w UI.
    console.warn("Zapis nie zawiera danych postaci — pomijam wczytywanie.");
    return;
  }

  if (state.phase === "event") {
    showScreen("event");
    return;
  }

  if (state.phase === "reflection") {
    const lastEntry = state.log[state.log.length - 1];
    showScreen("reflection", { resultText: lastEntry ? lastEntry.resultText : "" });
    return;
  }

  showScreen("game");
}