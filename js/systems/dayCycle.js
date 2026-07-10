// dayCycle.js
//
// Orkiestrator pętli dnia. To jedyne miejsce w kodzie, które "wie",
// w jakiej kolejności następują fazy dnia (poranek -> wydarzenie ->
// refleksja -> kolejny dzień). Woła systemy (spoons, npc, event),
// ale nie dotyka UI — o to, co pokazać na ekranie, dbają moduły w js/ui/.

import { setState, getState } from "../state/gameState.js";
import { initNpc } from "./npcSystem.js";
import { regenerateSpoons } from "./spoonsSystem.js";
import { getEventForDay, getEventById, getFirstAvailableEvent, applyChoice } from "./eventSystem.js";
import { buildPlayer, calculateStartingSpoons } from "./characterSystem.js";
import { generatePartner } from "./partnerSystem.js";

// v0.5: wpisy w state.log zyskały pole "consequences" (jawne, mechaniczne
// skutki wyboru: spoonsChange/trustChange/frustrationChange), pokazywane
// teraz graczowi na ekranie refleksji. To kolejna niekompatybilna zmiana
// struktury zapisu, dlatego wersja rośnie do 5 (patrz też
// state/saveManager.js).
const SAVE_VERSION = 5;

// Ile spoons wraca po nocy. Świadomie mniej niż max — zmęczenie
// z poprzednich dni ma się kumulować, jeśli gracz nie dba o siebie.
// Wartość do skalibrowania wspólnie z projektantem gry.
const DAILY_SPOONS_REGEN = 6;

/**
 * Tworzy zupełnie nową rozgrywkę na podstawie danych z kreatora postaci
 * i losuje pierwszego partnera. Ustawia wynik jako aktualny stan gry.
 *
 * @param {object} playerData - { name, pronouns, selectedTraitIds }
 *   dokładnie to, co zbiera ekran kreatora postaci.
 */
export function startNewGame(playerData) {
  const partner = generatePartner();
  const player = buildPlayer(playerData);
  const startingSpoons = calculateStartingSpoons(player);

  const state = {
    saveVersion: SAVE_VERSION,
    day: 1,
    phase: "morning",
    // Brak wylosowanego wydarzenia na starcie dnia — pojawi się dopiero
    // przy przejściu do fazy "event" (patrz goToEvent niżej).
    currentEventId: null,
    player,
    partner,
    resources: {
      spoons: { current: startingSpoons, max: startingSpoons }
    },
    npcs: {
      [partner.id]: initNpc(partner)
    },
    log: []
  };

  setState(state);
  return state;
}

/**
 * Zwraca wydarzenie zaplanowane na aktualny dzień — to, którego id jest
 * zapisane w state.currentEventId. CELOWO nie losuje niczego na nowo:
 * to zapewnia, że wydarzenie dnia jest stabilne (wielokrotne wywołanie
 * w ramach tego samego dnia zawsze zwróci to samo wydarzenie).
 *
 * v0.5.1: zabezpieczenie na wypadek, gdyby currentEventId z jakiegoś
 * powodu nie pasował do żadnego eventu w puli (np. bardzo stary lub
 * uszkodzony zapis) — zamiast zwrócić undefined i wywalić grę dalej
 * w UI, bierzemy pierwszy dostępny event na dany dzień i naprawiamy
 * stan w locie, żeby kolejne wywołania też były spójne.
 */
export function getCurrentEvent() {
  const state = getState();
  const event = getEventById(state.currentEventId);
  if (event) {
    return event;
  }

  const fallbackEvent = getFirstAvailableEvent(state.day);
  state.currentEventId = fallbackEvent.id;
  return fallbackEvent;
}

/**
 * Przejście z fazy porannej do fazy wydarzenia. To jedyne miejsce, w
 * którym losowane jest wydarzenie dnia — jego id trafia do
 * state.currentEventId i zostaje tam aż do advanceToNextDay().
 *
 * v0.5.1: żeby uniknąć pokazywania tego samego wydarzenia dzień po dniu,
 * odczytujemy eventId z ostatniego wpisu w logu (czyli event
 * z poprzedniego dnia) i przekazujemy go do getEventForDay jako
 * previousEventId — ten wyklucza je z losowania, jeśli jest z czego wybierać.
 */
export function goToEvent() {
  const state = getState();
  const previousEntry = state.log[state.log.length - 1];
  const previousEventId = previousEntry ? previousEntry.eventId : null;
  const event = getEventForDay(state.day, previousEventId);
  state.currentEventId = event.id;
  state.phase = "event";
  return state;
}

/**
 * Aplikuje decyzję gracza w wydarzeniu i przechodzi do fazy refleksji.
 * Wydarzenie pobierane jest przez getCurrentEvent() (nie losowane
 * ponownie), więc wybór gracza zawsze dotyczy dokładnie tego wydarzenia,
 * które widział na ekranie — a przy okazji korzysta z tej samej siatki
 * bezpieczeństwa na wypadek niepasującego currentEventId.
 */
export function resolveEvent(choiceId) {
  const state = getState();
  const event = getCurrentEvent();
  const choice = applyChoice(state, event, choiceId);
  state.phase = "reflection";
  return { state, choice };
}

/**
 * Kończy dzień: regeneruje część spoons, resetuje wydarzenie dnia
 * i przechodzi do poranka kolejnego dnia.
 */
export function advanceToNextDay() {
  const state = getState();
  regenerateSpoons(state, DAILY_SPOONS_REGEN);
  state.day += 1;
  state.phase = "morning";
  state.currentEventId = null;
  return state;
}
