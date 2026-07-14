// eventSystem.js
//
// Logika wydarzeń decyzyjnych.
//
// v0.4: pula ma teraz kilka wydarzeń, więc getEventForDay(day) faktycznie
// losuje spośród nich (respektując opcjonalne pole minDay), zamiast
// zawsze zwracać to samo.
//
// v0.5.1: getEventForDay przyjmuje teraz opcjonalny drugi argument,
// previousEventId — event z poprzedniego dnia. Jeśli po filtrze minDay
// zostaje więcej niż jedna opcja, previousEventId jest wykluczany z puli
// przed losowaniem, żeby to samo wydarzenie nie pojawiało się dzień po
// dniu bez potrzeby. To wciąż czysto losowe podejście — nie ma pamięci
// o wydarzeniach starszych niż jeden dzień wstecz (świadomy, minimalny
// zakres tego hotfixu).
//
// Stabilność wydarzenia w ramach jednego dnia NIE jest zapewniana przez
// ten moduł — o to dba dayCycle.js, wywołując getEventForDay() dokładnie
// raz (przy przejściu poranek -> event) i zapamiętując wynik jako
// state.currentEventId. getEventById() poniżej służy właśnie do
// późniejszego, stabilnego odczytu tego samego wydarzenia bez ponownego
// losowania.

import { eventPool } from "../data/eventData.js?v=230";
import { modifySpoons } from "./spoonsSystem.js";
import { addFatigueDebt, ensureFatigueState } from "./fatigueSystem.js";
import { modifyTrust, modifyFrustration } from "./npcSystem.js";

import { getWeightedEventForDay } from "./eventWeightSystem.js?v=230";
import { completeCurrentAgendaItem } from "./dayAgendaSystem.js?v=230";
import { applyPatternPressureToChoice } from "./patternPressureSystem.js";
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Zwraca wydarzenia dopuszczalne danego dnia — takie, które albo nie
 * mają pola minDay, albo dzień gry jest >= ich minDay.
 */
function getEligibleEvents(day) {
  return eventPool.filter((event) => !event.minDay || day >= event.minDay);
}

/**
 * Losuje wydarzenie, które powinno się pojawić danego dnia.
 *
 * Wywoływana tylko raz na dzień (patrz dayCycle.goToEvent) — wynik
 * trzeba zapamiętać po stronie wywołującej, jeśli ma pozostać stabilny.
 *
 * @param {number} day - aktualny dzień rozgrywki.
 * @param {string|null} previousEventId - id wydarzenia z poprzedniego
 *   dnia (jeśli istnieje). Gdy podane, i pula dostępnych wydarzeń ma
 *   więcej niż jedną pozycję, to wydarzenie jest wykluczane z losowania,
 *   żeby uniknąć bezpośredniej powtórki dzień po dniu.
 */
export function getEventForDay(day, previousEventId = null, state = null) {
  const eligibleEvents = getEligibleEvents(day);
  const pool = eligibleEvents.length > 0 ? eligibleEvents : eventPool;

  if (state) {
    return getWeightedEventForDay(pool, state, previousEventId);
  }

  let candidates = pool;

  if (pool.length > 1 && previousEventId) {
    const withoutPrevious = pool.filter((event) => event.id !== previousEventId);

    if (withoutPrevious.length > 0) {
      candidates = withoutPrevious;
    }
  }

  return pickRandom(candidates);
}

/**
 * Zwraca pierwsze dostępne (spełniające minDay) wydarzenie dla danego
 * dnia, bez losowania. Używane jako deterministyczna siatka bezpieczeństwa
 * przez dayCycle.getCurrentEvent(), gdyby state.currentEventId z jakiegoś
 * powodu nie pasował do żadnego eventu w puli.
 */
export function getFirstAvailableEvent(day) {
  const eligibleEvents = getEligibleEvents(day);
  const pool = eligibleEvents.length > 0 ? eligibleEvents : eventPool;
  return pool[0];
}

/**
 * Zwraca wydarzenie o podanym id, bez żadnego losowania. Używane do
 * stabilnego odczytu wydarzenia dnia już zapisanego w state.currentEventId.
 */
export function getEventById(eventId) {
  return eventPool.find((event) => event.id === eventId);
}

/**
 * Aplikuje decyzję gracza do stanu gry: modyfikuje spoons, atrybuty NPC
 * i dopisuje wpis do logu wydarzeń — razem z tekstem rezultatu ORAZ
 * jawnym obiektem consequences (v0.5), żeby UI mogło pokazać mechaniczne
 * skutki wyboru wprost, bez zgadywania z resultText. Zwraca wybraną
 * opcję (przydatne do wyświetlenia rezultatu na ekranie refleksji).
 *
 * v0.24: Pattern Pressure. Dopiero TUTAJ, PO tym jak gracz już kliknął
 * kartę, realny koszt wyboru jest przepuszczany przez
 * applyPatternPressureToChoice() — jeśli gracz ma aktywny wzorzec
 * pasujący do tej decyzji, koszt spada o 1 (łatwiej wracać do znanej
 * reakcji); jeśli wybór jest wyraźnym przeciwieństwem aktywnego
 * wzorca, koszt rośnie o 1 (trudniej zejść z utartej ścieżki).
 * eventScreen.js NIE wie nic o tej funkcji — dostępność kart przed
 * kliknięciem liczona jest tam wyłącznie na surowym
 * choice.spoonsCost, więc Pattern Pressure nigdy nie zmienia, która
 * karta jest klikalna.
 */
export function applyChoice(state, event, choiceId) {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`Nieznany wybór "${choiceId}" dla wydarzenia "${event.id}"`);
  }

  // v0.3: wydarzenia w puli dotyczą obecnie zawsze aktualnego partnera
  // z rozgrywki. Gdy pojawią się wydarzenia z innymi NPC, trzeba tu
  // będzie dodać właściwe wskazanie celu zamiast zawsze brać partnera.
  const partnerId = state.partner.id;

  ensureFatigueState(state);

  const pressureResult = applyPatternPressureToChoice(state, event, choice);
  const effectiveSpoonsCost = pressureResult.spoonsCost;

  const currentSpoonsBeforeChoice = state.resources.spoons.current;
  const missingSpoons = Math.max(0, effectiveSpoonsCost - currentSpoonsBeforeChoice);

  modifySpoons(state, -effectiveSpoonsCost);
  const fatigueDebt = addFatigueDebt(state, missingSpoons);
  modifyTrust(state, partnerId, choice.trustChange);
  modifyFrustration(state, partnerId, choice.frustrationChange);

  const resultText = choice.resultText.replace(/\{partnerName\}/g, state.partner.name);

  // v0.5: spoonsChange to zawsze liczba ujemna (albo zero) — koszt
  // wyboru odejmowany od zasobów gracza, zapisany wprost, żeby UI nie
  // musiało go samo przeliczać z choice.spoonsCost. v0.24: to jest
  // EFEKTYWNY koszt (po presji wzorców), nie surowy choice.spoonsCost —
  // reflection ma pokazywać to, co faktycznie się stało.
  const consequences = {
    spoonsChange: -effectiveSpoonsCost,
    trustChange: choice.trustChange,
    frustrationChange: choice.frustrationChange,
    fatigueChange: fatigueDebt
  };

  state.log.push({
    day: state.day,
    eventId: event.id,
    choiceId: choice.id,
    resultText,
    consequences,
    // v0.24: Pattern Pressure. Zapisane TYLKO do wewnętrznego użytku
    // (reflectionScreen.js buduje z tego jedno subtelne zdanie) — nie
    // jest to nowy widoczny numer, tylko flaga + id wzorca.
    patternPressure: {
      applied: pressureResult.applied,
      alignedPatternId: pressureResult.alignedPatternId,
      opposedPatternId: pressureResult.opposedPatternId
    }
  });

  completeCurrentAgendaItem(state);

  return choice;
}
