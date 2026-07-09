// eventScreen.js
//
// Ekran wydarzenia decyzyjnego: pokazuje opis sytuacji i dostępne
// wybory. Koszt w spoons jest pokazywany jawnie przy każdej opcji —
// to informacja, nie ocena (zgodnie z zasadą "gra pokazuje konsekwencje,
// nie mówi co jest dobre").

import { showScreen } from "../uiManager.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();

  const wrapper = document.createElement("div");
  wrapper.className = "screen event-screen";

  const title = document.createElement("h2");
  title.textContent = event.title;
  wrapper.appendChild(title);

  const description = document.createElement("p");
  description.textContent = event.description;
  wrapper.appendChild(description);

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  event.choices.forEach((choice) => {
    choicesList.appendChild(renderChoiceButton(choice));
  });

  wrapper.appendChild(choicesList);
  container.appendChild(wrapper);
}

function renderChoiceButton(choice) {
  const button = document.createElement("button");
  button.className = "choice-button";

  const label = document.createElement("span");
  label.className = "choice-label";
  label.textContent = choice.label;
  button.appendChild(label);

  if (choice.spoonsCost > 0) {
    const cost = document.createElement("span");
    cost.className = "choice-cost";
    cost.textContent = `− ${choice.spoonsCost} spoons`;
    button.appendChild(cost);
  }

  button.addEventListener("click", () => {
    resolveEvent(choice.id);
    showScreen("reflection");
  });

  return button;
}
