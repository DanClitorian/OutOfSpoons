// relationshipEndScreen.js
//
// v0.36: ekran end-state relacji.
// To nie jest "przegrałeś". To ekran zakończenia konkretnej relacji.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  buildRelationshipEndSummary,
  markRelationshipEndSeen
} from "../../systems/relationshipEndStateSystem.js?v=360";

export function renderRelationshipEndScreen(container) {
  const state = getState();
  const summary = buildRelationshipEndSummary(state);

  const wrapper = document.createElement("section");
  wrapper.className = "oos-relationship-end";

  const card = document.createElement("article");
  card.className = "oos-relationship-end__card";

  const eyebrow = document.createElement("div");
  eyebrow.className = "oos-relationship-end__eyebrow";
  eyebrow.textContent = summary ? `Dzień ${summary.day} · Koniec relacji` : "Koniec relacji";
  card.appendChild(eyebrow);

  const title = document.createElement("h1");
  title.className = "oos-relationship-end__title";
  title.textContent = summary ? summary.title : "Ta relacja dobiegła końca";
  card.appendChild(title);

  const text = document.createElement("p");
  text.className = "oos-relationship-end__text";
  text.textContent = summary
    ? summary.text
    : "Nie znaleziono aktywnego zakończenia relacji w stanie gry.";
  card.appendChild(text);

  if (summary && summary.reason) {
    const reason = document.createElement("p");
    reason.className = "oos-relationship-end__reason";
    reason.textContent = summary.reason;
    card.appendChild(reason);
  }

  const note = document.createElement("p");
  note.className = "oos-relationship-end__note";
  note.textContent =
    "To nie usuwa zapisu i nie resetuje gry automatycznie. Ten stan zostaje w historii rozgrywki.";
  card.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "oos-relationship-end__actions";

  const menuButton = document.createElement("button");
  menuButton.className = "oos-relationship-end__button";
  menuButton.textContent = "Wróć do menu";
  menuButton.addEventListener("click", () => {
    if (state && summary) {
      markRelationshipEndSeen(state);
      saveGame(state);
    }
    showScreen("mainMenu");
  });
  actions.appendChild(menuButton);

  const stayButton = document.createElement("button");
  stayButton.className = "oos-relationship-end__button oos-relationship-end__button--ghost";
  stayButton.textContent = "Zostań z tym chwilę";
  stayButton.addEventListener("click", () => {
    if (state && summary) {
      markRelationshipEndSeen(state);
      saveGame(state);
    }
    stayButton.textContent = "Zapisano w historii";
    stayButton.disabled = true;
  });
  actions.appendChild(stayButton);

  card.appendChild(actions);
  wrapper.appendChild(card);
  container.appendChild(wrapper);
}
