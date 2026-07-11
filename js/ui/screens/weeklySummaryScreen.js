// weeklySummaryScreen.js
//
// v0.11: weekly summary screen.
// The day has already advanced in eveningScreen.js before this screen appears.
// This screen does not call advanceToNextDay().

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { buildWeeklySummary } from "../../systems/weeklySummarySystem.js";
import {
  ensureWeeklyChallengeState,
  evaluateWeeklyChallenge,
  generateNextWeekChallenge,
  buildWeeklyChallengeSummary
} from "../../systems/weeklyChallengeSystem.js";

export function renderWeeklySummaryScreen(container) {
  const state = getState();

  // v0.19: oceń poprzednie wyzwanie (jeśli jego termin minął) i od razu
  // wygeneruj kolejne na nadchodzący tydzień, ZANIM zbudujemy podsumowanie
  // — dzięki temu "Aktualny stan" niżej pokazuje spoons już po ewentualnej
  // nagrodzie/karze. Obie funkcje są idempotentne (patrz
  // weeklyChallengeSystem.js), więc bezpieczne nawet przy wielokrotnym
  // renderze tego ekranu.
  ensureWeeklyChallengeState(state);
  evaluateWeeklyChallenge(state);
  generateNextWeekChallenge(state);

  const summary = buildWeeklySummary(state);

  const wrapper = document.createElement("div");
  wrapper.className = "screen weekly-summary-screen";

  const title = document.createElement("h2");
  title.textContent = "Podsumowanie tygodnia";
  wrapper.appendChild(title);

  const period = document.createElement("p");
  period.className = "weekly-summary-period";
  period.textContent = `Tydzień ${summary.weekNumber} — dni ${summary.startDay}–${summary.endDay}`;
  wrapper.appendChild(period);

  const text = document.createElement("p");
  text.className = "weekly-summary-text";
  text.textContent = summary.summaryText;
  wrapper.appendChild(text);

  wrapper.appendChild(renderEffectsPanel(summary));
  wrapper.appendChild(renderCurrentStatePanel(summary));
  wrapper.appendChild(renderWeeklyChallengeSection(state));

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Rozpocznij kolejny tydzień";
  continueButton.addEventListener("click", () => {
    saveGame();
    showScreen("game");
  });
  wrapper.appendChild(continueButton);

  container.appendChild(wrapper);
}

// CLEAN v0.19 weekly challenge section START
// v0.19: Weekly Stakes. Sekcja reużywa istniejące klasy CSS
// (.weekly-summary-panel / .weekly-summary-heading) — celowo bez
// nowego CSS, zgodnie z wymogiem "nie musi być jeszcze pięknie
// stylizowana jak gameplay UI".
function renderWeeklyChallengeSection(state) {
  const panel = document.createElement("div");
  panel.className = "weekly-summary-panel";

  const heading = document.createElement("p");
  heading.className = "weekly-summary-heading";
  heading.textContent = "Stawka tygodnia";
  panel.appendChild(heading);

  const challengeSummary = buildWeeklyChallengeSummary(state);

  if (challengeSummary.lastResult) {
    panel.appendChild(renderChallengeResult(challengeSummary.lastResult));
  }

  if (challengeSummary.upcoming) {
    panel.appendChild(renderUpcomingChallenge(challengeSummary));
  }

  return panel;
}

function renderChallengeResult(result) {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-challenge-result";

  const title = document.createElement("p");
  title.textContent = result.success
    ? `Udało się: ${result.title}`
    : `Nie udało się: ${result.title}`;
  wrapper.appendChild(title);

  const detail = document.createElement("p");
  detail.textContent = result.success
    ? "Relacja wytrzymała próbę."
    : "Wchodzisz w kolejny tydzień z większym napięciem.";
  wrapper.appendChild(detail);

  const effect = document.createElement("p");
  effect.textContent = result.success
    ? "Nagroda: +1 do maksymalnych spoons."
    : "Kara: -2 spoons na start tygodnia.";
  wrapper.appendChild(effect);

  return wrapper;
}

function renderUpcomingChallenge(challengeSummary) {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-challenge-upcoming";

  const heading = document.createElement("p");
  heading.textContent = "Stawka nadchodzącego tygodnia";
  wrapper.appendChild(heading);

  const title = document.createElement("p");
  title.textContent = challengeSummary.upcoming.title;
  wrapper.appendChild(title);

  const condition = document.createElement("p");
  condition.textContent = `Warunek: ${challengeSummary.upcomingConditionText}`;
  wrapper.appendChild(condition);

  const countdown = document.createElement("p");
  countdown.textContent = `Pozostało: ${challengeSummary.upcomingDaysLeft} dni`;
  wrapper.appendChild(countdown);

  return wrapper;
}
// CLEAN v0.19 weekly challenge section END

function renderEffectsPanel(summary) {
  const panel = document.createElement("div");
  panel.className = "weekly-summary-panel";

  const heading = document.createElement("p");
  heading.className = "weekly-summary-heading";
  heading.textContent = "Efekty tygodnia";
  panel.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "weekly-summary-list";

  list.appendChild(renderSummaryItem("Spoons", summary.spoonsChange));
  list.appendChild(renderSummaryItem("Zaufanie", summary.trustChange));
  list.appendChild(renderSummaryItem("Frustracja", summary.frustrationChange));

  if (summary.hasFatigueData && summary.fatigueChange !== 0) {
    list.appendChild(renderSummaryItem("Przeciążenie", summary.fatigueChange));
  }

  panel.appendChild(list);
  return panel;
}

function renderCurrentStatePanel(summary) {
  const panel = document.createElement("div");
  panel.className = "weekly-summary-current-state";

  const heading = document.createElement("p");
  heading.className = "weekly-summary-heading";
  heading.textContent = "Aktualny stan";
  panel.appendChild(heading);

  panel.appendChild(renderStateLine(`Aktualne spoons: ${summary.currentSpoons}/${summary.maxSpoons}`));

  if (summary.currentTrust !== null) {
    panel.appendChild(renderStateLine(`Zaufanie: ${summary.currentTrust}/100`));
  }

  if (summary.currentFrustration !== null) {
    panel.appendChild(renderStateLine(`Frustracja: ${summary.currentFrustration}/100`));
  }

  if (summary.relationshipMoodLabel) {
    panel.appendChild(renderStateLine(`Stan relacji: ${summary.relationshipMoodLabel}`));
  }

  if (summary.relationshipMoodDescription) {
    const description = document.createElement("p");
    description.className = "weekly-summary-mood-description";
    description.textContent = summary.relationshipMoodDescription;
    panel.appendChild(description);
  }

  return panel;
}

function renderSummaryItem(label, value) {
  const item = document.createElement("li");
  item.className = "weekly-summary-item";

  const labelEl = document.createElement("span");
  labelEl.className = "weekly-summary-label";
  labelEl.textContent = `${label}:`;
  item.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "weekly-summary-value";
  valueEl.textContent = formatSigned(value);
  item.appendChild(valueEl);

  return item;
}

function renderStateLine(text) {
  const line = document.createElement("p");
  line.textContent = text;
  return line;
}

function formatSigned(value) {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "0";
}
