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
// v0.16: przed wyborem NIE pokazujemy już dokładnych liczb (np.
// "− 3 spoons"). Zamiast tego pokazujemy jakościowy poziom (Koszt:
// niskie/średnie/wysokie, Niepewność: niska/średnia/wysoka). Dokładne
// liczby gracz widzi dopiero PO decyzji, na ekranie refleksji.
// choice availability by spoons (blokowanie zbyt drogich wyborów,
// forced cheapest choice) zostaje bez zmian — zmienia się tylko to,
// co widać, nie logika dostępności.
//
// v0.17: Asset-Based VN UI Implementation — scena używa teraz tła
// assets/scenes/scene-event.png, opis eventu trafia do osobnego
// narrative-strip pod sceną, a wybory wyglądają jak decision cards
// (assets/references/component-sheet.jpg), nie zwykłe przyciski.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";
import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js";
import {
  createVnShell,
  createTopBar,
  createScenePanel,
  createNarrativeStrip,
  createPlayerCard,
  createActionPanel
} from "../vnLayout.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const progress = getCurrentAgendaProgress(state);

  const topbar = createTopBar(state, "event", `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`);
  const side = createPlayerCard(state, "event");

  const scene = createScenePanel({
    symbolModifier: "event",
    title: replacePlaceholders(event.title, state)
  });

  const narrative = createNarrativeStrip(replacePlaceholders(event.description, state));

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  event.choices.forEach((choice) => {
    const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
    choicesList.appendChild(renderChoiceButton(choice, state, currentSpoons, isForced));
  });

  const actions = createActionPanel([choicesList], "stack");

  const shell = createVnShell({
    screenClass: "event",
    topbar,
    side,
    scene,
    narrative,
    actions
  });

  container.appendChild(shell);
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

function renderChoiceButton(choice, state, currentSpoons, isForced) {
  const button = document.createElement("button");
  const canAfford = choice.spoonsCost <= currentSpoons;
  const isDisabled = !canAfford && !isForced;

  button.className = `${buildChoiceButtonClass(isDisabled, isForced)} vn-choice-button`;

  const label = document.createElement("span");
  label.className = "choice-label";
  label.textContent = replacePlaceholders(choice.label, state);
  button.appendChild(label);

  const cost = renderChoiceCost(choice, currentSpoons, isDisabled, isForced);
  if (cost) {
    button.appendChild(cost);
  }

  button.disabled = isDisabled;

  if (!isDisabled) {
    button.addEventListener("click", () => {
      resolveEvent(choice.id);
      showScreen("reflection");
    });
  }

  return button;
}

function buildChoiceButtonClass(isDisabled, isForced) {
  const classes = ["choice-button"];

  if (isDisabled) {
    classes.push("choice-button--disabled");
  }

  if (isForced) {
    classes.push("choice-button--forced");
  }

  return classes.join(" ");
}

function renderChoiceCost(choice, currentSpoons, isDisabled, isForced) {
  const cost = document.createElement("span");
  cost.className = "choice-cost";
  cost.textContent = `Koszt: ${buildCostTier(choice.spoonsCost)} · Niepewność: ${buildUncertaintyTier(choice)}`;

  if (isDisabled) {
    cost.appendChild(renderChoiceNote(" · niedostępne teraz"));
  } else if (isForced) {
    cost.appendChild(renderChoiceNote(" · ostatnia dost\u0119pna opcja"));
  }

  return cost;
}

// zamiast dokładnej liczby spoons (np. "− 3 spoons"), pokazujemy tylko
// jakościowy poziom kosztu. Progi dobrane pod realny zakres spoonsCost
// w eventData.js (0-5).
function buildCostTier(spoonsCost) {
  if (spoonsCost <= 0) {
    return "brak";
  }

  if (spoonsCost <= 2) {
    return "niskie";
  }

  if (spoonsCost <= 4) {
    return "\u015brednie";
  }

  return "wysokie";
}

// "niepewność" to jakościowa miara tego, jak mocno wybór może poruszyć
// zaufanie/frustrację — bez ujawniania kierunku ani wartości.
function buildUncertaintyTier(choice) {
  const magnitude = Math.abs(choice.trustChange || 0) + Math.abs(choice.frustrationChange || 0);

  if (magnitude <= 3) {
    return "niska";
  }

  if (magnitude <= 8) {
    return "\u015brednia";
  }

  return "wysoka";
}

function renderChoiceNote(text) {
  const note = document.createElement("span");
  note.className = "choice-unavailable-note";
  note.textContent = text;
  return note;
}
