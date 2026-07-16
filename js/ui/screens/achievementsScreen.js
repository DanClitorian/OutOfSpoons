// achievementsScreen.js
//
// v0.41: widoczny ekran osiągnięć / kamieni milowych.
// Ten ekran tylko czyta state.achievements. Nie odblokowuje niczego
// samodzielnie i nie zmienia mechaniki gry.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getAchievementDebugSummary } from "../../systems/achievementSystem.js?v=400";

export function renderAchievementsScreen(container) {
  const state = getState();
  const summary = state ? getAchievementDebugSummary(state) : null;
  const unlocked = summary && Array.isArray(summary.unlocked) ? summary.unlocked : [];

  const wrapper = document.createElement("section");
  wrapper.className = "oos-achievements";

  const card = document.createElement("article");
  card.className = "oos-achievements__card";

  const eyebrow = document.createElement("div");
  eyebrow.className = "oos-achievements__eyebrow";
  eyebrow.textContent = state ? `Dzień ${state.day} · Kamienie milowe` : "Kamienie milowe";
  card.appendChild(eyebrow);

  const title = document.createElement("h1");
  title.className = "oos-achievements__title";
  title.textContent = "Osiągnięcia";
  card.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "oos-achievements__intro";
  intro.textContent =
    "To nie jest lista rzeczy, które trzeba zrobić idealnie. To ślady momentów, które gra uznała za ważne.";
  card.appendChild(intro);

  const count = document.createElement("p");
  count.className = "oos-achievements__count";
  count.textContent = `Odblokowane: ${unlocked.length}`;
  card.appendChild(count);

  const list = document.createElement("div");
  list.className = "oos-achievements__list";

  if (unlocked.length === 0) {
    const empty = document.createElement("div");
    empty.className = "oos-achievements__empty";
    empty.textContent = "Jeszcze nic nie zostało nazwane. To też jest początek.";
    list.appendChild(empty);
  } else {
    for (const achievement of unlocked) {
      const item = document.createElement("section");
      item.className = "oos-achievements__item";

      const itemDay = document.createElement("div");
      itemDay.className = "oos-achievements__item-day";
      itemDay.textContent = achievement.day ? `Dzień ${achievement.day}` : "Odblokowane";
      item.appendChild(itemDay);

      const itemTitle = document.createElement("h2");
      itemTitle.className = "oos-achievements__item-title";
      itemTitle.textContent = achievement.title || "Kamień milowy";
      item.appendChild(itemTitle);

      const itemText = document.createElement("p");
      itemText.className = "oos-achievements__item-text";
      itemText.textContent = achievement.text || "Ten moment został zapisany.";
      item.appendChild(itemText);

      list.appendChild(item);
    }
  }

  card.appendChild(list);

  const actions = document.createElement("div");
  actions.className = "oos-achievements__actions";

  const backButton = document.createElement("button");
  backButton.className = "oos-achievements__button";
  backButton.textContent = state ? "Wróć do poranka" : "Wróć do menu";
  backButton.addEventListener("click", () => {
    showScreen(state ? "game" : "mainMenu");
  });
  actions.appendChild(backButton);

  card.appendChild(actions);
  wrapper.appendChild(card);
  container.appendChild(wrapper);
}
