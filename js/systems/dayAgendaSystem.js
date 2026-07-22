// dayAgendaSystem.js
//
// v0.13: Daily Agenda Prototype.
// Each day has three fixed slots: obligation, relationship and inner.
// Slot order is fixed for now; player-controlled ordering can come later.
//
// v0.31: Content Expansion Pack 1. eventData.js dostał 9 nowych
// eventów — import podbity do ?v=310. Ten plik funkcjonalnie się nie
// zmienił, to czysty cache-bust.

import { eventPool } from "../data/eventData.js?v=540";
import { getWeightedEventForDay } from "./eventWeightSystem.js?v=540";

const AGENDA_SLOT_ORDER = ["obligation", "relationship", "inner"];

const AGENDA_SLOT_LABELS = {
  obligation: "Obowiązek",
  relationship: "Relacja",
  inner: "Wewnętrzne"
};

export function ensureDailyAgenda(state) {
  if (state.dailyAgenda && state.dailyAgenda.day === state.day) {
    return state.dailyAgenda;
  }

  const previousEntry = Array.isArray(state.log) ? state.log[state.log.length - 1] : null;
  const previousEventId = previousEntry ? previousEntry.eventId : null;
  const chosenIds = [];

  const slots = AGENDA_SLOT_ORDER.map((slot) => {
    const eventId = pickEventIdForAgendaSlot(slot, state, previousEventId, chosenIds);
    chosenIds.push(eventId);

    return {
      slot,
      eventId,
      completed: false
    };
  });

  state.dailyAgenda = {
    day: state.day,
    slots,
    currentIndex: 0
  };

  return state.dailyAgenda;
}

export function getCurrentAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);
  return agenda.slots[agenda.currentIndex];
}

export function getCurrentAgendaProgress(state) {
  const agenda = ensureDailyAgenda(state);
  const currentItem = agenda.slots[agenda.currentIndex];

  return {
    current: agenda.currentIndex + 1,
    total: agenda.slots.length,
    slot: currentItem.slot,
    label: getAgendaSlotLabel(currentItem.slot)
  };
}

export function completeCurrentAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);
  const currentItem = agenda.slots[agenda.currentIndex];

  if (currentItem) {
    currentItem.completed = true;
  }

  return currentItem;
}

export function hasNextAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);
  return agenda.currentIndex < agenda.slots.length - 1;
}

export function moveToNextAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);

  if (agenda.currentIndex < agenda.slots.length - 1) {
    agenda.currentIndex += 1;
  }

  const nextItem = agenda.slots[agenda.currentIndex];

  state.currentEventId = nextItem.eventId;
  state.phase = "event";

  return state;
}

export function getAgendaSlotLabel(slot) {
  return AGENDA_SLOT_LABELS[slot] || "Nieznane";
}

function pickEventIdForAgendaSlot(slot, state, previousEventId, chosenIds) {
  const eligibleByDay = getEligibleEventsForDay(state.day);

  const eligibleBySlot = eligibleByDay.filter(
    (event) => Array.isArray(event.agendaSlots) && event.agendaSlots.includes(slot)
  );

  const slotPool = eligibleBySlot.length > 0 ? eligibleBySlot : eligibleByDay;

  const withoutTodayRepeats = slotPool.filter((event) => !chosenIds.includes(event.id));
  const candidates = withoutTodayRepeats.length > 0 ? withoutTodayRepeats : slotPool;

  const chosenEvent = getWeightedEventForDay(candidates, state, previousEventId);
  return chosenEvent.id;
}

function getEligibleEventsForDay(day) {
  const eligible = eventPool.filter((event) => !event.minDay || day >= event.minDay);
  return eligible.length > 0 ? eligible : eventPool;
}


// CLEAN v0.14 choose agenda order helpers START
export function getAvailableAgendaItems(state) {
  const agenda = ensureDailyAgenda(state);

  return agenda.slots
    .map((item, index) => ({
      index,
      slot: item.slot,
      label: getAgendaSlotLabel(item.slot),
      eventId: item.eventId,
      completed: item.completed
    }))
    .filter((item) => !item.completed);
}

export function hasRemainingAgendaItems(state) {
  const agenda = ensureDailyAgenda(state);
  return agenda.slots.some((item) => !item.completed);
}

export function selectAgendaItem(state, agendaIndex) {
  const agenda = ensureDailyAgenda(state);
  let selectedIndex = agendaIndex;
  let selectedItem = agenda.slots[selectedIndex];

  if (!selectedItem || selectedItem.completed) {
    const fallbackIndex = agenda.slots.findIndex((item) => !item.completed);

    if (fallbackIndex === -1) {
      return state;
    }

    selectedIndex = fallbackIndex;
    selectedItem = agenda.slots[selectedIndex];
  }

  agenda.currentIndex = selectedIndex;
  state.currentEventId = selectedItem.eventId;
  state.phase = "event";

  return state;
}
// CLEAN v0.14 choose agenda order helpers END
