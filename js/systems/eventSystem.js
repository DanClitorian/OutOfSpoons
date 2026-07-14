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

import { eventPool } from "../data/eventData.js?v=260";
import { modifySpoons } from "./spoonsSystem.js";
import { addFatigueDebt, ensureFatigueState } from "./fatigueSystem.js";
import { modifyTrust, modifyFrustration } from "./npcSystem.js";

import { getWeightedEventForDay } from "./eventWeightSystem.js?v=260";
import { completeCurrentAgendaItem } from "./dayAgendaSystem.js?v=260";
import { applyPatternPressureToChoice } from "./patternPressureSystem.js";
import { applyRelationshipScarsToChoice } from "./relationshipScarsSystem.js";
import { applyRepairFromChoice } from "./relationshipRepairSystem.js";
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
 * v0.24: Pattern Pressure. Realny koszt wyboru jest przepuszczany przez
 * applyPatternPressureToChoice() — jeśli gracz ma aktywny wzorzec
 * pasujący do tej decyzji, koszt spada o 1; jeśli wybór jest wyraźnym
 * przeciwieństwem aktywnego wzorca, koszt rośnie o 1. eventScreen.js
 * NIE wie nic o tej funkcji — dostępność kart liczona jest tam
 * wyłącznie na surowym choice.spoonsCost.
 *
 * v0.25: Relationship Scars. Dokładnie w tej kolejności:
 *   1. Pattern Pressure modyfikuje spoonsCost (bez zmian wobec v0.24).
 *   2. Budujemy BAZOWE consequences (spoonsChange z efektywnego kosztu,
 *      trustChange/frustrationChange wprost z choice).
 *   3. Relationship Scars dostaje te bazowe consequences i, jeśli
 *      aktywna blizna tematycznie pasuje, zwraca pomniejszony
 *      (efektywny) trustChange — nigdy nie dotyka spoons ani
 *      frustration, nigdy nie blokuje wyboru.
 *   4. Efektywny trust (nie surowy choice.trustChange) trafia do
 *      modifyTrust() i do finalnych consequences w logu.
 * Pattern Pressure i Relationship Scars działają na RÓŻNYCH polach
 * (spoons vs trust) i się nie mieszają.
 *
 * v0.26: Repair Events. PO zastosowaniu efektywnych consequences do
 * stanu, jeśli wybrana opcja ma metadata `repairAction` (tylko w
 * specjalnych eventach naprawczych, tag "repair-event" — nigdy
 * automatycznie po zwykłym dobrym wyborze), applyRepairFromChoice()
 * obniża intensity jednej aktywnej blizny o 1. Repair NIGDY nie zmienia
 * spoons/trust/frustration — działa wyłącznie na intensity blizny w
 * relationshipScarsSystem.js. eventScreen.js NIE importuje tego systemu
 * — dostępność kart jest od niego całkowicie niezależna.
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

  // Krok 1: Pattern Pressure na spoonsCost.
  const pressureResult = applyPatternPressureToChoice(state, event, choice);
  const effectiveSpoonsCost = pressureResult.spoonsCost;

  // Krok 2: bazowe consequences, PRZED Relationship Scars.
  const baseConsequences = {
    spoonsChange: -effectiveSpoonsCost,
    trustChange: choice.trustChange,
    frustrationChange: choice.frustrationChange
  };

  // Krok 3: Relationship Scars na trustChange (tylko trust, nigdy spoons/frustration).
  const scarResult = applyRelationshipScarsToChoice(state, event, choice, baseConsequences);
  const effectiveTrustChange = scarResult.applied ? scarResult.effectiveTrustChange : choice.trustChange;

  // Krok 4: zastosuj efektywne wartości do stanu.
  const currentSpoonsBeforeChoice = state.resources.spoons.current;
  const missingSpoons = Math.max(0, effectiveSpoonsCost - currentSpoonsBeforeChoice);

  modifySpoons(state, -effectiveSpoonsCost);
  const fatigueDebt = addFatigueDebt(state, missingSpoons);
  modifyTrust(state, partnerId, effectiveTrustChange);
  modifyFrustration(state, partnerId, choice.frustrationChange);

  // Krok 5: Relationship Repair — TYLKO jeśli choice ma repairAction.
  // Nie zmienia spoons/trust/frustration, działa wyłącznie na intensity
  // blizny (patrz relationshipRepairSystem.js).
  const repairResult = applyRepairFromChoice(state, event, choice);

  const resultText = choice.resultText.replace(/\{partnerName\}/g, state.partner.name);

  // v0.5: spoonsChange to zawsze liczba ujemna (albo zero) — koszt
  // wyboru odejmowany od zasobów gracza, zapisany wprost, żeby UI nie
  // musiało go samo przeliczać z choice.spoonsCost. v0.24/v0.25: to są
  // EFEKTYWNE wartości (po presji wzorców i bliznach relacyjnych), nie
  // surowe wartości z choice — reflection ma pokazywać to, co faktycznie
  // się stało.
  const consequences = {
    spoonsChange: -effectiveSpoonsCost,
    trustChange: effectiveTrustChange,
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
    },
    // v0.25: Relationship Scars. Tak samo — tylko do wewnętrznego
    // użytku (reflectionScreen.js). UI nigdy nie pokazuje trustDelta
    // jako liczby.
    relationshipScarEffect: scarResult.applied
      ? {
          applied: true,
          scarId: scarResult.scarId,
          trustDelta: scarResult.trustDelta,
          note: scarResult.note
        }
      : { applied: false },
    // v0.26: Repair Events. Tak samo — tylko do wewnętrznego użytku
    // (reflectionScreen.js). UI nigdy nie pokazuje intensity jako liczby.
    relationshipRepairEffect: repairResult.applied
      ? {
          applied: true,
          scarId: repairResult.scarId,
          resolved: repairResult.resolved,
          intensityBefore: repairResult.intensityBefore,
          intensityAfter: repairResult.intensityAfter,
          note: repairResult.note
        }
      : { applied: false }
  });

  completeCurrentAgendaItem(state);

  return choice;
}
