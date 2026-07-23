// monthSummaryScreen.js
//
// v0.30: Month One Complete Loop.
// Ekran krótkiego podsumowania pierwszego miesiąca.
//
// v0.30.5: stabilizacja — importy podbite do ?v=305.
//
// v0.58: Month End Payoff & Run Continuity. Ekran przestaje pokazywać
// tabelę liczb (usunięty buildStats: decisions/repairs/scars/...) i
// renderuje narracyjną strukturę zbudowaną przez
// monthlyLoopSystem.js#buildMonthSummary: hero + outcome + do 3 kart
// "co najbardziej niosło miesiąc" + opcjonalna karta Wielkiego Testu +
// linia o relacji + linia o zasobach + linia ciągłości + CTA, które
// TERAZ realnie woła advanceToNextMonth(state) przed przejściem dalej
// (miesiąc przechodzi do kolejnego numeru, gra się NIE resetuje).
// Działa dla dowolnego miesiąca N, nie tylko pierwszego.

import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { showScreen } from "../uiManager.js?v=601";
import { createTopBar } from "../oosLayout.js?v=530";
import { consumePendingMonthSummary, getLatestMonthSummary, advanceToNextMonth } from "../../systems/monthlyLoopSystem.js?v=580";

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
  title.textContent = summary ? summary.title : "Miesiąc domknięty";

  card.appendChild(eyebrow);
  card.appendChild(title);

  if (summary && summary.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.className = "oos-month-summary__subtitle";
    subtitle.textContent = summary.subtitle;
    card.appendChild(subtitle);
  }

  // Outcome — jedno wyraźne podsumowanie, NIGDY punktacja.
  if (summary) {
    const outcome = document.createElement("p");
    outcome.className = "oos-month-summary__outcome";
    outcome.textContent = summary.outcomeText;
    card.appendChild(outcome);
  } else {
    const fallback = document.createElement("p");
    fallback.className = "oos-month-summary__outcome";
    fallback.textContent = "Gra zapisała kolejny pełny cykl. Nie wszystko musi mieć werdykt, żeby zostawić ślad.";
    card.appendChild(fallback);
  }

  // Do 3 kart "co najbardziej niosło miesiąc" — tylko te, które
  // faktycznie mają coś do powiedzenia (buildCarryingSections już
  // filtruje po realnym stanie).
  if (summary && Array.isArray(summary.sections) && summary.sections.length > 0) {
    const sectionsWrap = document.createElement("div");
    sectionsWrap.className = "oos-month-summary__sections";
    for (const s of summary.sections) {
      sectionsWrap.appendChild(buildSection(s.title, s.text));
    }
    card.appendChild(sectionsWrap);
  }

  // Wielki Test — tylko jeśli faktycznie się rozliczył.
  if (summary && summary.criticalSection) {
    card.appendChild(buildSection(summary.criticalSection.title, summary.criticalSection.text));
  }

  // Relacja / Zasoby — stałe, pojedyncze linie.
  if (summary && summary.relationshipLine) {
    card.appendChild(buildLine(summary.relationshipLine));
  }
  if (summary && summary.resourcesLine) {
    card.appendChild(buildLine(summary.resourcesLine));
  }

  // Ciągłość — co przechodzi dalej.
  if (summary && summary.continuityLine) {
    const continuity = document.createElement("p");
    continuity.className = "oos-month-summary__continuity";
    continuity.textContent = summary.continuityLine;
    card.appendChild(continuity);
  }

  const note = document.createElement("p");
  note.className = "oos-month-summary__note";
  note.textContent =
    "To nie jest zakończenie. To moment, w którym gra może spojrzeć wstecz bez udawania, że decyzje były osobne.";
  card.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "oos-month-summary__actions";

  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.className = "oos-button oos-month-summary__button";
  continueButton.textContent = "Wejdź w kolejny miesiąc";
  continueButton.addEventListener("click", () => {
    // v0.58: realne przejście dalej — WYŁĄCZNIE monthProgress.
    // Gracz/partner/npcs/fatigue/spoons/relationshipModel/memories/
    // scars/work/achievements zostają całkowicie nietknięte.
    advanceToNextMonth(state);
    saveGame(state);
    showScreen("game");
  });

  actions.appendChild(continueButton);
  card.appendChild(actions);

  wrapper.appendChild(card);
  root.appendChild(wrapper);
}

function buildSection(titleText, bodyText) {
  const section = document.createElement("div");
  section.className = "oos-month-summary__section";

  const heading = document.createElement("p");
  heading.className = "oos-month-summary__section-heading";
  heading.textContent = titleText;

  const body = document.createElement("p");
  body.className = "oos-month-summary__section-body";
  body.textContent = bodyText;

  section.appendChild(heading);
  section.appendChild(body);
  return section;
}

function buildLine(text) {
  const line = document.createElement("p");
  line.className = "oos-month-summary__line";
  line.textContent = text;
  return line;
}
