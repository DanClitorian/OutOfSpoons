// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.45.1: Solo UI Parity Fix. Cache-bust (?v=451) na imporcie
// uiManager.js (zmienił zawartość — gameScreen.js dostał nowy query
// string). devTools.js NIE zmienił się w v0.45.1 — zostaje przy swoim
// aktualnym query.

import { initUI, showScreen } from "./ui/uiManager.js?v=451";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=450";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
