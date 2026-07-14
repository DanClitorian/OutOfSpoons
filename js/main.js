// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.26: Repair Events. Cache-bust (?v=260) na imporcie uiManager.js
// (zmienił zawartość — wszystkie 5 zmienionych ekranów dostało nowe
// query stringi) i devTools.js (nowy helper showRelationshipRepair).

import { initUI, showScreen } from "./ui/uiManager.js?v=260";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=260";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
