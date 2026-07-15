// monthSummaryScreen.js
//
// v0.30: Month One Complete Loop.
// Ekran krótkiego podsumowania pierwszego miesiąca.
//
// v0.30.5: stabilizacja — importy podbite do ?v=305 (uiManager.js i
// monthlyLoopSystem.js oba zmieniły zawartość: uiManager.js dostał
// nowe query stringi na swoich importach, monthlyLoopSystem.js NIE
// zmienił się bezpośrednio, ale criticalEventSystem.js, od którego
// zależy, dostał nowe pole completedDay — bump zapewnia spójność
// całego łańcucha).

import { getState } from "../../state/gameState.js";
import { showScreen } from "../uiManager.js?v=305";
import { createTopBar } from "../oosLayout.js";
import { consumePendingMonthSummary, getLatestMonthSummary } from "../../systems/monthlyLoopSystem.js?v=305";

export function renderMonthSummaryScreen(root) {
  const state = getState();
  root.innerHTML = "";

  const summary = consumePendingMonthSummary(state) || getLatestMonthSummary(state);
  const wrapper = document.createElement("main");
  wrapper.className = "oos-month-summary";

  const topbar = createTopBar(state, "month-summary");
  wrapper.appendChild(topbar);

  const card = document.createElement("section");
  card.className = "oos-month-summary__card";

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-month-summary__eyebrow";
  eyebrow.textContent = "Podsumowanie miesiąca";

  const title = document.createElement("h1");
  title.className = "oos-month-summary__title";
  title.textContent = summary ? summary.title : "Pierwszy miesiąc domknięty";

  const body = document.createElement("p");
  body.className = "oos-month-summary__body";
  body.textContent = summary
    ? summary.body
    : "Gra zapisała pierwszy pełny cykl. Nie wszystko musi mieć werdykt, żeby zostawić ślad.";

  card.appendChild(eyebrow);
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(buildStats(summary));

  const note = document.createElement("p");
  note.className = "oos-month-summary__note";
  note.textContent =
    "To nie jest zakończenie. To pierwszy moment, w którym gra może spojrzeć wstecz bez udawania, że decyzje były osobne.";
  card.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "oos-month-summary__actions";

  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.className = "oos-button oos-month-summary__button";
  continueButton.textContent = "Wejść w kolejny miesiąc";
  continueButton.addEventListener("click", () => {
    showScreen("game");
  });

  actions.appendChild(continueButton);
  card.appendChild(actions);

  wrapper.appendChild(card);
  root.appendChild(wrapper);
}

function buildStats(summary) {
  const stats = document.createElement("div");
  stats.className = "oos-month-summary__stats";

  const values = summary && summary.stats ? summary.stats : {};
  const items = [
    ["Decyzje zapisane w dzienniku", values.decisions || 0],
    ["Naprawy relacji", values.repairs || 0],
    ["Aktywne blizny", values.scars || 0],
    ["Momenty sieci relacji", values.metamourMoments || 0],
    ["Momenty presji pracy", values.workMoments || 0],
    ["Aktywne wzorce", values.activePatterns || 0]
  ];

  for (const [label, value] of items) {
    const item = document.createElement("div");
    item.className = "oos-month-summary__stat";

    const number = document.createElement("strong");
    number.textContent = String(value);

    const text = document.createElement("span");
    text.textContent = label;

    item.appendChild(number);
    item.appendChild(text);
    stats.appendChild(item);
  }

  return stats;
}
