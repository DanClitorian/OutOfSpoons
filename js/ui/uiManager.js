// uiManager.js
//
// Odpowiada wyłącznie za przełączanie ekranów. Nie zawiera logiki gry —
// tylko wie, jak wyrenderować dany ekran do kontenera #app.
// Ekrany same decydują, kiedy poprosić o przejście do innego ekranu.

import { renderMainMenu } from "./screens/mainMenuScreen.js";
import { renderGameScreen } from "./screens/gameScreen.js";
import { renderEventScreen } from "./screens/eventScreen.js";
import { renderReflectionScreen } from "./screens/reflectionScreen.js";

const screens = {
  mainMenu: renderMainMenu,
  game: renderGameScreen,
  event: renderEventScreen,
  reflection: renderReflectionScreen
};

let appContainer = null;

/**
 * Inicjalizuje UI Managera, wskazując element DOM, w którym będą
 * renderowane ekrany.
 */
export function initUI(rootElementId) {
  appContainer = document.getElementById(rootElementId);
  if (!appContainer) {
    console.error(`Nie znaleziono elementu o id "${rootElementId}"`);
  }
}

/**
 * Pokazuje wskazany ekran, czyszcząc poprzednią zawartość kontenera.
 * @param {string} screenName - nazwa ekranu (klucz w obiekcie `screens`)
 * @param {object} [data] - opcjonalne dane przekazywane do funkcji renderującej
 */
export function showScreen(screenName, data) {
  if (!appContainer) {
    console.error("UI Manager nie został zainicjalizowany (brak wywołania initUI).");
    return;
  }

  const renderFn = screens[screenName];
  if (!renderFn) {
    console.error(`Nieznany ekran: "${screenName}"`);
    return;
  }

  appContainer.innerHTML = "";
  renderFn(appContainer, data);
}
