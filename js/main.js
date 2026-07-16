// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.44: Dating Arc Foundation. Cache-bust (?v=440) na imporcie
// uiManager.js (zmienił zawartość — gameScreen.js dostał nowy query
// string) i devTools.js (4 nowe helpery: showDatingArc, startDatingArc,
// advanceDatingArcStage, clearDatingArc).

import { initUI, showScreen } from "./ui/uiManager.js?v=440";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=440";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
