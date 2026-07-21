// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).
//
// v0.46: Work & Obligation Variety Pass. Cache-bust (?v=460) na
// imporcie uiManager.js (zmieniła się treść eventData.js — kaskada
// aż do 4 ekranów). devTools.js NIE zmienił się w v0.46 — zostaje
// przy swoim aktualnym query.

// v0.47: Weekly Summary Game Feel Pass. Cache-bust (?v=470) na
// imporcie uiManager.js (uiManager zmienil swoj import
// weeklySummaryScreen.js). devTools.js NIE zmienil sie w v0.47.
// v0.48: Visual Identity Redesign. Cache-bust (?v=480) na imporcie
// uiManager.js (uiManager zmienil swoj import versionBadge.js).
// devTools.js NIE zmienil sie w v0.48.
// v0.49: Fatigue Economy Reconnection. Cache-bust uiManager (3 ekrany
// podbily importy dayCycle.js) oraz devTools (nowe helpery fatigue).
// v0.50: Morning Signal Cards. Cache-bust uiManager (podbil import
// gameScreen.js). devTools.js NIE zmienil sie w v0.50.
// v0.51: Contextual Evening Recovery. Cache-bust uiManager (podbil
// import eveningScreen.js). devTools.js NIE zmienil sie w v0.51.
// v0.52: Weekly Stakes Tracking. Cache-bust uiManager (podbil importy
// 5 ekranow + versionBadge). devTools.js NIE zmienil sie w v0.52.
// v0.53: Physical Spoon Row UI. Cache-bust uiManager (podbil importy
// 6 ekranow z oosLayout + versionBadge). devTools bez zmian.
import { initUI, showScreen } from "./ui/uiManager.js?v=530";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=490";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
