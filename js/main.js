// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.43.2: Solo Layout Polish. Cache-bust (?v=432) na imporcie
// uiManager.js (zmienił zawartość — gameScreen.js dostał nowy query
// string). devTools.js NIE zmienił się w v0.43.2 — zostaje przy
// swoim aktualnym query.

import { initUI, showScreen } from "./ui/uiManager.js?v=432";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=430";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
