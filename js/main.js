// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.31: Content Expansion Pack 1. Cache-bust (?v=310) na imporcie
// uiManager.js (zmienił zawartość — 4 zmienione ekrany dostały nowe
// query stringi) i devTools.js (żadna funkcja nie zmieniona, tylko
// jego własny import uiManager.js). Przy okazji naprawiony zdublowany
// nagłówek komentarza tego pliku (kosmetyka, zero zmian logiki).

import { initUI, showScreen } from "./ui/uiManager.js?v=310";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=310";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
