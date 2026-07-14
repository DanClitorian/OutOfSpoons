// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js).
// v0.19: Weekly Stakes — teaser aktywnego wyzwania w narracji.
//
// v0.19.1: Choice UX Polish. Karty agendy NIE pokazują już Ryzyka ani
// Napięcia (buildSlotPressure/buildSlotRiskLabel/buildSlotOrderHint
// zostały usunięte razem z całą tą warstwą) — to były przewidywane
// efekty mechaniczne, a wybór ma wyglądać jak decyzja/dialog, nie jak
// kalkulator. Karta pokazuje tylko: ikonę, tytuł, status (wybierz /
// ukończone) i krótki opis tonu decyzji.
//
// The player chooses which remaining daily agenda slot to handle next.
//
// v0.26: Repair Events. Ten plik NIE ZMIENIŁ SIĘ funkcjonalnie — nowe
// eventy naprawcze i ich ważenie nie mają osobnego UI na agendzie
// (zwykłe karty slotów). Import dayAgendaSystem.js dostał ?v=260, bo
// dayAgendaSystem.js zmienił WŁASNE importy eventData.js/
// eventWeightSystem.js (oba faktycznie zmieniły zawartość) — a to
// WŁAŚNIE TEN plik (przez ensureDailyAgenda) faktycznie wybiera event
// dla każdego slotu agendy, więc jego świeżość jest krytyczna dla
// realnego działania ważenia eventów naprawczych, nie tylko kosmetyczna.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureDailyAgenda,
  getAvailableAgendaItems,
  selectAgendaItem,
  getAgendaSlotLabel
} from "../../systems/dayAgendaSystem.js?v=260";
import {
  ensureWeeklyChallengeState,
  getCurrentWeeklyChallenge,
  formatWeeklyChallengeCondition
} from "../../systems/weeklyChallengeSystem.js";
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

  const narrative = createNarrativeStrip(buildAgendaNarrative(state));

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

// v0.19: Weekly Stakes. Krótki teaser aktywnego wyzwania — jak w
// gameScreen.js, drugie zdanie w tym samym akapicie narracji, bez
// nowych elementów DOM ani zmian w layoucie v0.18.
//
// v0.19.1: separator warunków zamieniony na "·" (zamiast " i ") tylko
// w tym miejscu — trochę krócej, mniejsze ryzyko ucinania długiego
// teasera w wąskim pasku narracji. weeklySummaryScreen.js nadal używa
// pełnego " i " (tam jest więcej miejsca).
function buildAgendaNarrative(state) {
  const base = "Wybierz, czym zajmiesz się teraz. Kolejność ma znaczenie.";

  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return base;
  }

  const condition = formatWeeklyChallengeCondition(challenge).replace(/ i /g, " · ");
  return `${base} W tle wisi: ${challenge.title}. Warunek: ${condition}.`;
}

function buildAgendaCard(item, index, state) {
  return createDecisionCard({
    icon: item.completed ? "✓" : SLOT_ICONS[item.slot] || "•",
    title: getAgendaSlotLabel(item.slot),
    statusText: item.completed ? "ukończone" : "wybierz",
    description: SLOT_DESCRIPTIONS[item.slot] || "",
    disabled: item.completed,
    onClick: () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    }
  });
}
