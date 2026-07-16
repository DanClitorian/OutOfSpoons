// devTools.js
//
// v0.20.1: Critical Event Visibility + Testability.
// v0.20.2/v0.20.3: null-state guard + cache-busted import.
// v0.23: Partner Capacity Foundation — dodane 3 helpery testowe
// (setPartnerCapacityLow/High, showPartnerCapacity).
// v0.24: Pattern Pressure — dodany helper showPatternPressure().
// v0.25: Relationship Scars — dodany helper showRelationshipScars().
// v0.26: Repair Events — dodany helper showRelationshipRepair().
// v0.27: The Static — dodane 3 helpery testowe (showStatic,
// setStaticHigh, clearStatic). Żadna z istniejących funkcji (jumpToDay,
// jumpToCriticalDueDay, forceCriticalEventDue, showStateSummary,
// setPartnerCapacityLow/High, showPartnerCapacity, showPatternPressure,
// showRelationshipScars, showRelationshipRepair) NIE została zmieniona.
//
// v0.30.5: Stabilizacja integracji Month One Complete Loop po
// hotfixach v0.30.1-v0.30.4. Importy uiManager.js / criticalEventSystem.js
// / monthlyLoopSystem.js podbite do ?v=305 (uiManager.js i
// criticalEventSystem.js faktycznie zmieniły zawartość — patrz
// criticalEventSystem.js#evaluateCriticalEvent, nowe pole completedDay).
// Żadna funkcja devTools NIE zduplikowana, NIE zmieniona funkcjonalnie
// poza tym cache-bustem.
//
// v0.31: Content Expansion Pack 1. uiManager.js znowu zmienił
// zawartość (4 zmienione ekrany dostały nowe query stringi) — import
// podbity do ?v=310. Żadna funkcja devTools NIE zmieniona (ten ticket
// to wyłącznie nowa treść eventów, zero nowego systemu).
//
// v0.32: Game Feel / Daily Stakes Pass — dodane 2 helpery testowe
// (showDailyStakes, recalculateDailyStakes). Import uiManager.js
// podbity do ?v=320 (uiManager.js znowu zmienił zawartość — 3
// zmienione ekrany dostały nowe query stringi). Żadna z istniejących
// funkcji NIE została zmieniona.
//
// v0.33: Masking Debt — dodane 3 helpery testowe (showMaskingDebt,
// setMaskingDebtHigh, clearMaskingDebt). Import uiManager.js podbity
// do ?v=330 (uiManager.js znowu zmienił zawartość — 3 zmienione
// ekrany dostały nowe query stringi). Żadna z istniejących funkcji NIE
// została zmieniona.
//
// v0.34: Relationship Model Foundation — dodanych 6 helperów testowych
// (showRelationshipModel, setRelationshipModelPoly/Mono/Open/
// Ambiguous, setRelationshipModelClarity). Import uiManager.js podbity
// do ?v=340 (uiManager.js znowu zmienił zawartość — 2 zmienione
// ekrany dostały nowe query stringi). Żadna z istniejących funkcji NIE
// została zmieniona.
//
// DEV-ONLY helpery do testowania Weekly Stakes / Wielkiego Testu /
// Partner Capacity / Pattern Pressure / Relationship Scars / Repair
// Events / The Static bez ręcznego przeklikiwania wielu dni. Ten moduł:
//   - NIE renderuje żadnego UI,
//   - NIE wywołuje się sam z siebie podczas normalnej gry,
//   - wystawia funkcje WYŁĄCZNIE pod window.oosDev.
//
// getState() może zwrócić null, jeśli dev wywoła helper na main menu,
// przed Nową grą albo przed wczytaniem zapisu. Helpery nie mogą wtedy
// crashować. Zamiast tego wypisują czytelne ostrzeżenie.

import { getState } from "../state/gameState.js";
import { saveGame } from "../state/saveManager.js";
import { showScreen } from "../ui/uiManager.js?v=360";
import { getCurrentWeeklyChallenge } from "../systems/weeklyChallengeSystem.js";
import { getCurrentCriticalEvent } from "../systems/criticalEventSystem.js?v=305";
import {
  ensurePartnerCapacityState,
  getPartnerCapacity,
  refreshPartnerCapacityMood
} from "../systems/partnerCapacitySystem.js?v=300";
import { getPatternPressureDebugSummary } from "../systems/patternPressureSystem.js?v=300";
import { getRelationshipScarsDebugSummary } from "../systems/relationshipScarsSystem.js?v=300";
import { getRelationshipRepairDebugSummary } from "../systems/relationshipRepairSystem.js?v=300";
import {
  getStaticDebugSummary,
  setStaticForDebug,
  clearStaticForDebug
} from "../systems/staticSystem.js?v=300";

import { getMetamourDebugSummary, setMetamourTensionHigh as setMetamourTensionHighState, clearMetamourSignal as clearMetamourSignalState } from "../systems/metamourSystem.js?v=300";
import { getWorkPressureDebugSummary, setWorkPressureHigh as setWorkPressureHighState, clearWorkSignal as clearWorkSignalState } from "../systems/workPressureSystem.js?v=300";
import { getMonthlyLoopDebugSummary, forceMonthSummaryPending } from "../systems/monthlyLoopSystem.js?v=305";
import { ensureDailyStakesState, calculateDailyStakes, getDailyStakesDebugSummary } from "../systems/dailyStakesSystem.js?v=320";
import {
  ensureMaskingDebtState,
  getMaskingDebtDebugSummary
} from "../systems/maskingDebtSystem.js?v=330";
import {
  getRelationshipModelDebugSummary,
  setRelationshipModelType as setRelationshipModelTypeState,
  setRelationshipModelClarity as setRelationshipModelClarityState
} from "../systems/relationshipModelSystem.js?v=340";
import {
  getConflictDebugSummary,
  setConflictHigh as setConflictHighState,
  triggerConflictFight as triggerConflictFightState,
  clearConflict as clearConflictState
} from "../systems/conflictEscalationSystem.js?v=350";
import {
  getRelationshipEndDebugSummary,
  forceRelationshipBreakup as forceRelationshipBreakupState,
  forceFinalFight as forceFinalFightState,
  clearRelationshipEnd as clearRelationshipEndState
} from "../systems/relationshipEndStateSystem.js?v=360";
function requireActiveState(actionName) {
  const state = getState();

  if (!state) {
    console.warn(
      `[oosDev] Brak aktywnego stanu gry dla ${actionName}. ` +
      `Najpierw rozpocznij Nową grę albo wczytaj zapis, potem wywołaj helper ponownie.`
    );
    return null;
  }

  return state;
}

function safeGetState() {
  return getState();
}

function jumpToDay(dayNumber) {
  const state = requireActiveState("jumpToDay()");
  if (!state) {
    return null;
  }

  const parsedDay = Number(dayNumber);
  if (!Number.isFinite(parsedDay) || parsedDay < 1) {
    console.warn("[oosDev] jumpToDay(dayNumber) wymaga liczby dnia >= 1.");
    return state;
  }

  state.day = Math.floor(parsedDay);
  saveGame(state);
  console.log(
    `[oosDev] state.day ustawiony na ${state.day}. ` +
    `Wywołaj window.oosDev.getState() żeby sprawdzić, albo przejdź na ekran poranka.`
  );
  return state;
}

function jumpToCriticalDueDay() {
  const state = requireActiveState("jumpToCriticalDueDay()");
  if (!state) {
    return null;
  }

  const active = getCurrentCriticalEvent(state);

  if (!active) {
    console.warn(
      "[oosDev] Brak aktywnego Wielkiego Testu. " +
      "Wejdź najpierw na ekran poranka, żeby gra wygenerowała Wielki Test."
    );
    return state;
  }

  state.day = active.dueDay + 1;
  saveGame(state);
  showScreen("weeklySummary");
  console.log(
    `[oosDev] state.day ustawiony na ${state.day} ` +
    `(dueDay+1 aktywnego Wielkiego Testu "${active.title}"). Pokazano weekly summary.`
  );
  return state;
}

function forceCriticalEventDue() {
  const state = requireActiveState("forceCriticalEventDue()");
  if (!state) {
    return null;
  }

  const active = getCurrentCriticalEvent(state);

  if (!active) {
    console.warn(
      "[oosDev] Brak aktywnego Wielkiego Testu. " +
      "Wejdź najpierw na ekran poranka, żeby gra wygenerowała Wielki Test."
    );
    return state;
  }

  active.dueDay = state.day - 1;
  saveGame(state);
  showScreen("weeklySummary");
  console.log(
    `[oosDev] dueDay Wielkiego Testu "${active.title}" ustawiony na ${active.dueDay} (wczoraj). ` +
    `Pokazano weekly summary.`
  );
  return state;
}

function showStateSummary() {
  const state = requireActiveState("showStateSummary()");
  if (!state) {
    return null;
  }

  const npc = state.partner && state.npcs ? state.npcs[state.partner.id] : null;
  const weeklyChallenge = getCurrentWeeklyChallenge(state);
  const criticalEvent = getCurrentCriticalEvent(state);
  const lastCriticalResult = state.criticalEvent ? state.criticalEvent.lastResult : null;

  const summary = {
    day: state.day,
    spoons: state.resources ? `${state.resources.spoons.current}/${state.resources.spoons.max}` : "brak danych",
    partnerTrust: npc ? npc.trust : "brak partnera",
    partnerFrustration: npc ? npc.frustration : "brak partnera",
    activeWeeklyChallenge: weeklyChallenge ? `${weeklyChallenge.title} (dueDay ${weeklyChallenge.dueDay})` : "brak",
    activeCriticalEvent: criticalEvent ? `${criticalEvent.title} (dueDay ${criticalEvent.dueDay})` : "brak",
    lastCriticalResult: lastCriticalResult
      ? `${lastCriticalResult.success ? "sukces" : "porażka"}: ${lastCriticalResult.title}`
      : "brak"
  };

  console.table(summary);
  return summary;
}

// v0.23: Partner Capacity Foundation. Ustawia partnerowi NISKĄ
// pojemność (current=0, stress=85) i od razu przelicza mood — do
// szybkiego sprawdzenia narracji/wagi eventów przy niskim capacity bez
// czekania na niekorzystny los.
function setPartnerCapacityLow() {
  const state = requireActiveState("setPartnerCapacityLow()");
  if (!state) {
    return null;
  }

  const capacity = ensurePartnerCapacityState(state);
  if (!capacity) {
    console.warn("[oosDev] Brak partnera w stanie gry.");
    return null;
  }

  capacity.current = 0;
  capacity.stress = 85;
  capacity.lastRolledDay = state.day;
  refreshPartnerCapacityMood(state);
  saveGame(state);

  console.log(`[oosDev] Partner capacity ustawiona na NISKĄ (mood: ${capacity.mood}).`);
  return capacity;
}

// v0.23: Partner Capacity Foundation. Ustawia partnerowi WYSOKĄ
// pojemność (current=max, stress=10) — do sprawdzenia przeciwnego
// bieguna.
function setPartnerCapacityHigh() {
  const state = requireActiveState("setPartnerCapacityHigh()");
  if (!state) {
    return null;
  }

  const capacity = ensurePartnerCapacityState(state);
  if (!capacity) {
    console.warn("[oosDev] Brak partnera w stanie gry.");
    return null;
  }

  capacity.current = capacity.max;
  capacity.stress = 10;
  capacity.lastRolledDay = state.day;
  refreshPartnerCapacityMood(state);
  saveGame(state);

  console.log(`[oosDev] Partner capacity ustawiona na WYSOKĄ (mood: ${capacity.mood}).`);
  return capacity;
}

// v0.23: Partner Capacity Foundation. Wypisuje do konsoli aktualny
// stan capacity partnera (do debugowania — te liczby NIGDY nie trafiają
// do UI gracza).
function showPartnerCapacity() {
  const state = requireActiveState("showPartnerCapacity()");
  if (!state) {
    return null;
  }

  const capacity = getPartnerCapacity(state);
  if (!capacity) {
    console.warn("[oosDev] Brak partnera w stanie gry.");
    return null;
  }

  console.table({
    current: capacity.current,
    max: capacity.max,
    stress: capacity.stress,
    mood: capacity.mood,
    lastRolledDay: capacity.lastRolledDay,
    dailySignalType: capacity.dailySignal ? capacity.dailySignal.type : "brak"
  });

  return capacity;
}

// v0.24: Pattern Pressure. Wypisuje do konsoli, jakie aktywne wzorce
// mają teraz wpływ na koszt decyzji (stały modyfikator +/-1) i co
// przeciwstawiają — do debugowania. Te liczby NIGDY nie trafiają do UI
// gracza.
function showPatternPressure() {
  const state = requireActiveState("showPatternPressure()");
  if (!state) {
    return null;
  }

  const summary = getPatternPressureDebugSummary(state);

  if (summary.length === 0) {
    console.log("[oosDev] Brak aktywnych wzorców — presja nie działa na żadną decyzję.");
    return summary;
  }

  console.table(
    summary.map((entry) => ({
      id: entry.id,
      title: entry.title,
      intensity: entry.intensity,
      modifier: entry.modifier,
      opposes: entry.opposes.join(", ") || "brak"
    }))
  );

  return summary;
}

// v0.25: Relationship Scars. Wypisuje do konsoli aktywne blizny
// relacyjne — id, tytuł, intensity, createdDay, sourceEventId. Te dane
// NIGDY nie trafiają do UI gracza.
function showRelationshipScars() {
  const state = requireActiveState("showRelationshipScars()");
  if (!state) {
    return null;
  }

  const summary = getRelationshipScarsDebugSummary(state);

  if (summary.length === 0) {
    console.log("[oosDev] Brak aktywnych blizn relacyjnych.");
    return summary;
  }

  console.table(summary);
  return summary;
}

// v0.26: Repair Events. Wypisuje do konsoli historię naprawy blizn,
// aktualne resolved scars i ostatni repair effect. Te dane NIGDY nie
// trafiają do UI gracza.
function showRelationshipRepair() {
  const state = requireActiveState("showRelationshipRepair()");
  if (!state) {
    return null;
  }

  const summary = getRelationshipRepairDebugSummary(state);

  if (summary.history.length === 0) {
    console.log("[oosDev] Brak historii naprawy blizn relacyjnych.");
  } else {
    console.log("[oosDev] Historia naprawy blizn:");
    console.table(summary.history);
  }

  if (summary.resolvedScars.length === 0) {
    console.log("[oosDev] Brak w pełni naprawionych blizn.");
  } else {
    console.log("[oosDev] Naprawione blizny:");
    console.table(summary.resolvedScars);
  }

  console.log("[oosDev] Ostatni repair effect:", summary.lastRepairEffect || "brak");

  return summary;
}

// v0.27: The Static. Wypisuje do konsoli intensity, powody (reasons),
// dailySignal i ostatnie 7 wpisów historii. Te dane NIGDY nie trafiają
// do UI gracza — w grze widać tylko subtelne zdania, nigdy liczby ani
// listę powodów.
function showStatic() {
  const state = requireActiveState("showStatic()");
  if (!state) {
    return null;
  }

  const summary = getStaticDebugSummary(state);
  if (!summary) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  console.log(`[oosDev] Static intensity: ${summary.intensity}, powody: ${summary.reasons.join(", ") || "brak"}`);
  console.log("[oosDev] Ostatnie przeliczenie:", summary.lastCalculatedDay, "dailySignal:", summary.dailySignal);
  console.log("[oosDev] Ostatnie 7 wpisów historii:");
  console.table(summary.recentHistory.map((entry) => ({ ...entry, reasons: entry.reasons.join(", ") || "brak" })));

  return summary;
}

// v0.27: The Static. Wymusza intensity=3 na bieżący dzień — do
// szybkiego sprawdzenia najsilniejszych linii narracyjnych bez
// czekania na realne przeciążenie.
function setStaticHigh() {
  const state = requireActiveState("setStaticHigh()");
  if (!state) {
    return null;
  }

  const result = setStaticForDebug(state, 3);
  if (!result) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  saveGame(state);
  console.log(`[oosDev] Static ustawiony na intensity=3 (dailySignal: "${result.dailySignal.text}").`);
  return result;
}

// v0.27: The Static. Resetuje szum do zera (intensity=0, brak powodów,
// brak dailySignal) — do sprawdzenia "cichego" stanu.
function clearStatic() {
  const state = requireActiveState("clearStatic()");
  if (!state) {
    return null;
  }

  const result = clearStaticForDebug(state);
  if (!result) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  saveGame(state);
  console.log("[oosDev] Static wyczyszczony (intensity=0).");
  return result;
}


// v0.28: Metamour. Dev-only podgląd osoby z sieci relacji.
function showMetamour() {
  const state = requireActiveState("showMetamour()");
  if (!state) {
    return null;
  }

  const summary = getMetamourDebugSummary(state);
  if (!summary) {
    console.warn("[oosDev] Brak partnera/metamoura w stanie gry.");
    return null;
  }

  console.table({
    name: summary.name,
    roleLabel: summary.roleLabel,
    pronouns: summary.pronouns,
    closeness: summary.closeness,
    tension: summary.tension,
    familiarity: summary.familiarity
  });
  console.log("[oosDev] Daily signal:", summary.dailySignal || "brak");
  console.log("[oosDev] Ostatnie wpisy historii:");
  console.table(summary.recentHistory);

  return summary;
}

// v0.28: Metamour. Ustawia wysokie napięcie i sygnał dzienny.
function setMetamourTensionHigh() {
  const state = requireActiveState("setMetamourTensionHigh()");
  if (!state) {
    return null;
  }

  const result = setMetamourTensionHighState(state);
  saveGame(state);
  console.log("[oosDev] Metamour tension ustawione wysoko.");
  return result;
}

// v0.28: Metamour. Czyści tylko dailySignal.
function clearMetamourSignal() {
  const state = requireActiveState("clearMetamourSignal()");
  if (!state) {
    return null;
  }

  const result = clearMetamourSignalState(state);
  saveGame(state);
  console.log("[oosDev] Metamour dailySignal wyczyszczony.");
  return result;
}


// v0.29: Work Pressure. Dev-only podgląd presji pracy.
function showWorkPressure() {
  const state = requireActiveState("showWorkPressure()");
  if (!state) {
    return null;
  }

  const summary = getWorkPressureDebugSummary(state);
  if (!summary) {
    console.warn("[oosDev] Brak player.work w stanie gry.");
    return null;
  }

  console.table({
    pressure: summary.pressure,
    stability: summary.stability,
    burnout: summary.burnout
  });
  console.log("[oosDev] Daily signal:", summary.dailySignal || "brak");
  console.log("[oosDev] Ostatnie wpisy historii:");
  console.table(summary.recentHistory);

  return summary;
}

// v0.29: Work Pressure. Ustawia wysokie ciśnienie i burnout.
function setWorkPressureHigh() {
  const state = requireActiveState("setWorkPressureHigh()");
  if (!state) {
    return null;
  }

  const result = setWorkPressureHighState(state);
  saveGame(state);
  console.log("[oosDev] Work pressure ustawione wysoko.");
  return result;
}

// v0.29: Work Pressure. Czyści tylko dailySignal.
function clearWorkSignal() {
  const state = requireActiveState("clearWorkSignal()");
  if (!state) {
    return null;
  }

  const result = clearWorkSignalState(state);
  saveGame(state);
  console.log("[oosDev] Work dailySignal wyczyszczony.");
  return result;
}


// v0.30: Month One Complete Loop. Dev-only podgląd domknięcia miesiąca.
function showMonthlyLoop() {
  const state = requireActiveState("showMonthlyLoop()");
  if (!state) {
    return null;
  }

  const summary = getMonthlyLoopDebugSummary(state);
  console.log("[oosDev] Monthly loop:", summary);
  if (summary && summary.latest && summary.latest.stats) {
    console.table(summary.latest.stats);
  }
  return summary;
}

// v0.30: wymusza pending summary miesiąca do testu ekranu.
function forceMonthSummary() {
  const state = requireActiveState("forceMonthSummary()");
  if (!state) {
    return null;
  }

  const summary = forceMonthSummaryPending(state);
  saveGame(state);
  console.log("[oosDev] Month summary pending:", summary);
  return summary;
}

// v0.30: otwiera ekran podsumowania miesiąca.
function showMonthSummaryScreen() {
  const state = requireActiveState("showMonthSummaryScreen()");
  if (!state) {
    return null;
  }

  forceMonthSummaryPending(state);
  saveGame(state);
  showScreen("monthSummary");
  return getMonthlyLoopDebugSummary(state);
}

// v0.32: Game Feel / Daily Stakes Pass. Wypisuje do konsoli level,
// title, text, reasons, tags napięcia dnia. Te dane NIGDY nie trafiają
// do UI gracza jako liczby — w grze widać tylko etykietę i zdanie.
function showDailyStakes() {
  const state = requireActiveState("showDailyStakes()");
  if (!state) {
    return null;
  }

  const summary = getDailyStakesDebugSummary(state);
  if (!summary) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  console.log(`[oosDev] Daily Stakes: ${summary.level} ("${summary.title}") — dzień ${summary.day}`);
  console.log(`[oosDev] Tekst: "${summary.text}"`);
  console.log(`[oosDev] Powody: ${summary.reasons.join(", ") || "brak"}`);
  console.log(`[oosDev] Tagi: ${summary.tags.join(", ") || "brak"}`);

  return summary;
}

// v0.32: Game Feel / Daily Stakes Pass. Czyści state.player.dailyStakes.day
// (wymusza ponowne przeliczenie przy następnym calculateDailyStakes()
// dla TEGO SAMEGO dnia — idempotencja per-day jest tu celowo obchodzona
// wyłącznie do debugowania) i od razu przelicza ponownie.
function recalculateDailyStakes() {
  const state = requireActiveState("recalculateDailyStakes()");
  if (!state) {
    return null;
  }

  const stakes = ensureDailyStakesState(state);
  if (!stakes) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  stakes.day = null;
  const result = calculateDailyStakes(state);
  saveGame(state);

  console.log(`[oosDev] Daily Stakes przeliczone ponownie: ${result.level} ("${result.title}").`);
  return result;
}

// v0.33: Masking Debt. Wypisuje do konsoli current, ostatnie dni,
// ostatni efekt poranny i ostatnie 7 wpisów historii. Te dane NIGDY
// nie trafiają do UI gracza.
function showMaskingDebt() {
  const state = requireActiveState("showMaskingDebt()");
  if (!state) {
    return null;
  }

  const summary = getMaskingDebtDebugSummary(state);
  if (!summary) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  console.log(`[oosDev] Masking Debt: current=${summary.current}, lastAppliedDay=${summary.lastAppliedDay}`);
  console.log(`[oosDev] lastMorningResolvedDay=${summary.lastMorningResolvedDay}`, "lastMorningEffect:", summary.lastMorningEffect);
  console.log("[oosDev] Ostatnie 7 wpisów historii:");
  console.table(summary.recentHistory);

  return summary;
}

// v0.33: Masking Debt. Ustawia current na 5 (próg "heavy" dla
// najbliższego porannego rozliczenia) — do szybkiego sprawdzenia
// najsilniejszego efektu bez czekania na realne nagromadzenie długu.
function setMaskingDebtHigh() {
  const state = requireActiveState("setMaskingDebtHigh()");
  if (!state) {
    return null;
  }

  const debtState = ensureMaskingDebtState(state);
  if (!debtState) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  debtState.current = 5;
  saveGame(state);

  console.log("[oosDev] Masking Debt ustawiony na current=5.");
  return getMaskingDebtDebugSummary(state);
}

// v0.33: Masking Debt. Resetuje dług do zera i czyści lastMorningEffect
// — do sprawdzenia "cichego" stanu.
function clearMaskingDebt() {
  const state = requireActiveState("clearMaskingDebt()");
  if (!state) {
    return null;
  }

  const debtState = ensureMaskingDebtState(state);
  if (!debtState) {
    console.warn("[oosDev] Brak gracza w stanie gry.");
    return null;
  }

  debtState.current = 0;
  debtState.lastMorningEffect = null;
  saveGame(state);

  console.log("[oosDev] Masking Debt wyczyszczony (current=0).");
  return getMaskingDebtDebugSummary(state);
}

// v0.34: Relationship Model Foundation. Wypisuje do konsoli type,
// clarity, agreements i ostatnie 7 wpisów historii. Te dane NIGDY nie
// trafiają do UI gracza jako liczby.
function showRelationshipModel() {
  const state = requireActiveState("showRelationshipModel()");
  if (!state) {
    return null;
  }

  const summary = getRelationshipModelDebugSummary(state);
  if (!summary) {
    console.warn("[oosDev] Brak stanu gry.");
    return null;
  }

  console.log(`[oosDev] Relationship Model: type=${summary.type}, clarity=${summary.clarity}`);
  console.log("[oosDev] agreements:", summary.agreements);
  console.log("[oosDev] Ostatnie 7 wpisów historii:");
  console.table(summary.recentHistory);

  return summary;
}

function setRelationshipModelMono() {
  const state = requireActiveState("setRelationshipModelMono()");
  if (!state) {
    return null;
  }

  setRelationshipModelTypeState(state, "monogamy");
  saveGame(state);

  console.log("[oosDev] Relationship Model ustawiony na monogamy.");
  return getRelationshipModelDebugSummary(state);
}

function setRelationshipModelPoly() {
  const state = requireActiveState("setRelationshipModelPoly()");
  if (!state) {
    return null;
  }

  setRelationshipModelTypeState(state, "polyamory");
  saveGame(state);

  console.log("[oosDev] Relationship Model ustawiony na polyamory.");
  return getRelationshipModelDebugSummary(state);
}

function setRelationshipModelOpen() {
  const state = requireActiveState("setRelationshipModelOpen()");
  if (!state) {
    return null;
  }

  setRelationshipModelTypeState(state, "open");
  saveGame(state);

  console.log("[oosDev] Relationship Model ustawiony na open.");
  return getRelationshipModelDebugSummary(state);
}

function setRelationshipModelAmbiguous() {
  const state = requireActiveState("setRelationshipModelAmbiguous()");
  if (!state) {
    return null;
  }

  setRelationshipModelTypeState(state, "ambiguous");
  saveGame(state);

  console.log("[oosDev] Relationship Model ustawiony na ambiguous (niska clarity).");
  return getRelationshipModelDebugSummary(state);
}

function setRelationshipModelClarity(value) {
  const state = requireActiveState("setRelationshipModelClarity()");
  if (!state) {
    return null;
  }

  setRelationshipModelClarityState(state, value);
  saveGame(state);

  console.log(`[oosDev] Relationship Model clarity ustawiona na ${state.relationshipModel.clarity}.`);
  return getRelationshipModelDebugSummary(state);
}


// v0.35: Conflict Escalation Foundation. Dev-only podgląd napięcia relacyjnego.
function showConflict() {
  const state = requireActiveState("showConflict()");
  if (!state) {
    return null;
  }

  const summary = getConflictDebugSummary(state);
  if (!summary) {
    console.warn("[oosDev] Brak partnera albo konfliktu w stanie gry.");
    return null;
  }

  console.table({
    current: summary.current,
    volatility: summary.volatility,
    state: summary.state,
    lastEvaluatedDay: summary.lastEvaluatedDay,
    lastConflictDay: summary.lastConflictDay
  });
  console.log("[oosDev] Pressure:", summary.pressure);
  console.log("[oosDev] Last conflict event:", summary.lastConflictEvent);
  console.log("[oosDev] Ostatnie wpisy historii:");
  console.table(summary.recentHistory);

  return summary;
}

function setConflictHigh() {
  const state = requireActiveState("setConflictHigh()");
  if (!state) {
    return null;
  }

  setConflictHighState(state);
  saveGame(state);

  console.log("[oosDev] Conflict ustawiony wysoko: critical.");
  return getConflictDebugSummary(state);
}

function triggerConflictFight() {
  const state = requireActiveState("triggerConflictFight()");
  if (!state) {
    return null;
  }

  triggerConflictFightState(state);
  saveGame(state);

  console.log("[oosDev] Conflict ustawiony na fight. To NIE kończy gry w v0.35.");
  return getConflictDebugSummary(state);
}

function clearConflict() {
  const state = requireActiveState("clearConflict()");
  if (!state) {
    return null;
  }

  clearConflictState(state);
  saveGame(state);

  console.log("[oosDev] Conflict wyczyszczony: calm.");
  return getConflictDebugSummary(state);
}


// v0.36: Relationship End States. Dev-only podgląd i wymuszenie końca relacji.
function showRelationshipEnd() {
  const state = requireActiveState("showRelationshipEnd()");
  if (!state) {
    return null;
  }

  const summary = getRelationshipEndDebugSummary(state);
  console.table(summary);
  return summary;
}

function forceRelationshipBreakup() {
  const state = requireActiveState("forceRelationshipBreakup()");
  if (!state) {
    return null;
  }

  forceRelationshipBreakupState(state);
  saveGame(state);
  showScreen("relationshipEnd");

  console.log("[oosDev] Wymuszono end-state: breakup.");
  return getRelationshipEndDebugSummary(state);
}

function forceFinalFight() {
  const state = requireActiveState("forceFinalFight()");
  if (!state) {
    return null;
  }

  forceFinalFightState(state);
  saveGame(state);
  showScreen("relationshipEnd");

  console.log("[oosDev] Wymuszono end-state: final-fight.");
  return getRelationshipEndDebugSummary(state);
}

function clearRelationshipEnd() {
  const state = requireActiveState("clearRelationshipEnd()");
  if (!state) {
    return null;
  }

  clearRelationshipEndState(state);
  saveGame(state);

  console.log("[oosDev] Relationship end-state wyczyszczony.");
  return getRelationshipEndDebugSummary(state);
}

if (typeof window !== "undefined") {
  window.oosDev = {
    getState: safeGetState,
    jumpToDay,
    jumpToCriticalDueDay,
    forceCriticalEventDue,
    showStateSummary,
    setPartnerCapacityLow,
    setPartnerCapacityHigh,
    showPartnerCapacity,
    showPatternPressure,
    showRelationshipScars,
    showRelationshipRepair,
    showStatic,
    setStaticHigh,
    clearStatic,
    showMetamour,
    setMetamourTensionHigh,
    clearMetamourSignal,
    showWorkPressure,
    setWorkPressureHigh,
    clearWorkSignal,
    showMonthlyLoop,
    forceMonthSummary,
    showMonthSummaryScreen,
    showDailyStakes,
    recalculateDailyStakes,
    showMaskingDebt,
    setMaskingDebtHigh,
    clearMaskingDebt,
    showRelationshipModel,
    setRelationshipModelMono,
    setRelationshipModelPoly,
    setRelationshipModelOpen,
    setRelationshipModelAmbiguous,
    setRelationshipModelClarity,
    showConflict,
    setConflictHigh,
    triggerConflictFight,
    clearConflict,
    showRelationshipEnd,
    forceRelationshipBreakup,
    forceFinalFight,
    clearRelationshipEnd
  };
}
