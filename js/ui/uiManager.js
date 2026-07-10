// uiManager.js
//
// Centralny router ekranów.
// Hotfix v0.9.1:
// - naprawia składnię obiektu screens,
// - rejestruje ekran evening,
// - zachowuje initUI i showScreen,
// - wspiera stare aliasy nazw ekranów.

import { renderMainMenu } from "./screens/mainMenuScreen.js";
import { renderCharacterCreatorScreen } from "./screens/characterCreatorScreen.js";
import { renderGameScreen } from "./screens/gameScreen.js";
import { renderEventScreen } from "./screens/eventScreen.js";
import { renderReflectionScreen } from "./screens/reflectionScreen.js";
import { renderEveningScreen } from "./screens/eveningScreen.js";

import { renderWeeklySummaryScreen } from "./screens/weeklySummaryScreen.js";
import { appendVersionBadge } from "./versionBadge.js";
import { renderAgendaScreen } from "./screens/agendaScreen.js";
let appContainer = null;

const screens = {
  mainMenu: renderMainMenu,
  menu: renderMainMenu,

  characterCreator: renderCharacterCreatorScreen,
  "character-creator": renderCharacterCreatorScreen,

  game: renderGameScreen,
  morning: renderGameScreen,

  event: renderEventScreen,
  reflection: renderReflectionScreen,
  evening: renderEveningScreen,
  weeklySummary: renderWeeklySummaryScreen,
  agenda: renderAgendaScreen
};

export function initUI(rootElementId = "app") {
  appContainer = document.getElementById(rootElementId);

  if (!appContainer) {
    console.error(`Nie znaleziono elementu #${rootElementId}.`);
    return;
  }
}

export function showScreen(screenName, data = null) {
  if (!appContainer) {
    appContainer = document.getElementById("app");
  }

  if (!appContainer) {
    console.error("UI Manager nie został zainicjalizowany i nie znaleziono #app.");
    return;
  }

  const render = screens[screenName];

  if (!render) {
    console.error("Nieznany ekran:", screenName, "Dostępne ekrany:", Object.keys(screens));

    appContainer.innerHTML = "";

    const error = document.createElement("div");
    error.className = "screen";

    const title = document.createElement("h2");
    title.textContent = "Błąd ekranu";
    error.appendChild(title);

    const text = document.createElement("p");
    text.textContent = `Nieznany ekran: ${screenName}`;
    error.appendChild(text);

    const button = document.createElement("button");
    button.className = "primary-button";
    button.textContent = "Wróć do menu";
    button.addEventListener("click", () => showScreen("mainMenu"));
    error.appendChild(button);

    appContainer.appendChild(error);
    return;
  }

  appContainer.innerHTML = "";
  render(appContainer, data);
  appendVersionBadge(appContainer);
}
