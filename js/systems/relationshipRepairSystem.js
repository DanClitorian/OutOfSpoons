// relationshipRepairSystem.js
//
// v0.26: Repair Events / Naprawianie blizn relacyjnych.
//
// Blizny relacyjne z v0.25 nie miały być wyrokiem — ten moduł daje
// graczowi pierwszą, bardzo ograniczoną możliwość pracy z nimi. To NIE
// jest terapia ani "szybkie napraw wszystko": naprawa działa WYŁĄCZNIE
// w specjalnych eventach naprawczych (tag "repair-event"), przez
// świadomy, kosztowny wybór (metadata `repairAction` na choice), i
// obniża intensity JEDNEJ blizny o dokładnie 1 na wybór. Jeśli
// intensity spadnie do 0, blizna przenosi się z `state.partner.scars`
// do `state.partner.resolvedScars` — nie znika z historii, ale
// przestaje mechanicznie wpływać na trust gain (patrz
// relationshipScarsSystem.js — resolved scars po prostu nie są już w
// tablicy `scars`, więc findMatchingScar() ich nie widzi).
//
// Ważne zasady projektowe:
//   - naprawa NIGDY nie dzieje się automatycznie — tylko przez
//     świadomy wybór w evencie naprawczym z repairAction,
//   - naprawa NIGDY nie zmienia spoons ani frustration, NIE daje
//     dodatkowego trust poza tym, co już było w samym choice,
//     NIE blokuje/odblokowuje żadnych kart,
//   - max jedna blizna naprawiana na jeden wybór,
//   - zero liczb w UI gracza — tylko jedno zdanie w reflection PO
//     fakcie i krótka wzmianka w weekly summary.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w
// state.partner.repair / state.partner.resolvedScars. Ekrany
// (reflectionScreen.js, weeklySummaryScreen.js) i eventSystem.js
// czytają/zapisują przez ten moduł.

import { ensureRelationshipScarsState } from "./relationshipScarsSystem.js";

const MAX_HISTORY = 30;
const RECENT_WINDOW_DAYS = 7;

const REPAIR_REFLECTION_TEXTS = [
  "To nie cofa tamtego dnia. Ale przesuwa jego ciężar.",
  "Nie wszystko się zagoiło. Coś przestało się tylko sączyć.",
  "To był mały gest. Właśnie dlatego dało się mu uwierzyć.",
  "Nie naprawiacie przeszłości. Uczycie ją mniej hałasować.",
  "Blizna nie zniknęła. Ale przestała zajmować cały pokój."
];

const REPAIR_RESOLVED_TEXT = "To nie znika. Ale przestaje prowadzić rozmowę za was.";

const WEEKLY_RESOLVED_NOTE = "Jedna stara rana przestała dziś mówić najgłośniej.";
const WEEKLY_PROGRESS_NOTE = "Coś w relacji zaczęło się goić, choć nikt rozsądny nie nazwałby tego końcem sprawy.";

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.partner.repair i state.partner.resolvedScars
 * istnieją. Bezpieczne dla starych zapisów (sprzed v0.26). Zwraca
 * state.partner.repair (nie resolvedScars — to osobne pole, dostępne
 * bezpośrednio przez state.partner.resolvedScars po wywołaniu tej
 * funkcji). Zwraca null, jeśli w ogóle nie ma partnera w stanie.
 * Nie zmienia saveVersion.
 */
export function ensureRelationshipRepairState(state) {
  if (!state || !state.partner) {
    return null;
  }

  if (!state.partner.repair) {
    state.partner.repair = {
      history: [],
      lastWeeklyRepairDay: null
    };
  }

  if (!Array.isArray(state.partner.repair.history)) {
    state.partner.repair.history = [];
  }

  if (!Array.isArray(state.partner.resolvedScars)) {
    state.partner.resolvedScars = [];
  }

  return state.partner.repair;
}

/**
 * Zwraca true, jeśli istnieje przynajmniej jedna aktywna blizna, którą
 * teoretycznie dałoby się naprawić — używane przez eventWeightSystem.js
 * do delikatnego podbicia wagi eventów naprawczych (NIE gwarantowany
 * spawn).
 */
export function hasRepairableScars(state) {
  const scars = ensureRelationshipScarsState(state);
  return Boolean(scars && scars.length > 0);
}

// --------------------------------------------------------------------
// Efekt mechaniczny
// --------------------------------------------------------------------

/**
 * Sprawdza, czy wybrana opcja ma metadata `repairAction` typu
 * "scar-repair", i jeśli tak oraz istnieje aktywna blizna, obniża jej
 * intensity o `repairAction.strength` (domyślnie 1, minimum 0). Jeśli
 * intensity spadnie do 0, blizna jest przenoszona z `scars` do
 * `resolvedScars` (patrz moveScarToResolved). Zapisuje wpis do
 * state.partner.repair.history.
 *
 * Wywoływana z eventSystem.js#applyChoice PO zastosowaniu efektywnych
 * consequences do stanu (Pattern Pressure + Relationship Scars już się
 * wykonały) — repair NIGDY nie zmienia spoons/trust/frustration, więc
 * kolejność względem nich jest nieistotna dla samych liczb, ale
 * logicznie to "domknięcie" decyzji, nie jej mechaniczny rdzeń.
 */
export function applyRepairFromChoice(state, event, choice) {
  if (!choice || !choice.repairAction || choice.repairAction.type !== "scar-repair") {
    return { applied: false };
  }

  const scars = ensureRelationshipScarsState(state);
  if (!scars || scars.length === 0) {
    return { applied: false };
  }

  const targetScar = findScarToRepair(scars, event);
  if (!targetScar) {
    return { applied: false };
  }

  const strength = Math.max(1, Number(choice.repairAction.strength) || 1);
  const intensityBefore = targetScar.intensity;
  const intensityAfter = Math.max(0, intensityBefore - strength);

  targetScar.intensity = intensityAfter;

  let resolved = false;
  if (intensityAfter <= 0) {
    resolved = true;
    moveScarToResolved(state, scars, targetScar);
  }

  const repairState = ensureRelationshipRepairState(state);
  repairState.history.push({
    day: state.day,
    scarId: targetScar.id,
    scarTitle: targetScar.title,
    intensityBefore,
    intensityAfter,
    resolved
  });
  cleanupRepairHistory(repairState);

  return {
    applied: true,
    scarId: targetScar.id,
    resolved,
    intensityBefore,
    intensityAfter,
    note: targetScar.title
  };
}

function findScarToRepair(scars, event) {
  const eventTags = Array.isArray(event && event.tags) ? event.tags : [];

  for (const scar of scars) {
    const scarTags = (scar.tags || []).filter((tag) => tag !== "trust");
    if (scarTags.some((tag) => eventTags.includes(tag))) {
      return scar;
    }
  }

  return scars[0] || null;
}

function moveScarToResolved(state, scars, scar) {
  const index = scars.indexOf(scar);
  if (index !== -1) {
    scars.splice(index, 1);
  }

  if (!Array.isArray(state.partner.resolvedScars)) {
    state.partner.resolvedScars = [];
  }

  state.partner.resolvedScars.push({
    ...scar,
    resolved: true,
    resolvedDay: state.day
  });
}

function cleanupRepairHistory(repairState) {
  if (repairState.history.length > MAX_HISTORY) {
    repairState.history = repairState.history.slice(repairState.history.length - MAX_HISTORY);
  }
}

// --------------------------------------------------------------------
// Odczyt / prezentacja
// --------------------------------------------------------------------

/**
 * Buduje JEDNO krótkie zdanie do ekranu Reflection, JEŚLI naprawa
 * faktycznie zadziałała (repairEffect.applied). Jeśli blizna została
 * właśnie w pełni naprawiona (resolved), używa osobnego, bardziej
 * "domykającego" zdania. Zwraca null, jeśli nic się nie zadziało.
 */
export function buildRelationshipRepairReflection(state, repairEffect) {
  if (!repairEffect || !repairEffect.applied) {
    return null;
  }

  if (repairEffect.resolved) {
    return REPAIR_RESOLVED_TEXT;
  }

  return pickRandom(REPAIR_REFLECTION_TEXTS);
}

/**
 * Buduje krótką notatkę do weekly summary, JEŚLI w ostatnich 7 dniach
 * był jakikolwiek repair effect. Jeśli którykolwiek z nich w pełni
 * rozwiązał bliznę, priorytet ma zdanie o "domknięciu". Zwraca null,
 * jeśli nic się nie działo.
 */
export function buildWeeklyRelationshipRepairNote(state) {
  const repairState = ensureRelationshipRepairState(state);
  if (!repairState || repairState.history.length === 0) {
    return null;
  }

  const recentEntries = repairState.history.filter((entry) => entry.day > state.day - RECENT_WINDOW_DAYS);
  if (recentEntries.length === 0) {
    return null;
  }

  const hasResolved = recentEntries.some((entry) => entry.resolved);
  return hasResolved ? WEEKLY_RESOLVED_NOTE : WEEKLY_PROGRESS_NOTE;
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie stanu
 * naprawy — pełna historia repair, aktualne resolved scars, ostatni
 * repair effect. Te dane NIGDY nie trafiają do UI gracza.
 */
export function getRelationshipRepairDebugSummary(state) {
  const repairState = ensureRelationshipRepairState(state);
  const resolvedScars =
    state && state.partner && Array.isArray(state.partner.resolvedScars) ? state.partner.resolvedScars : [];

  return {
    history: repairState ? repairState.history : [],
    resolvedScars: resolvedScars.map((scar) => ({
      id: scar.id,
      title: scar.title,
      resolvedDay: scar.resolvedDay
    })),
    lastRepairEffect:
      repairState && repairState.history.length > 0 ? repairState.history[repairState.history.length - 1] : null
  };
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
