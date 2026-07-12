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
import {
  ensureCriticalEventState,
  evaluateCriticalEvent,
  generateNextCriticalEvent,
  buildCriticalEventSummary
} from "../../systems/criticalEventSystem.js";

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

  // v0.20: Monthly Critical Event Foundation. Ta sama idempotentna
  // logika co Weekly Stakes powyżej, ale z 28-dniowym cyklem i innymi
  // efektami (trust/frustration/current spoons, BEZ max spoons — patrz
  // criticalEventSystem.js). To DRUGI, niezależny system — nie zastępuje
  // ani nie dubluje Weekly Stakes.
  ensureCriticalEventState(state);
  evaluateCriticalEvent(state);
  generateNextCriticalEvent(state);

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
  wrapper.appendChild(renderCriticalEventSection(state));

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

// CLEAN v0.20 critical event section START
// v0.20: Monthly Critical Event Foundation. Ta sama zasada co sekcja
// Weekly Stakes powyżej: reużywa istniejące klasy CSS
// (.weekly-summary-panel / .weekly-summary-heading / .weekly-challenge-*)
// — zero nowego CSS, żeby nie ruszać layoutu v0.18/v0.19.
function renderCriticalEventSection(state) {
  const panel = document.createElement("div");
  panel.className = "weekly-summary-panel";

  const heading = document.createElement("p");
  heading.className = "weekly-summary-heading";
  heading.textContent = "Wielki Test";
  panel.appendChild(heading);

  const eventSummary = buildCriticalEventSummary(state);

  if (eventSummary.lastResult) {
    panel.appendChild(renderCriticalEventResult(eventSummary.lastResult));
  }

  if (eventSummary.upcoming) {
    panel.appendChild(renderUpcomingCriticalEvent(eventSummary, state));
  }

  return panel;
}

function renderCriticalEventResult(result) {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-challenge-result";

  const title = document.createElement("p");
  title.textContent = result.success
    ? `Wielki Test zaliczony: ${result.title}`
    : `Wielki Test niezaliczony: ${result.title}`;
  wrapper.appendChild(title);

  const detail = document.createElement("p");
  detail.textContent = result.text || "";
  wrapper.appendChild(detail);

  const effect = document.createElement("p");
  effect.textContent = `Efekt: ${formatCriticalEventEffect(result.effect)}`;
  wrapper.appendChild(effect);

  return wrapper;
}

function formatCriticalEventEffect(effect) {
  if (!effect) {
    return "";
  }

  return [
    `Zaufanie ${formatSigned(effect.trustChange)}`,
    `Frustracja ${formatSigned(effect.frustrationChange)}`,
    `Spoons ${formatSigned(effect.spoonsChange)}`
  ].join(", ");
}

function renderUpcomingCriticalEvent(eventSummary, state) {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-challenge-upcoming";

  const heading = document.createElement("p");
  heading.textContent = "Na horyzoncie";
  wrapper.appendChild(heading);

  const title = document.createElement("p");
  title.textContent = eventSummary.upcoming.title;
  wrapper.appendChild(title);

  // v0.20.1, Część D: separator "·" zamiast " i " TYLKO w tym miejscu
  // (Wielki Test w weekly summary) — Weekly Stakes i sam formatter w
  // criticalEventSystem.js dalej używają pełnego " i ".
  const condition = document.createElement("p");
  condition.textContent = `Warunek: ${eventSummary.upcomingConditionText.replace(/ i /g, " · ")}`;
  wrapper.appendChild(condition);

  const countdown = document.createElement("p");
  countdown.textContent = `Pozostało: ${eventSummary.upcomingDaysLeft} dni`;
  wrapper.appendChild(countdown);

  // v0.20.1, Część B: postęp miesięcznego łuku, np. "Miesięczny łuk:
  // dzień 8 z 28". Liczony TU (nie w criticalEventSystem.js — nie było
  // to konieczne, mamy tu już wszystkie potrzebne dane: arcStartDay,
  // dueDay, state.day), czysto tekstowa linia, bez paska CSS.
  const arcProgress = document.createElement("p");
  arcProgress.textContent = buildMonthlyArcProgressText(eventSummary.upcoming, state);
  wrapper.appendChild(arcProgress);

  return wrapper;
}

function buildMonthlyArcProgressText(event, state) {
  const total = event.dueDay - event.arcStartDay + 1;
  const rawDay = state.day - event.arcStartDay + 1;
  const clampedDay = Math.min(total, Math.max(1, rawDay));
  return `Miesięczny łuk: dzień ${clampedDay} z ${total}`;
}
// CLEAN v0.20 critical event section END

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
