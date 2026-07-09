// characterSystem.js
//
// Logika kreatora postaci: walidacja wyboru cech, budowanie obiektu
// player, wyliczanie startowych spoons na podstawie wybranych cech
// oraz generowanie krótkiego zdania statusu na ekran dnia.
//
// Ten moduł nie dotyka UI ani gameState bezpośrednio — przyjmuje
// dane wejściowe i zwraca gotowe obiekty / wartości.

import { traitsData } from "../data/traitsData.js";

// v0.3.1: cechy są opcjonalne. Gracz może wybrać od 0 do MAX_TRAITS cech —
// wcześniejszy wymóg minimum 2 cech błędnie sugerował, że każda postać
// musi mieć jakieś "zaburzenie", żeby zacząć grę. 0 cech oznacza po
// prostu neutralny profil startowy (patrz buildStatusSentence niżej).
export const MIN_TRAITS = 0;
export const MAX_TRAITS = 5;

const BASE_STARTING_SPOONS = 10;
const MINIMUM_STARTING_SPOONS = 1; // gra musi być grywalna nawet przy wielu cechach obniżających spoons

/**
 * Zwraca pełną listę dostępnych cech (do wyrenderowania checkboxów).
 */
export function getTraitsData() {
  return traitsData;
}

/**
 * Sprawdza, czy liczba wybranych cech mieści się w dozwolonym zakresie.
 */
export function isValidTraitSelection(selectedTraitIds) {
  return selectedTraitIds.length >= MIN_TRAITS && selectedTraitIds.length <= MAX_TRAITS;
}

/**
 * Buduje obiekt player na podstawie danych z kreatora postaci.
 * Zwraca dokładnie kształt wymagany przez gameState:
 * { name, pronouns, traits, flags }
 */
export function buildPlayer({ name, pronouns, selectedTraitIds }) {
  const selectedTraits = selectedTraitIds
    .map((id) => traitsData.find((trait) => trait.id === id))
    .filter(Boolean);

  const flags = {};
  selectedTraits.forEach((trait) => {
    (trait.flags || []).forEach((flagName) => {
      flags[flagName] = true;
    });
  });

  return {
    name: (name || "").trim() || "Bezimienna postać",
    pronouns: (pronouns || "").trim(),
    traits: selectedTraits.map((trait) => trait.id),
    flags
  };
}

/**
 * Wylicza startową (i jednocześnie maksymalną na start rozgrywki)
 * liczbę spoons na podstawie cech gracza. Suma modyfikatorów cech
 * jest odejmowana od bazy, z dolnym limitem MINIMUM_STARTING_SPOONS.
 */
export function calculateStartingSpoons(player) {
  const selectedTraits = player.traits
    .map((id) => traitsData.find((trait) => trait.id === id))
    .filter(Boolean);

  const totalModifier = selectedTraits.reduce(
    (sum, trait) => sum + (trait.spoonsModifier || 0),
    0
  );

  return Math.max(MINIMUM_STARTING_SPOONS, BASE_STARTING_SPOONS + totalModifier);
}

/**
 * Buduje krótkie, nieoceniające zdanie opisujące, jak cechy gracza
 * wpływają na jego funkcjonowanie. Pokazywane na ekranie dnia.
 */
export function buildStatusSentence(player) {
  // v0.3.1: gracz mógł świadomie nie wybrać żadnej cechy — to osobny,
  // jawnie nazwany przypadek, a nie tylko "brak flavor textu".
  if (player.traits.length === 0) {
    return (
      "Dziś zaczynasz z neutralnym profilem obciążenia. To nie znaczy, że będzie łatwo — " +
      "tylko że gra nie dodaje Ci dodatkowych filtrów na start."
    );
  }

  const selectedTraits = player.traits
    .map((id) => traitsData.find((trait) => trait.id === id))
    .filter(Boolean);

  const flavorTexts = selectedTraits
    .map((trait) => trait.flavorText)
    .filter(Boolean);

  if (flavorTexts.length === 0) {
    return "Dziś zaczynasz dzień taki, jaki jesteś.";
  }

  return flavorTexts.join(" ");
}
