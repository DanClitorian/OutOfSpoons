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

// v0.5: wpisy w state.log zyskały pole "consequences" (jawne skutki
// mechaniczne wyboru), pokazywane na ekranie refleksji. To kolejna
// niekompatybilna zmiana ze starszymi zapisami (v1-v4), dlatego wersja
// rośnie do 5. Starsze zapisy są po prostu odrzucane niżej.
const SUPPORTED_SAVE_VERSION = 5;

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
 * v0.60: Continue Run UX & Save Reliability. Wczytuje zapis TYLKO do
 * podglądu (menu główne) — parsuje i sprawdza wersję dokładnie jak
 * loadGame(), ale NIE woła setState(), więc nie aktywuje zapisu jako
 * bieżącej gry. Bezpieczne do wywołania przy każdym renderze menu,
 * nawet zanim gracz zdecyduje "Kontynuuj" czy "Nowa gra".
 */
export function inspectSavedGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("Zapis jest uszkodzony i nie mógł zostać odczytany (podgląd):", error);
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (parsed.saveVersion !== SUPPORTED_SAVE_VERSION) {
    console.warn(
      `Podgląd: niekompatybilna wersja zapisu (${parsed.saveVersion}). ` +
      `Ta wersja gry obsługuje zapisy w wersji ${SUPPORTED_SAVE_VERSION}.`
    );
    return null;
  }

  return parsed;
}

/**
 * Usuwa zapisany stan gry (przydatne np. do testowania).
 */
export function clearSavedGame() {
  localStorage.removeItem(STORAGE_KEY);
}
