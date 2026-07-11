// eveningScreen.js
//
// v0.9: evening recovery screen.
// Flow:
//   morning -> event -> reflection -> evening -> next morning
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Jest 5 opcji wieczornych
// (eveningRecoveryData.js) — panel akcji dostaje wariant
// "evening-{liczba}", żeby CSS mogło dobrać odpowiednią siatkę (5
// równych kolumn w jednym rzędzie, jeśli mieszczą się na 1366px, w
// przeciwnym razie 3+2) BEZ ucinania tytułów.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery
} from "../../systems/eveningRecoverySystem.js";
import { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

export function renderEveningScreen(container) {
  const state = getState();

  const topbar = createTopBar(state, "evening");
  const sidebar = createSidebar(state, "evening");

  const scene = createScenePanel({
    modifier: "evening",
    title: "Koniec dnia"
  });

  const narrative = createNarrativeStrip(
    "Dzień się domyka. To, co zostało w zasobach, przechodzi na jutro. Dzień już się wydarzył — teraz zostaje pytanie, co robisz z resztką siebie."
  );

  const options = getEveningRecoveryOptions(state);
  const cards = options.map((option) => buildEveningCard(option, state));

  const shell = createGameShell({
    screenClass: "evening",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: `evening-${cards.length}`
  });

  container.appendChild(shell);
}

function buildEveningCard(option, state) {
  return createDecisionCard({
    title: replacePlaceholders(option.label, state),
    description: replacePlaceholders(option.description, state),
    metaLines: [formatEffects(option.effects)],
    onClick: () => {
      const currentState = getState();
      const completedDay = currentState.day;

      applyEveningRecovery(option.id, currentState);
      advanceToNextDay();
      saveGame(currentState);

      if (shouldShowWeeklySummary(completedDay)) {
        showScreen("weeklySummary");
      } else {
        showScreen("game");
      }
    }
  });
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatEffects(effects) {
  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSigned(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSigned(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSigned(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
