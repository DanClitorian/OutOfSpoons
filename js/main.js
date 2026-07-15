// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.30.5: Stabilizacja Month One Complete Loop. Cache-bust (?v=305)
// na imporcie uiManager.js (zmienił zawartość — nowe query stringi na
// gameScreen.js/weeklySummaryScreen.js/monthSummaryScreen.js) i
// devTools.js (nowe query stringi na criticalEventSystem.js/
// uiManager.js/monthlyLoopSystem.js — funkcje devTools NIE zmienione).

import { initUI, showScreen } from "./ui/uiManager.js?v=305";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=305";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
