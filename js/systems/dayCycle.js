// dayCycle.js
//
// Orkiestrator pętli dnia. To jedyne miejsce w kodzie, które "wie",
// w jakiej kolejności następują fazy dnia (poranek -> wydarzenie ->
// refleksja -> kolejny dzień). Woła systemy (spoons, npc, event),
// ale nie dotyka UI — o to, co pokazać na ekranie, dbają moduły w js/ui/.

import { setState, getState } from "../state/gameState.js";
import { npcData } from "../data/npcData.js";
import { initNpc } from "./npcSystem.js";
import { regenerateSpoons } from "./spoonsSystem.js";
import { getEventForDay, applyChoice } from "./eventSystem.js";
import { buildPlayer, calculateStartingSpoons } from "./characterSystem.js";

// v0.2: struktura zapisu zyskała pole "player" (kreator postaci).
// To zmiana niekompatybilna ze starymi zapisami z v0.1, dlatego wersja
// rośnie do 2 (patrz też state/saveManager.js).
const SAVE_VERSION = 2;

// Ile spoons wraca po nocy. Świadomie mniej niż max — zmęczenie
// z poprzednich dni ma się kumulować, jeśli gracz nie dba o siebie.
// Wartość do skalibrowania wspólnie z projektantem gry.
const DAILY_SPOONS_REGEN = 6;

/**
 * Tworzy zupełnie nową rozgrywkę na podstawie danych z kreatora postaci
 * i ustawia ją jako aktualny stan gry.
 *
 * @param {object} playerData - { name, pronouns, selectedTraitIds }
 *   dokładnie to, co zbiera ekran kreatora postaci.
 */
export function startNewGame(playerData) {
  const alex = initNpc(npcData.alex);
  const player = buildPlayer(playerData);
  const startingSpoons = calculateStartingSpoons(player);

  const state = {
    saveVersion: SAVE_VERSION,
    day: 1,
    phase: "morning",
    player,
    resources: {
      spoons: { current: startingSpoons, max: startingSpoons }
    },
    npcs: {
      [alex.id]: alex
    },
    log: []
  };

  setState(state);
  return state;
}

/**
 * Zwraca wydarzenie zaplanowane na aktualny dzień.
 */
export function getCurrentEvent() {
  const state = getState();
  return getEventForDay(state.day);
}

/**
 * Przejście z fazy porannej do fazy wydarzenia.
 */
export function goToEvent() {
  const state = getState();
  state.phase = "event";
  return state;
}

/**
 * Aplikuje decyzję gracza w wydarzeniu i przechodzi do fazy refleksji.
 */
export function resolveEvent(choiceId) {
  const state = getState();
  const event = getEventForDay(state.day);
  const choice = applyChoice(state, event, choiceId);
  state.phase = "reflection";
  return { state, choice };
}

/**
 * Kończy dzień: regeneruje część spoons i przechodzi do poranka
 * kolejnego dnia.
 */
export function advanceToNextDay() {
  const state = getState();
  regenerateSpoons(state, DAILY_SPOONS_REGEN);
  state.day += 1;
  state.phase = "morning";
  return state;
}