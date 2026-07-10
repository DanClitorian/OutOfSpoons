// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.16: Visual Novel RPG Layout Redesign — agenda jest teraz planszą
// wyboru akcji (trzy duże karty) w panelu akcji wspólnego VN shellu,
// zamiast pionowej listy przycisków.
//
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
import { createVnShell, createScenePanel, createPlayerCard, createActionPanel } from "../vnLayout.js";

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

  const scene = createScenePanel({
    symbol: "🗒️",
    symbolModifier: "agenda",
    title: "Agenda dnia",
    text: "Wybierz, czym zajmiesz się teraz."
  });

  const side = createPlayerCard(state, `Dzień ${state.day} · Plan dnia`);

  const cards = agenda.slots.map((item, index) => renderAgendaChoiceButton(item, index, state));
  const actions = createActionPanel(cards);

  const shell = createVnShell({
    screenClass: "agenda",
    phaseLabel: "Plan dnia",
    scene,
    side,
    actions
  });

  container.appendChild(shell);
}

function renderAgendaChoiceButton(item, index, state) {
  const button = document.createElement("button");
  const classes = ["agenda-choice-button", "vn-action-card"];

  if (item.completed) {
    classes.push("agenda-choice-button--completed", "vn-action-card--completed");
  }

  button.className = classes.join(" ");
  button.disabled = item.completed;

  const header = document.createElement("span");
  header.className = "agenda-choice-header";

  const marker = document.createElement("span");
  marker.className = "agenda-choice-marker";
  marker.textContent = item.completed ? "[✓]" : "[ ]";
  header.appendChild(marker);

  const label = document.createElement("span");
  label.className = "agenda-choice-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  header.appendChild(label);

  const status = document.createElement("span");
  status.className = "agenda-choice-status";
  status.textContent = item.completed ? "ukończone" : "wybierz";
  header.appendChild(status);

  button.appendChild(header);
  button.appendChild(buildSlotMeta(item, state));

  if (!item.completed) {
    button.addEventListener("click", () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    });
  }

  return button;
}

// CLEAN v0.15 agenda choice cards START
// v0.15: RPG Gameplay Shell. Karty agendy mają teraz komunikować stawkę
// decyzji (obciążenie / ryzyko / hint), zamiast wyglądać jak lista pytań
// quizu. Te wartości są na razie czysto informacyjne — nie wpływają
// jeszcze na mechanikę wyboru ani na losowanie eventów.
function buildSlotMeta(item, state) {
  const meta = document.createElement("span");
  meta.className = "agenda-choice-card-meta vn-action-card-meta";

  const risk = document.createElement("span");
  risk.className = "agenda-choice-risk";
  risk.textContent = `Ryzyko: ${buildSlotRiskLabel(item)}`;
  meta.appendChild(risk);

  const pressure = document.createElement("span");
  pressure.className = "agenda-choice-pressure";
  pressure.textContent = `Obciążenie: ${buildSlotPressure(item, state)}`;
  meta.appendChild(pressure);

  const hint = document.createElement("span");
  hint.className = "agenda-choice-hint";
  hint.textContent = buildSlotOrderHint(item, state);
  meta.appendChild(hint);

  return meta;
}

function buildSlotPressure(item, state) {
  const spoons = state.resources.spoons.current;
  let pressure = "niskie";

  if (spoons <= 3) {
    pressure = "wysokie";
  } else if (spoons <= 6) {
    pressure = "średnie";
  }

  if (item.slot === "relationship") {
    const npc = getPartnerNpc(state);
    if (npc && Number(npc.frustration) >= 60) {
      pressure = "wysokie";
    }
  }

  if (item.slot === "obligation" && spoons <= 3) {
    pressure = "wysokie";
  }

  return pressure;
}

function buildSlotRiskLabel(item) {
  if (item.slot === "relationship") {
    return "emocjonalne";
  }

  if (item.slot === "obligation") {
    return "logistyczne";
  }

  if (item.slot === "inner") {
    return "regulacyjne";
  }

  return "nieznane";
}

function buildSlotOrderHint(item, state) {
  if (item.slot === "relationship") {
    return "Rozmowa później może być trudniejsza, jeśli wcześniej spadną Ci spoons.";
  }

  if (item.slot === "obligation") {
    return "Obowiązki zrobione wcześnie zdejmują presję, ale mogą zużyć energię przed relacją.";
  }

  if (item.slot === "inner") {
    return "Zajęcie się sobą wcześniej może pomóc wejść w resztę dnia spokojniej.";
  }

  return "";
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}
// CLEAN v0.15 agenda choice cards END
