// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.46: Work & Obligation Variety Pass. Cache-bust (?v=460) na
// imporcie uiManager.js (zmieniła się treść eventData.js — kaskada
// aż do 4 ekranów). devTools.js NIE zmienił się w v0.46 — zostaje
// przy swoim aktualnym query.

import { initUI, showScreen } from "./ui/uiManager.js?v=460";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=450";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
