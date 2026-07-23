// dayCycle.js
//
// Orkiestrator pętli dnia. To jedyne miejsce w kodzie, które "wie",
// w jakiej kolejności następują fazy dnia (poranek -> wydarzenie ->
// refleksja -> kolejny dzień). Woła systemy (spoons, npc, event),
// ale nie dotyka UI — o to, co pokazać na ekranie, dbają moduły w js/ui/.
//
// v0.24: Pattern Pressure. Import eventSystem.js dostał ?v=240 —
// eventSystem.js zmienił zawartość (integracja presji wzorców w
// applyChoice, działająca WYŁĄCZNIE po kliknięciu), więc przeglądarka
// nie może dalej używać starej, cache'owanej wersji. Sama logika
// dayCycle.js jest NIETKNIĘTA, to wyłącznie cache-busting.
//
// v0.25: Relationship Scars. eventSystem.js znowu zmienił zawartość
// (integracja blizn relacyjnych w applyChoice) — import podbity do
// ?v=250. Sama logika dayCycle.js nadal NIETKNIĘTA.
//
// v0.26: Repair Events. eventSystem.js znowu zmienił zawartość
// (integracja naprawy blizn w applyChoice) — import podbity do ?v=260.
// Sama logika dayCycle.js nadal NIETKNIĘTA.
//
// v0.31: Content Expansion Pack 1. eventSystem.js i dayAgendaSystem.js
// oba zmieniły WŁASNE importy eventData.js (9 nowych eventów) — importy
// podbite do ?v=310. Sama logika dayCycle.js nadal NIETKNIĘTA.
//
// v0.49: Fatigue Economy Reconnection. advanceToNextDay() wykonuje
// teraz PEŁNY cykl fatigue (updateFatigueAfterDay przed inkrementem
// dnia, applyMorningSpoonsFromFatigue po nim) — obie funkcje były
// importowane od v0.8.1, ale nigdy nie wywoływane. Import
// fatigueSystem.js podbity do ?v=490 (zmieniona semantyka
// applyMorningSpoonsFromFatigue), eventSystem.js do ?v=490 (podbił
// swój import fatigueSystem.js).
//
// v0.33: Masking Debt. eventSystem.js znowu zmienił zawartość
// (integracja długu maskowania w applyChoice, działająca WYŁĄCZNIE po
// kliknięciu, dokładnie jak Pattern Pressure/Scars/Repair/Metamour/
// Work) — import podbity do ?v=330. Sama logika dayCycle.js nadal
// NIETKNIĘTA.

import { setState, getState } from "../state/gameState.js";
import { initNpc } from "./npcSystem.js";
// v0.49: import regenerateSpoons USUNIĘTY — był martwy od v0.8.2
// (nic go nie wywoływało) i tylko sugerował mechanikę, która nie
// istniała. Nocną regenerację robi teraz applyMorningSpoonsFromFatigue.
import { ensureFatigueState, updateFatigueAfterDay, applyMorningSpoonsFromFatigue } from "./fatigueSystem.js?v=490";
// v0.52: Weekly Stakes Tracking — jeden ślad dziennie, zapisywany przy
// przejściu dnia (idempotentny guard w samym systemie). Czysta,
// minimalna integracja: import + jedno wywołanie w advanceToNextDay.
import { recordWeeklyTrackingMark } from "./weeklyStakesTrackingSystem.js?v=520";
// v0.55: Narrative Consequence Memory. Wygasanie sladow — raz
// dziennie, PO inkrementacji state.day (patrz decayNarrativeMemory
// dla guardu lastDecayedDay przeciw podwojnemu odpaleniu).
import { decayNarrativeMemory } from "./narrativeMemorySystem.js?v=560";
import { getEventForDay, getEventById, getFirstAvailableEvent, applyChoice } from "./eventSystem.js?v=601";
import { buildPlayer, calculateStartingSpoons } from "./characterSystem.js";
import { generatePartner } from "./partnerSystem.js";

import { ensureMorningEventState, resolveMorningEvents } from "./morningEventSystem.js";
import { ensureDailyAgenda, getCurrentAgendaItem } from "./dayAgendaSystem.js?v=601";
// v0.5: wpisy w state.log zyskały pole "consequences" (jawne, mechaniczne
// skutki wyboru: spoonsChange/trustChange/frustrationChange), pokazywane
// teraz graczowi na ekranie refleksji. To kolejna niekompatybilna zmiana
// struktury zapisu, dlatego wersja rośnie do 5 (patrz też
// state/saveManager.js).
const SAVE_VERSION = 5;

// v0.49: Nocna regeneracja — wreszcie WPIĘTA (bazowa pula przekazywana
// do applyMorningSpoonsFromFatigue, która pomniejsza ją o fatigue).
// Wartość zmieniona z historycznego 6 na 3: szóstka była projektowana,
// gdy noc miała być JEDYNYM źródłem odnowy — od tamtej pory doszły
// opcje wieczorne (do +3, v0.9) i eventy poranne (~+1 średnio, v0.8.2).
// Przy 6 typowy dzień kończyłby się de facto resetem do max — wbrew
// filozofii persistent spoons. 3 to punkt startowy pod zapowiedziany
// osobny playtest balansu, nie ostateczna kalibracja.
const DAILY_SPOONS_REGEN = 3;

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
      spoons: { current: startingSpoons, max: startingSpoons },
      fatigue: { current: 0, max: 6, lastChange: 0, lastReason: "new-game" }
    },
    npcs: {
      [partner.id]: initNpc(partner)
    },
    log: []
  };

  state.morningEventHistory = { lastGlobalId: null, lastPartnerKindnessId: null };
  state.todayMorningEvents = {
    day: state.day,
    events: [],
    spoonsBefore: state.resources.spoons.current,
    spoonsAfter: state.resources.spoons.current,
    netSpoonsChange: 0
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
  ensureFatigueState(state);
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

  ensureDailyAgenda(state);

  const currentItem = getCurrentAgendaItem(state);
  state.currentEventId = currentItem.eventId;
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

  if (state.relationshipEnd && state.relationshipEnd.active) {
    state.phase = "relationshipEnd";
  } else {
    state.phase = "reflection";
  }

  return { state, choice };
}

/**
 * Kończy dzień: regeneruje część spoons, resetuje wydarzenie dnia
 * i przechodzi do poranka kolejnego dnia.
 */
export function advanceToNextDay() {
  const state = getState();

  // v0.52, KONIEC DNIA (krok 0): ślad Stawki Tygodnia — oceniamy stan
  // "jak dzień się skończył" (łącznie z wyborem wieczornym z v0.51),
  // PRZED rozliczeniem fatigue i inkrementem dnia. Guard
  // lastEvaluatedDay w systemie: jeden dzień = maksymalnie jeden ślad.
  recordWeeklyTrackingMark(state);

  // v0.49, KONIEC DNIA: rozliczenie długu zmęczenia na stanie PO
  // wieczornej decyzji (eveningScreen woła advanceToNextDay już po
  // applyEveningRecovery — więc np. wcześniejsze pójście spać może
  // realnie obniżyć fatigue). Progi (patrz fatigueSystem.js):
  // koniec na 0 spoons: +2; na <=25% max: +1; z zapasem >=50% max: -1.
  updateFatigueAfterDay(state);

  // v0.8.2 / v0.49:
  // Spoons są PERSYSTENTNE. Nadal ŻADNEGO resetu do max. Nowy poranek
  // = wczorajsza końcówka + nocna regeneracja pomniejszona o fatigue
  // (minimum 1 spoon — zero softlocka), a dopiero POTEM globalny i
  // partnerski event poranny modyfikują wynik.
  state.day += 1;
  state.phase = "morning";
  state.currentEventId = null;

  // v0.55: DECAY sladow narracyjnych — po inkrementacji dnia, zeby
  // slad utworzony WCZORAJ (expiresDay liczony od dnia utworzenia)
  // przezyl dokladnie tyle dni, ile deklaruje jego intensity.
  decayNarrativeMemory(state);

  applyMorningSpoonsFromFatigue(state, DAILY_SPOONS_REGEN);

  ensureMorningEventState(state);
  resolveMorningEvents(state);

  return state;
}
