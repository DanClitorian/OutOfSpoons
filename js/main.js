// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.34: Relationship Model Foundation. Cache-bust (?v=340) na
// imporcie uiManager.js (zmienił zawartość — 2 zmienione ekrany
// dostały nowe query stringi) i devTools.js (6 nowych helperów:
// showRelationshipModel, setRelationshipModelMono/Poly/Open/Ambiguous,
// setRelationshipModelClarity).

import { initUI, showScreen } from "./ui/uiManager.js?v=340";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=340";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
