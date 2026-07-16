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

import { eventPool } from "../data/eventData.js?v=390";
import { modifySpoons } from "./spoonsSystem.js";
import { addFatigueDebt, ensureFatigueState } from "./fatigueSystem.js";
import { modifyTrust, modifyFrustration } from "./npcSystem.js";

import { getWeightedEventForDay } from "./eventWeightSystem.js?v=300";
import { completeCurrentAgendaItem } from "./dayAgendaSystem.js?v=310";
import { applyPatternPressureToChoice } from "./patternPressureSystem.js?v=300";
import { applyRelationshipScarsToChoice } from "./relationshipScarsSystem.js?v=300";
import { applyRepairFromChoice } from "./relationshipRepairSystem.js?v=300";
import { applyMetamourEffectFromChoice, formatWithMetamourPlaceholders } from "./metamourSystem.js?v=300";
import { applyWorkEffectFromChoice } from "./workPressureSystem.js?v=300";
import { applyMaskingDebtFromChoice } from "./maskingDebtSystem.js?v=330";
import { applyConflictPressureFromChoice } from "./conflictEscalationSystem.js?v=350";
import { evaluateRelationshipEndAfterChoice } from "./relationshipEndStateSystem.js?v=360";
import { applyRomanceInterestFromChoice } from "./romanceInterestSystem.js?v=370";
import { applySecrecyConsequenceFromChoice } from "./secrecyConsequenceSystem.js?v=380";
import { applyRelationshipAgreementFromChoice } from "./relationshipAgreementSystem.js?v=390";
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

  // v0.28: Metamour — wpływa wyłącznie na state.partner.metamour.
  const metamourResult = applyMetamourEffectFromChoice(state, event, choice);

  // v0.29: Work Pressure — wpływa wyłącznie na state.player.work.
  const workResult = applyWorkEffectFromChoice(state, event, choice);

  // v0.33: Masking Debt. NIE zmienia spoons/trust/frustration teraz —
  // tylko zwiększa state.player.maskingDebt.current (max 6), jeśli
  // wybór wygląda jak maskowanie (patrz maskingDebtSystem.js#
  // detectMaskingChoice, celowo ostrożne wykrywanie). Koszt przychodzi
  // dopiero rano, przez resolveMorningMaskingDebt() w gameScreen.js.
  const maskingDebtResult = applyMaskingDebtFromChoice(state, event, choice);

  // v0.37: Romance Interest. Nie kończy gry i nie nazywa automatycznie
  // fascynacji zdradą. Klasyfikacja zależy od Relationship Model.
  const romanceResult = applyRomanceInterestFromChoice(state, event, choice);

  // v0.38: Secrecy Consequences. Większość efektu jest wewnętrzna.
  // Trust/frustration zmieniają się dopiero, jeśli sekret zostanie zauważony
  // albo jeśli ujawnienie realnie zmieni temperaturę relacji.
  const secrecyResult = applySecrecyConsequenceFromChoice(state, event, choice, {
    romanceResult,
    effectiveTrustChange,
    scarResult,
    repairResult,
    maskingDebtResult
  });

  // v0.39: Relationship Agreements. Gameplayowa rozmowa o zasadach —
  // modyfikuje clarity modelu relacji, nie zmienia automatycznie typu relacji.
  const agreementResult = applyRelationshipAgreementFromChoice(state, event, choice);

  if (secrecyResult.trustChange) {
    modifyTrust(state, partnerId, secrecyResult.trustChange);
  }

  if (secrecyResult.frustrationChange) {
    modifyFrustration(state, partnerId, secrecyResult.frustrationChange);
  }

  // v0.35: Conflict Escalation. Nie zmienia spoons/trust/frustration —
  // zapisuje tylko narastanie lub obniżenie napięcia relacyjnego.
  const conflictResult = applyConflictPressureFromChoice(state, event, choice, {
    effectiveTrustChange,
    effectiveSpoonsCost,
    fatigueDebt,
    pressureResult,
    scarResult,
    repairResult,
    metamourResult,
    workResult,
    maskingDebtResult
  });

  // v0.36: Relationship End States. Może ustawić state.relationshipEnd.active,
  // ale nie dodaje romansu/zdrady i nie zmienia zasobów.
  const relationshipEndResult = evaluateRelationshipEndAfterChoice(state, event, choice, {
    effectiveTrustChange,
    effectiveSpoonsCost,
    fatigueDebt,
    pressureResult,
    scarResult,
    repairResult,
    metamourResult,
    workResult,
    maskingDebtResult,
    romanceResult,
    secrecyResult,
    agreementResult,
    conflictResult
  });

  const resultText = formatWithMetamourPlaceholders(choice.resultText, state);

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
      : { applied: false },
    // v0.28: Metamour. Tylko do logu/devTools/reflection — UI nie pokazuje liczb.
    metamourEffect: metamourResult.applied
      ? {
          applied: true,
          familiarityChange: metamourResult.familiarityChange,
          tensionChange: metamourResult.tensionChange,
          familiarityAfter: metamourResult.familiarityAfter,
          tensionAfter: metamourResult.tensionAfter
        }
      : { applied: false },
    // v0.29: Work Pressure. Tylko do logu/devTools/reflection — UI nie pokazuje liczb.
    workEffect: workResult.applied
      ? {
          applied: true,
          pressureChange: workResult.pressureChange,
          stabilityChange: workResult.stabilityChange,
          burnoutChange: workResult.burnoutChange,
          pressureAfter: workResult.pressureAfter,
          stabilityAfter: workResult.stabilityAfter,
          burnoutAfter: workResult.burnoutAfter
        }
      : { applied: false },
    // v0.33: Masking Debt. Tylko do logu/devTools/reflection — UI nie
    // pokazuje liczb ani "masking debt +1". Dług boli dopiero rano.
    maskingDebtEffect: maskingDebtResult.applied
      ? {
          applied: true,
          amount: maskingDebtResult.amount,
          currentAfter: maskingDebtResult.currentAfter,
          text: maskingDebtResult.text
        }
      : { applied: false },
    // v0.39: Relationship Agreement Conversation. Tylko log/reflection.
    agreementEffect: agreementResult.applied
      ? {
          applied: true,
          clarityBefore: agreementResult.clarityBefore,
          clarityAfter: agreementResult.clarityAfter,
          clarityChange: agreementResult.clarityChange,
          modelType: agreementResult.modelType,
          note: agreementResult.note
        }
      : { applied: false },
    // v0.38: Secrecy Consequences. Tylko log/reflection/devTools.
    secrecyEffect: secrecyResult.applied
      ? {
          applied: true,
          currentAfter: secrecyResult.currentAfter,
          suspicionAfter: secrecyResult.suspicionAfter,
          breachRisk: secrecyResult.breachRisk,
          discovered: secrecyResult.discovered,
          trustChange: secrecyResult.trustChange,
          frustrationChange: secrecyResult.frustrationChange,
          note: secrecyResult.note
        }
      : { applied: false },
    // v0.37: Romance Interest. Tylko log/devTools/przyszłe systemy.
    romanceEffect: romanceResult.applied
      ? {
          applied: true,
          actionType: romanceResult.actionType,
          disclosed: romanceResult.disclosed,
          askedFirst: romanceResult.askedFirst,
          attractionAfter: romanceResult.attractionAfter,
          secrecyAfter: romanceResult.secrecyAfter,
          boundaryRisk: romanceResult.boundaryRisk,
          classification: romanceResult.classification,
          note: romanceResult.note
        }
      : { applied: false },
    // v0.35: Conflict Escalation. Tylko log/devTools/reflection —
    // żadnych liczb w UI gracza i żadnego game over w tej wersji.
    conflictEffect: {
      applied: conflictResult.applied,
      delta: conflictResult.delta,
      stateAfter: conflictResult.stateAfter,
      triggeredFight: conflictResult.triggeredFight,
      note: conflictResult.note
    },
    // v0.36: Relationship End State. Jeśli triggered=true, eventScreen
    // przejdzie na ekran końca relacji zamiast zwykłej refleksji.
    relationshipEndEffect: {
      triggered: relationshipEndResult.triggered,
      active: relationshipEndResult.active,
      type: relationshipEndResult.type,
      reason: relationshipEndResult.reason
    }
  });

  completeCurrentAgendaItem(state);

  return choice;
}
