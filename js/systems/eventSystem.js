// eventSystem.js
//
// Logika wydarzeń decyzyjnych. Napisana tak, by od razu obsługiwać
// wiele wydarzeń w puli — w v0.1 pula zawiera tylko jedno wydarzenie,
// ale funkcja wyboru wydarzenia (getEventForDay) jest już osobną
// funkcją, gotową na rozbudowę o warunki (dzień, stan zasobów,
// relacje z NPC itd.) bez zmiany reszty systemu.

import { eventPool } from "../data/eventData.js";
import { modifySpoons } from "./spoonsSystem.js";
import { modifyTrust, modifyFrustration } from "./npcSystem.js";

/**
 * Zwraca wydarzenie, które powinno się pojawić danego dnia.
 *
 * v0.1: zawsze zwraca pierwsze wydarzenie z puli.
 * W przyszłości: filtrowanie eventPool po warunkach (dzień, zasoby,
 * relacje, wcześniejsza historia) i losowanie spośród pasujących.
 */
export function getEventForDay(day) {
  const availableEvents = eventPool;
  return availableEvents[0];
}

/**
 * Aplikuje wybór gracza do stanu gry: modyfikuje spoons, atrybuty NPC
 * i dopisuje wpis do logu wydarzeń. Zwraca wybraną opcję (przydatne
 * do wyświetlenia rezultatu na ekranie refleksji).
 */
export function applyChoice(state, event, choiceId) {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`Nieznany wybór "${choiceId}" dla wydarzenia "${event.id}"`);
  }

  modifySpoons(state, -choice.spoonsCost);
  modifyTrust(state, event.npcId, choice.trustChange);
  modifyFrustration(state, event.npcId, choice.frustrationChange);

  state.log.push({
    day: state.day,
    eventId: event.id,
    choiceId: choice.id,
    resultText: choice.resultText
  });

  return choice;
}
