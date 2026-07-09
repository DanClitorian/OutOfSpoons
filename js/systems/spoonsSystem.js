// spoonsSystem.js
//
// Logika zasobu "spoons" — najważniejszego zasobu w grze.
// Ten moduł nie wie nic o UI ani o tym, kto woła jego funkcje —
// operuje wyłącznie na przekazanym obiekcie stanu.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Zmienia liczbę spoons o podaną wartość (dodatnią lub ujemną).
 * Wynik jest zawsze przycięty do zakresu [0, max].
 * Zwraca nową wartość current.
 */
export function modifySpoons(state, amount) {
  const spoons = state.resources.spoons;
  spoons.current = clamp(spoons.current + amount, 0, spoons.max);
  return spoons.current;
}

/**
 * Regeneracja spoons (np. po nocy). To ta sama operacja co modifySpoons,
 * ale osobna nazwa czyni intencję czytelną w kodzie wywołującym.
 */
export function regenerateSpoons(state, amount) {
  return modifySpoons(state, amount);
}
