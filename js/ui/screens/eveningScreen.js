// eveningScreen.js
//
// v0.9: evening recovery screen.
// Flow:
//   morning -> event -> reflection -> evening -> next morning

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery
} from "../../systems/eveningRecoverySystem.js";
import { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";

export function renderEveningScreen(container) {
  const state = getState();

  const wrapper = document.createElement("div");
  wrapper.className = "screen evening-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczór";
  wrapper.appendChild(title);

  const phaseNote = document.createElement("p");
  phaseNote.className = "evening-phase-note";
  phaseNote.textContent = "Koniec dnia. To, co zostało w zasobach, przechodzi na jutro.";
  wrapper.appendChild(phaseNote);

  const intro = document.createElement("p");
  intro.className = "evening-intro";
  intro.textContent = "Dzień już się wydarzył. Teraz zostaje pytanie, co robisz z resztką siebie.";
  wrapper.appendChild(intro);

  const resourceSummary = document.createElement("p");
  resourceSummary.className = "evening-resource-summary";
  resourceSummary.textContent = `Spoons: ${state.resources.spoons.current}/${state.resources.spoons.max}`;
  wrapper.appendChild(resourceSummary);

  const options = document.createElement("div");
  options.className = "evening-options";

  getEveningRecoveryOptions(state).forEach((option) => {
    options.appendChild(renderEveningOptionButton(option, state));
  });

  wrapper.appendChild(options);
  container.appendChild(wrapper);
}

function renderEveningOptionButton(option, state) {
  const button = document.createElement("button");
  button.className = "evening-option-button";

  const label = document.createElement("span");
  label.className = "evening-option-label";
  label.textContent = replacePlaceholders(option.label, state);
  button.appendChild(label);

  const description = document.createElement("span");
  description.className = "evening-option-description";
  description.textContent = replacePlaceholders(option.description, state);
  button.appendChild(description);

  const effects = document.createElement("span");
  effects.className = "evening-option-effects";
  effects.textContent = formatEffects(option.effects);
  button.appendChild(effects);

    button.addEventListener("click", () => {
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
  });

  return button;
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
