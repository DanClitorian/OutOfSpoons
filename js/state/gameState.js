// gameState.js
//
// Jedyne źródło prawdy o aktualnym stanie rozgrywki.
// Ten moduł NIE zawiera logiki gry (nie wie, jak działają spoons,
// wydarzenia itd.) — tylko przechowuje i udostępnia aktualny obiekt stanu.
//
// Inne moduły (systemy) modyfikują stan, który tu leży, ale to systemy
// wiedzą "jak", a ten plik wie tylko "gdzie".

let currentState = null;

/**
 * Ustawia nowy stan gry (używane np. przy starcie nowej gry lub po wczytaniu zapisu).
 */
export function setState(newState) {
  currentState = newState;
}

/**
 * Zwraca aktualny stan gry (lub null, jeśli gra jeszcze się nie zaczęła).
 */
export function getState() {
  return currentState;
}

/**
 * Sprawdza, czy jakakolwiek gra jest aktualnie aktywna w pamięci.
 */
export function hasActiveGame() {
  return currentState !== null;
}
