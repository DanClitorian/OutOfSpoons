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
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createCtaButton
} from "../oosLayout.js";

export function renderGameScreen(container) {
  const state = getState();

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
function buildMorningNarrative(state) {
  const base = "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.";

  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return base;
  }

  const daysLeft = getWeeklyChallengeCountdown(state);
  const dayWord = daysLeft === 1 ? "dzień" : "dni";

  return `${base} Stawka tygodnia: ${challenge.title} za ${daysLeft} ${dayWord}.`;
}
