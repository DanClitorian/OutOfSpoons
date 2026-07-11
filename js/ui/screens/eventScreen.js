// eventScreen.js
//
// Daily event screen.
// v0.8:
// - shows current spoons before choices,
// - disables choices that cost more spoons than the player has,
// - if every choice is too expensive, keeps the cheapest one clickable
//   as the final available option,
// - replaces {partnerName} in title, description and choice labels.
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js).
//
// v0.19.1: Choice UX Polish. Wcześniej (v0.16-v0.19) karty pokazywały
// jakościowy "Koszt: niskie/średnie/wysokie · Niepewność: ..." przed
// wyborem. To USUNIĘTE — wybór ma wyglądać jak decyzja/dialog, nie jak
// kalkulator mechaniki. Jedyne, co karta może pokazać przed kliknięciem,
// to dostępność (statusText: "niedostępne teraz" / "ostatnia dostępna
// opcja") — to nie jest przewidywanie efektu, tylko stan wyboru.
// choice availability by spoons (blokowanie zbyt drogich wyborów,
// forced cheapest choice) NADAL działa dokładnie tak samo — zmienia się
// tylko to, co widać, nie logika dostępności ani mechanika konsekwencji.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";
import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const progress = getCurrentAgendaProgress(state);

  const topbar = createTopBar(
    state,
    "event",
    `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`
  );
  const sidebar = createSidebar(state, "event");

  const scene = createScenePanel({
    modifier: "event",
    title: replacePlaceholders(event.title, state)
  });

  const narrative = createNarrativeStrip(replacePlaceholders(event.description, state));

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  const cards = event.choices.map((choice) => buildChoiceCard(choice, state, currentSpoons, forcedChoice));

  const shell = createGameShell({
    screenClass: "event",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "flow"
  });

  container.appendChild(shell);
}

function buildChoiceCard(choice, state, currentSpoons, forcedChoice) {
  const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
  const canAfford = choice.spoonsCost <= currentSpoons;
  const isDisabled = !canAfford && !isForced;

  return createDecisionCard({
    title: replacePlaceholders(choice.label, state),
    statusText: isDisabled ? "niedostępne teraz" : isForced ? "ostatnia dostępna opcja" : null,
    disabled: isDisabled,
    onClick: () => {
      resolveEvent(choice.id);
      showScreen("reflection");
    }
  });
}

function getCheapestChoice(choices) {
  return choices.reduce((cheapest, choice) =>
    choice.spoonsCost < cheapest.spoonsCost ? choice : cheapest
  );
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}
