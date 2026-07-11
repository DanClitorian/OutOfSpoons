// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Karty slotów mają pełne,
// nieucinane tytuły i czytelne linie ryzyka/napięcia/hintu, każda
// osobno (nie sklejone w jeden string, jak to się zdarzało w v0.17.x).
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
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

const SLOT_ICONS = {
  obligation: "📌",
  relationship: "💬",
  inner: "🧠"
};

const SLOT_DESCRIPTIONS = {
  obligation: "Sprawy, które i tak trzeba załatwić.",
  relationship: "Bliskość i napięcie między Tobą a partnerem.",
  inner: "To, jak się dziś czujesz i ile jeszcze masz w sobie."
};

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

  const topbar = createTopBar(state, "agenda");
  const sidebar = createSidebar(state, "agenda");

  const scene = createScenePanel({
    modifier: "agenda",
    title: "Plan dnia"
  });

  const narrative = createNarrativeStrip("Wybierz, czym zajmiesz się teraz. Kolejność ma znaczenie.");

  const cards = agenda.slots.map((item, index) => buildAgendaCard(item, index, state));

  const shell = createGameShell({
    screenClass: "agenda",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "triple"
  });

  container.appendChild(shell);
}

function buildAgendaCard(item, index, state) {
  return createDecisionCard({
    icon: item.completed ? "✓" : SLOT_ICONS[item.slot] || "•",
    title: getAgendaSlotLabel(item.slot),
    statusText: item.completed ? "ukończone" : "wybierz",
    description: SLOT_DESCRIPTIONS[item.slot] || "",
    metaLines: [
      `Ryzyko: ${buildSlotRiskLabel(item)}`,
      `Napięcie: ${buildSlotPressure(item, state)}`,
      buildSlotOrderHint(item)
    ],
    disabled: item.completed,
    onClick: () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    }
  });
}

// v0.15: RPG Gameplay Shell. Karty agendy komunikują stawkę decyzji
// (napięcie / ryzyko / hint) — czysto informacyjnie, bez wpływu na
// mechanikę wyboru ani na losowanie eventów.
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

function buildSlotOrderHint(item) {
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
