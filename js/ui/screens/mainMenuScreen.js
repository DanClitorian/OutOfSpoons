// mainMenuScreen.js
//
// Ekran menu głównego: pozwala rozpocząć nową grę albo, jeśli istnieje
// zapis, kontynuować poprzednią rozgrywkę od miejsca, w którym została
// zapisana.
//
// v0.60: Continue Run UX & Save Reliability. "Kontynuuj" przestaje
// być suchym przyciskiem bez informacji:
//   - podgląd zapisu (dzień/miesiąc/faza/łyżeczki/zmęczenie opisowo/
//     stan relacji/najbliższy horyzont/ostatni rezultat) budowany
//     przez js/systems/savePreviewSystem.js — WYŁĄCZNIE odczyt,
//     zero mutacji zapisu przy samym otwarciu menu,
//   - łagodna walidacja: stary zapis bez nowych lazy-init pól
//     (dayTexture/narrativeMemory/monthProgress/relationshipModel.
//     consequence) nadal jest poprawny,
//   - uszkodzony zapis pokazuje spokojne ostrzeżenie i NIE jest
//     usuwany ani nadpisywany automatycznie,
//   - kontynuacja ląduje na właściwym ekranie wg getResumeScreenName
//     (uwzględnia pending month summary, prawdopodobny powrót do
//     weekly summary, brakujący currentEventId/log przy phase event/
//     reflection) zamiast tylko event/reflection/game jak wcześniej.
// Cicha porażka wczytywania (stary bug: handleContinue po prostu
// `return`owało bez żadnego komunikatu) jest teraz naprawiona.

import { showScreen } from "../uiManager.js";
import { hasSavedGame, inspectSavedGame, loadGame } from "../../state/saveManager.js";
import {
  buildSavePreview,
  buildSaveHealthMessage,
  getResumeScreenName,
  validateSaveForContinue
} from "../../systems/savePreviewSystem.js?v=600";

export function renderMainMenu(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "screen main-menu oos-main-menu";

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

  wrapper.appendChild(buildContinueCard());

  container.appendChild(wrapper);
}

// --------------------------------------------------------------------
// Karta kontynuacji — trzy stany: brak zapisu / zapis uszkodzony /
// zapis poprawny z podglądem.
// --------------------------------------------------------------------

function buildContinueCard() {
  if (!hasSavedGame()) {
    const card = document.createElement("div");
    card.className = "oos-continue-card oos-continue-card--empty";

    const text1 = document.createElement("p");
    text1.textContent = "Nie ma jeszcze zapisanego runu.";
    const text2 = document.createElement("p");
    text2.className = "oos-continue-card__muted";
    text2.textContent = "Nowa gra zacznie się od poranka, który jeszcze nie wie, co go czeka.";

    card.appendChild(text1);
    card.appendChild(text2);
    return card;
  }

  const savedState = inspectSavedGame();
  const validation = validateSaveForContinue(savedState);

  if (!validation.valid) {
    const card = document.createElement("div");
    card.className = "oos-continue-card oos-continue-card--broken";

    const warning = document.createElement("p");
    warning.textContent = buildSaveHealthMessage(savedState) || "Zapis wygląda na uszkodzony. Możesz zacząć nową grę, ale stary zapis nie został usunięty.";
    card.appendChild(warning);

    return card;
  }

  const preview = buildSavePreview(savedState);

  const card = document.createElement("div");
  card.className = "oos-continue-card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-continue-card__eyebrow";
  eyebrow.textContent = "Ostatni zapisany moment";
  card.appendChild(eyebrow);

  if (preview) {
    const headline = document.createElement("p");
    headline.className = "oos-continue-card__headline";
    headline.textContent = preview.headline;
    card.appendChild(headline);

    if (preview.lines.length > 0) {
      const lines = document.createElement("div");
      lines.className = "oos-continue-card__lines";
      for (const line of preview.lines) {
        const p = document.createElement("p");
        p.className = "oos-continue-card__line";
        p.textContent = line;
        lines.appendChild(p);
      }
      card.appendChild(lines);
    }
  }

  const continueButton = document.createElement("button");
  continueButton.className = "secondary-button oos-continue-card__button";
  continueButton.textContent = "Kontynuuj";
  continueButton.addEventListener("click", () => {
    handleContinue();
  });
  card.appendChild(continueButton);

  return card;
}

/**
 * Wczytuje zapisaną grę i przechodzi do właściwego ekranu w zależności
 * od tego, na jakiej fazie dnia gra została zapisana. Naprawiona
 * cicha porażka z wcześniejszych wersji: jeśli loadGame() zwróci null
 * (np. zapis zniknął między renderem karty a kliknięciem), gracz
 * zostaje w menu, ale karta przy następnym renderze pokaże aktualny
 * stan zamiast udawać, że nic się nie stało.
 */
function handleContinue() {
  const state = loadGame();
  if (!state) {
    showScreen("mainMenu");
    return;
  }

  const validation = validateSaveForContinue(state);
  if (!validation.valid) {
    // Zapis wygląda niepoprawnie mimo przejścia walidacji JSON/wersji
    // w saveManager.js — nie próbujemy na siłę kontynuować w
    // nieznanym stanie. Zapis NIE jest kasowany ani nadpisywany.
    showScreen("mainMenu");
    return;
  }

  const targetScreen = getResumeScreenName(state);

  if (targetScreen === "reflection") {
    const lastEntry = state.log[state.log.length - 1];
    showScreen("reflection", { resultText: lastEntry ? lastEntry.resultText : "" });
    return;
  }

  showScreen(targetScreen);
}
