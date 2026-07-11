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
// Wielkiego Testu dopisany jako TRZECIE zdanie w tym samym akapicie —
// wciąż jeden element DOM, wciąż bez zmian w layoucie/CSS. Podczas
// pierwszego tygodnia gry (dni 1-7) Weekly Stakes jeszcze nie istnieją
// (generują się dopiero po pierwszym weekly summary), więc naturalnie
// widać tylko teaser Wielkiego Testu — od 2. tygodnia widać oba.
function buildMorningNarrative(state) {
  const base = "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.";

  const parts = [base, buildWeeklyStakeTeaser(state), buildCriticalEventTeaser(state)].filter(Boolean);
  return parts.join(" ");
}

function buildWeeklyStakeTeaser(state) {
  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return null;
  }

  const daysLeft = getWeeklyChallengeCountdown(state);
  const dayWord = daysLeft === 1 ? "dzień" : "dni";

  return `Stawka tygodnia: ${challenge.title} za ${daysLeft} ${dayWord}.`;
}

function buildCriticalEventTeaser(state) {
  ensureCriticalEventState(state);
  const event = getCurrentCriticalEvent(state);

  if (!event) {
    return null;
  }

  const daysLeft = getCriticalEventCountdown(state);
  const dayWord = daysLeft === 1 ? "dzień" : "dni";

  return `Na horyzoncie: ${event.title} za ${daysLeft} ${dayWord}.`;
}
