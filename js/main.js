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
// v0.54: Month One Content Expansion & Anti-Repetition Pass. Cache-bust
// uiManager (podbil cala galaz eventData/eventWeightSystem + versionBadge).
// v0.55: Narrative Consequence Memory. Cache-bust uiManager (podbil
// cala galaz eventData/eventWeightSystem/dayCycle/ekranow + versionBadge).
// v0.56: Relationship Model Consequence Pass. Cache-bust uiManager
// (podbil cala galaz eventSystem/eventWeightSystem/narrativeMemory/
// ekranow + versionBadge).
// v0.57: Daily Texture & Pacing Director. Cache-bust uiManager
// (podbil cala galaz agendy/eventWeight/gameScreen/weeklySummary +
// versionBadge) i devTools (nowe helpery showDayTexture/setDayTexture/
// clearDayTextureHistory).
// v0.58: Month End Payoff & Run Continuity. Cache-bust uiManager
// (podbil monthSummaryScreen/weeklySummaryScreen/versionBadge) i devTools
// (bump monthlyLoopSystem.js).
// v0.59: Reflection Screen Game Feel & Consequence Clarity. Cache-bust
// uiManager (podbil reflectionScreen.js + versionBadge).
// v0.60: Continue Run UX & Save Reliability. Cache-bust uiManager
// (podbil mainMenuScreen.js + versionBadge).
// v0.60.1: hotfix — usuniete matematyczne "Warunek: ..." z UI. Cache-bust
// uiManager (podbil cala galaz weeklyChallenge/criticalEvent + ekranow) i devTools.
// v0.61: Player-Facing Language Audit. Cache-bust uiManager (podbil
// weeklySummaryScreen.js + versionBadge).
import { initUI, showScreen } from "./ui/uiManager.js?v=610";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js?v=601";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
