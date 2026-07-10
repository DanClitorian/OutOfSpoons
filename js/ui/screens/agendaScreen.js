// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// The player chooses which remaining daily agenda slot to handle next.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureDailyAgenda,
  getAvailableAgendaItems,
  selectAgendaItem,
  getAgendaSlotLabel
} from "../../systems/dayAgendaSystem.js";

export function renderAgendaScreen(container) {
  const state = getState();
  const agenda = ensureDailyAgenda(state);
  const availableItems = getAvailableAgendaItems(state);

  if (availableItems.length === 0) {
    state.phase = "evening";
    saveGame(state);
    showScreen("evening");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "screen agenda-choice-screen";

  const title = document.createElement("h2");
  title.textContent = "Agenda dnia";
  wrapper.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "agenda-choice-intro";
  intro.textContent = "Wybierz, czym zajmiesz się teraz.";
  wrapper.appendChild(intro);

  const list = document.createElement("div");
  list.className = "agenda-choice-list";

  agenda.slots.forEach((item, index) => {
    list.appendChild(renderAgendaChoiceButton(item, index, state));
  });

  wrapper.appendChild(list);
  container.appendChild(wrapper);
}

function renderAgendaChoiceButton(item, index, state) {
  const button = document.createElement("button");
  const classes = ["agenda-choice-button"];

  if (item.completed) {
    classes.push("agenda-choice-button--completed");
  }

  button.className = classes.join(" ");
  button.disabled = item.completed;

  const marker = document.createElement("span");
  marker.className = "agenda-choice-marker";
  marker.textContent = item.completed ? "[✓]" : "[ ]";
  button.appendChild(marker);

  const label = document.createElement("span");
  label.className = "agenda-choice-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  button.appendChild(label);

  const status = document.createElement("span");
  status.className = "agenda-choice-status";
  status.textContent = item.completed ? "ukończone" : "wybierz";
  button.appendChild(status);

  if (!item.completed) {
    button.addEventListener("click", () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    });
  }

  return button;
}
