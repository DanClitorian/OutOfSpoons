// gameScreen.js
//
// Morning screen.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Żadnej zależności od
// starych klas .vn-*.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { ensureDailyAgenda } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureWeeklyChallengeState,
  getCurrentWeeklyChallenge,
  getWeeklyChallengeCountdown
} from "../../systems/weeklyChallengeSystem.js";
import {
  ensureCriticalEventState,
  generateNextCriticalEvent,
  getCurrentCriticalEvent,
  getCriticalEventCountdown
} from "../../systems/criticalEventSystem.js";
import {
  ensurePatternState,
  getLatestPatternEcho
} from "../../systems/patternSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createCtaButton
} from "../oosLayout.js";

export function renderGameScreen(container) {
  const state = getState();

  // v0.20: Monthly Critical Event Foundation. Wielki Test ma istnieć od
  // pierwszego możliwego renderu poranka (w przeciwieństwie do Weekly
  // Stakes, które generują się dopiero po pierwszym weekly summary) —
  // jeśli go jeszcze nie ma, generujemy go tutaj i od razu zapisujemy.
  ensureCriticalEventState(state);
  if (!getCurrentCriticalEvent(state)) {
    generateNextCriticalEvent(state);
    saveGame(state);
  }

  const topbar = createTopBar(state, "game");
  const sidebar = createSidebar(state, "game");

  const scene = createScenePanel({
    modifier: "morning",
    title: `Dzień ${state.day}`
  });

  const narrative = createNarrativeStrip(buildMorningNarrative(state));

  const cta = createCtaButton("Otwórz plan dnia", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });

  const shell = createGameShell({
    screenClass: "morning",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [cta],
    actionsVariant: "single"
  });

  container.appendChild(shell);
}

// v0.19: Weekly Stakes. Krótki teaser aktywnego wyzwania dopisany jako
// DRUGIE zdanie do tego samego akapitu narracji — celowo bez nowych
// elementów DOM ani zmian w oosLayout.js/CSS (layout v0.18 zostaje
// nietknięty).
//
// v0.20: Monthly Critical Event Foundation. Analogiczny teaser dla
// Wielkiego Testu dopisany jako TRZECIE zdanie w tym samym akapicie.
//
// v0.20.1: Critical Event Visibility + Testability. Pełne zdanie
// "Nowy dzień się zaczyna..." + teasery robiło się zbyt długie i
// ryzykowało ellipsis w wąskim pasku narracji. Gdy istnieje choć jeden
// aktywny system (wzorzec/Weekly Stake/Wielki Test), narracja
// przechodzi na krótszą formę "Dziś: plan dnia. ...". Pełne, "opisowe"
// zdanie zostaje TYLKO wtedy, gdy żaden system jeszcze nie istnieje.
//
// v0.22: Pattern Foundation / Narrative Echoes. Jeśli gracz ma aktywny
// wzorzec zachowania, wstawiane jest "Wzorzec: {tytuł}. {echo}" zaraz
// po "Dziś: plan dnia." — PRZED teaserami Weekly Stake/Wielkiego Testu.
// Pokazujemy TYLKO NAJNOWSZY aktywny wzorzec (getLatestPatternEcho
// zwraca pojedynczy obiekt albo null) — bez nowego panelu, bez zmiany
// layoutu, wciąż jeden string w tym samym elemencie narrative strip.
function buildMorningNarrative(state) {
  const patternTeaser = buildPatternTeaser(state);
  const weeklyTeaser = buildWeeklyStakeTeaser(state);
  const criticalTeaser = buildCriticalEventTeaser(state);

  if (!patternTeaser && !weeklyTeaser && !criticalTeaser) {
    return "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.";
  }

  const parts = ["Dziś: plan dnia.", patternTeaser, weeklyTeaser, criticalTeaser].filter(Boolean);
  return parts.join(" ");
}

function buildPatternTeaser(state) {
  ensurePatternState(state);
  const result = getLatestPatternEcho(state);

  if (!result) {
    return null;
  }

  return `Wzorzec: ${result.pattern.title}. ${result.text}`;
}

function buildWeeklyStakeTeaser(state) {
  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return null;
  }

  const daysLeft = getWeeklyChallengeCountdown(state);
  return `Stawka: ${challenge.title} za ${daysLeft} ${dayWord(daysLeft)}.`;
}

function buildCriticalEventTeaser(state) {
  ensureCriticalEventState(state);
  const event = getCurrentCriticalEvent(state);

  if (!event) {
    return null;
  }

  const daysLeft = getCriticalEventCountdown(state);
  return `Wielki Test: ${event.title} za ${daysLeft} ${dayWord(daysLeft)}.`;
}

function dayWord(daysLeft) {
  return daysLeft === 1 ? "dzień" : "dni";
}
