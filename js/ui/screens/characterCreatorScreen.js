// characterCreatorScreen.js
//
// Ekran kreatora postaci: imię, zaimki/sposób zwracania się oraz opcjonalny
// wybór 0-5 cech psychologicznych. Cechy są prezentowane jako sposoby
// reakcji na presję, nie jako diagnozy medyczne, i nie są obowiązkowe —
// stąd nagłówek "Jak działa Twoja postać pod presją?" zamiast listy
// jednostek chorobowych.

import { showScreen } from "../uiManager.js";
// v0.49: cache-bust — dayCycle.js zmienił zawartość (pełny cykl fatigue).
import { startNewGame } from "../../systems/dayCycle.js?v=560";
import {
  getTraitsData,
  isValidTraitSelection,
  MAX_TRAITS
} from "../../systems/characterSystem.js";

export function renderCharacterCreatorScreen(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "screen character-creator-screen";

  const title = document.createElement("h2");
  title.textContent = "Kreator postaci";
  wrapper.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "subtitle";
  intro.textContent = "Stwórz osobę, w którą wcielisz się w tej rozgrywce.";
  wrapper.appendChild(intro);

  const nameInput = appendTextField(wrapper, {
    id: "player-name",
    labelText: "Imię",
    placeholder: "np. Kasia"
  });

  const pronounsInput = appendTextField(wrapper, {
    id: "player-pronouns",
    labelText: "Zaimki / sposób zwracania się",
    placeholder: "np. ona/jej, on/jego, they/them"
  });

  const traitsHeading = document.createElement("h3");
  traitsHeading.className = "section-heading";
  traitsHeading.textContent = "Jak działa Twoja postać pod presją?";
  wrapper.appendChild(traitsHeading);

  const traitsHint = document.createElement("p");
  traitsHint.className = "field-hint";
  traitsHint.textContent =
    `Możesz wybrać do ${MAX_TRAITS} cech, które wpływają na funkcjonowanie postaci pod presją. ` +
    "Możesz też nie wybrać żadnej — to nie są diagnozy, tylko sposoby, w jakie Twoja postać " +
    "reaguje na obciążenie.";
  wrapper.appendChild(traitsHint);

  const errorMessage = document.createElement("p");
  errorMessage.className = "field-error";
  errorMessage.hidden = true;

  const traitsList = document.createElement("div");
  traitsList.className = "traits-list";

  const checkboxes = getTraitsData().map((trait) => {
    const optionLabel = document.createElement("label");
    optionLabel.className = "trait-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = trait.id;
    checkbox.addEventListener("change", (event) => {
      // Twardy limit MAX_TRAITS: jeśli zaznaczenie tego checkboxa
      // przekroczyłoby limit, cofamy je od razu.
      const selectedCount = checkboxes.filter((cb) => cb.checked).length;
      if (selectedCount > MAX_TRAITS) {
        event.target.checked = false;
        return;
      }
      errorMessage.hidden = true;
    });

    const text = document.createElement("span");
    text.textContent = trait.label;

    optionLabel.appendChild(checkbox);
    optionLabel.appendChild(text);
    traitsList.appendChild(optionLabel);

    return checkbox;
  });

  wrapper.appendChild(traitsList);
  wrapper.appendChild(errorMessage);

  const startButton = document.createElement("button");
  startButton.className = "primary-button";
  startButton.textContent = "Start gry";
  startButton.addEventListener("click", () => {
    const selectedTraitIds = checkboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);

    if (!isValidTraitSelection(selectedTraitIds)) {
      errorMessage.textContent = `Możesz wybrać maksymalnie ${MAX_TRAITS} cech.`;
      errorMessage.hidden = false;
      return;
    }

    startNewGame({
      name: nameInput.value,
      pronouns: pronounsInput.value,
      selectedTraitIds
    });

    showScreen("game");
  });
  wrapper.appendChild(startButton);

  container.appendChild(wrapper);
}

/**
 * Pomocnicza funkcja: dodaje do kontenera etykietę + pole tekstowe
 * i zwraca referencję do inputa.
 */
function appendTextField(container, { id, labelText, placeholder }) {
  const label = document.createElement("label");
  label.className = "field-label";
  label.textContent = labelText;
  label.setAttribute("for", id);
  container.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.className = "text-input";
  input.placeholder = placeholder || "";
  container.appendChild(input);

  return input;
}
