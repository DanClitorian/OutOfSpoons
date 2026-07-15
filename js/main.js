// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.32: Game Feel / Daily Stakes Pass. Cache-bust (?v=320) na
// imporcie uiManager.js (zmienił zawartość — 3 zmienione ekrany
// dostały nowe query stringi) i devTools.js (2 nowe helpery:
// showDailyStakes, recalculateDailyStakes).

import { initUI, showScreen } from "./ui/uiManager.js?v=320";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=320";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
