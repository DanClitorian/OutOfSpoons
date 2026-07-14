// uiManager.js
//
// Centralny router ekranów.
// Hotfix v0.9.1:
// - naprawia składnię obiektu screens,
// - rejestruje ekran evening,
// - zachowuje initUI i showScreen,
// - wspiera stare aliasy nazw ekranów.
//
// v0.23: Partner Capacity Foundation. Cache-bust (?v=230) na importach
// gameScreen.js / eventScreen.js / weeklySummaryScreen.js — te 3
// moduły faktycznie zmieniły zawartość w tej wersji, więc przeglądarka
// musi pobrać je na nowo, nie użyć starej wersji z cache. Pozostałe
// ekrany (mainMenu/characterCreator/reflection/evening/agenda) NIE
// zmieniły się w v0.23, więc ich importy zostają bez query — nie było
// potrzeby ich bustować.
//
// v0.24: Pattern Pressure. TYLKO reflectionScreen.js dostaje ?v=240
// (zmienił zawartość — jedno subtelne zdanie o presji wzorca, PO
// decyzji). eventScreen.js CELOWO NIE jest ruszany w v0.24 — Pattern
// Pressure nie może wpływać na dostępność kart przed kliknięciem, więc
// eventScreen.js zostaje dokładnie taki, jaki był w v0.23 (import
// zostaje przy ?v=230, bo to nadal poprawnie wskazuje na jego
// aktualną, niezmienioną zawartość). gameScreen.js i
// weeklySummaryScreen.js też się nie zmieniły — zostają przy ?v=230.

import { renderMainMenu } from "./screens/mainMenuScreen.js";
import { renderCharacterCreatorScreen } from "./screens/characterCreatorScreen.js";
import { renderGameScreen } from "./screens/gameScreen.js?v=230";
import { renderEventScreen } from "./screens/eventScreen.js?v=230";
import { renderReflectionScreen } from "./screens/reflectionScreen.js?v=240";
import { renderEveningScreen } from "./screens/eveningScreen.js";

import { renderWeeklySummaryScreen } from "./screens/weeklySummaryScreen.js?v=230";
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
  document.body.dataset.gameScreen = screenName;
  render(appContainer, data);
  // v0.17: appendGameHud() (osobny globalny panel nad ekranem) zostało
  // usunięte stąd celowo — powodowało "podwójny HUD" razem z nowym
  // vn-topbar w vnLayout.js. Dzień/faza/spoons/zaufanie pokazuje teraz
  // wyłącznie vn-topbar, budowany przez każdy ekran gameplayowy z
  // osobna (patrz js/ui/vnLayout.js#createTopBar).
  appendVersionBadge(appContainer);
}
