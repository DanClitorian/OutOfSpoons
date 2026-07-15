// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.33: Masking Debt. Cache-bust (?v=330) na imporcie uiManager.js
// (zmienił zawartość — 3 zmienione ekrany dostały nowe query stringi)
// i devTools.js (3 nowe helpery: showMaskingDebt, setMaskingDebtHigh,
// clearMaskingDebt).

import { initUI, showScreen } from "./ui/uiManager.js?v=330";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=330";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
