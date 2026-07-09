// saveManager.js
//
// Odpowiada wyłącznie za persystencję stanu gry w localStorage.
// Nie zna logiki gry — tylko zapisuje i odtwarza obiekt stanu.
//
// Zapis zawiera pole "saveVersion". Jeśli w przyszłości zmieni się
// struktura stanu gry, można tu dodać logikę migracji starszych zapisów.
// Na razie: zapis o niepasującej wersji jest odrzucany (bezpieczniej
// niż wczytać niekompatybilne dane).

import { getState, setState } from "./gameState.js";

const STORAGE_KEY = "outOfSpoons_save";
const SUPPORTED_SAVE_VERSION = 1;

/**
 * Zapisuje aktualny stan gry do localStorage.
 * Zwraca true/false w zależności od powodzenia.
 */
export function saveGame() {
  const state = getState();
  if (!state) {
    console.warn("Brak aktywnej gry do zapisania.");
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Nie udało się zapisać gry:", error);
    return false;
  }
}

/**
 * Sprawdza, czy istnieje jakikolwiek zapisany stan gry.
 */
export function hasSavedGame() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Wczytuje zapisany stan gry i ustawia go jako aktualny stan (gameState).
 * Zwraca wczytany stan lub null, jeśli zapis nie istnieje / jest uszkodzony /
 * pochodzi z niekompatybilnej wersji.
 */
export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Zapis jest uszkodzony i nie mógł zostać odczytany:", error);
    return null;
  }

  if (parsed.saveVersion !== SUPPORTED_SAVE_VERSION) {
    console.warn(
      `Niekompatybilna wersja zapisu (${parsed.saveVersion}). ` +
      `Ta wersja gry obsługuje zapisy w wersji ${SUPPORTED_SAVE_VERSION}.`
    );
    return null;
  }

  setState(parsed);
  return parsed;
}

/**
 * Usuwa zapisany stan gry (przydatne np. do testowania).
 */
export function clearSavedGame() {
  localStorage.removeItem(STORAGE_KEY);
}
