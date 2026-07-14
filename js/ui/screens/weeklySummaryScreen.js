// weeklySummaryScreen.js
//
// v0.11: weekly summary screen.
// The day has already advanced in eveningScreen.js before this screen appears.
// This screen does not call advanceToNextDay().
//
// v0.19: dodana ocena/generacja Weekly Stakes (idempotentna).
// v0.20: dodana ocena/generacja Critical Event / Wielki Test (idempotentna,
// niezależna od Weekly Stakes).
//
// v0.21: Weekly Summary / Monthly Arc UI Polish. Ekran przestał wyglądać
// jak techniczna lista statystyk i dostał nowy, izolowany namespace
// ".oos-weekly-summary" (patrz css/weekly-summary-v0-21.css) — milestone
// screen / tygodniowy rytuał zamiast tabeli. MECHANIKA jest CAŁKOWICIE
// NIETKNIĘTA: dalej oceniamy i generujemy Weekly Stakes oraz Critical
// Event dokładnie w tej samej kolejności i w ten sam idempotentny sposób
// co w v0.19/v0.20, zanim zbudujemy podsumowanie. Zmienia się WYŁĄCZNIE
// prezentacja tych samych danych.
//
// Ten ekran CELOWO nie używa .oos-game ani oosLayout.js — to inny,
// osobny namespace (".oos-weekly-summary"), bo to nie jest część planszy
// gameplayowej (grid .oos-game zostaje całkowicie nietknięty).

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
} from "../../systems/criticalEventSystem.js?v=250";
import {
  ensurePatternState,
  recordPatternFromWeeklyResult,
  recordPatternFromCriticalResult,
  getWeeklyPatternEchoes
} from "../../systems/patternSystem.js";
import { buildWeeklyPartnerCapacityNote } from "../../systems/partnerCapacitySystem.js";
import { buildWeeklyRelationshipScarsNote } from "../../systems/relationshipScarsSystem.js";
import { buildWeeklyRelationshipRepairNote } from "../../systems/relationshipRepairSystem.js";
import { buildWeeklyStaticNote } from "../../systems/staticSystem.js?v=270";

export function renderWeeklySummaryScreen(container) {
  const state = getState();

  // v0.19: oceń poprzednie wyzwanie (jeśli jego termin minął) i od razu
  // wygeneruj kolejne na nadchodzący tydzień, ZANIM zbudujemy podsumowanie
  // — dzięki temu sekcja "Aktualny stan" niżej pokazuje spoons już po
  // ewentualnej nagrodzie/karze. Obie funkcje są idempotentne (patrz
  // weeklyChallengeSystem.js), więc bezpieczne nawet przy wielokrotnym
  // renderze tego ekranu. NIE ZMIENIONE w v0.21.
  ensureWeeklyChallengeState(state);
  const weeklyEvaluation = evaluateWeeklyChallenge(state);
  generateNextWeekChallenge(state);

  // v0.20: Monthly Critical Event Foundation. Ta sama idempotentna
  // logika co Weekly Stakes powyżej, ale z 28-dniowym cyklem i innymi
  // efektami (trust/frustration/current spoons, BEZ max spoons — patrz
  // criticalEventSystem.js). To DRUGI, niezależny system. NIE ZMIENIONE
  // w v0.21.
  ensureCriticalEventState(state);
  const criticalEvaluation = evaluateCriticalEvent(state);
  generateNextCriticalEvent(state);

  // v0.22: Pattern Foundation / Narrative Echoes. evaluateWeeklyChallenge/
  // evaluateCriticalEvent zwracają wynik TYLKO na tym renderze, na którym
  // ocena faktycznie się wykonała (potem ich "active" jest już null albo
  // dotyczy nowego, jeszcze nie-due cyklu) — więc to naturalnie rzadkie
  // zdarzenie. recordPatternFromWeeklyResult/recordPatternFromCriticalResult
  // są DODATKOWO idempotentne przez key (patrz patternSystem.js), więc
  // podwójne wywołanie i tak nigdy nie zduplikuje wpisu historii.
  ensurePatternState(state);
  if (weeklyEvaluation) {
    recordPatternFromWeeklyResult(state, weeklyEvaluation);
  }
  if (criticalEvaluation) {
    recordPatternFromCriticalResult(state, criticalEvaluation);
  }

  const summary = buildWeeklySummary(state);
  const challengeSummary = buildWeeklyChallengeSummary(state);
  const criticalSummary = buildCriticalEventSummary(state);

  const root = document.createElement("section");
  root.className = "oos-weekly-summary screen";

  root.appendChild(buildHeader(summary));

  const grid = document.createElement("main");
  grid.className = "oos-weekly-summary__grid";
  grid.appendChild(buildStoryCard(summary, state));
  grid.appendChild(buildStateCard(summary, state));
  grid.appendChild(buildWeeklyStakeCard(challengeSummary));
  grid.appendChild(buildCriticalEventCard(criticalSummary, state));
  root.appendChild(grid);

  root.appendChild(buildFooter());

  container.appendChild(root);
}

// --------------------------------------------------------------------
// Header
// --------------------------------------------------------------------

function buildHeader(summary) {
  const header = document.createElement("header");
  header.className = "oos-weekly-summary__header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-weekly-summary__eyebrow";
  eyebrow.textContent = "Podsumowanie tygodnia";
  header.appendChild(eyebrow);

  const title = document.createElement("h1");
  title.className = "oos-weekly-summary__title";
  title.textContent = `Tydzień ${summary.weekNumber} zakończony`;
  header.appendChild(title);

  const period = document.createElement("p");
  period.className = "oos-weekly-summary__period";
  period.textContent = `Dni ${summary.startDay}–${summary.endDay}`;
  header.appendChild(period);

  return header;
}

// --------------------------------------------------------------------
// Karta 1 — Wynik tygodnia (story)
// --------------------------------------------------------------------

function buildStoryCard(summary, state) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--story";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Jak minął tydzień";
  card.appendChild(heading);

  const text = document.createElement("p");
  text.className = "oos-weekly-summary__story-text";
  text.textContent = summary.summaryText;
  card.appendChild(text);

  const chips = document.createElement("div");
  chips.className = "oos-weekly-summary__effect-chips";

  chips.appendChild(createEffectChip("🥄 Spoons", summary.spoonsChange));
  chips.appendChild(createEffectChip("🤝 Zaufanie", summary.trustChange));
  // Frustracja ma ODWRÓCONĄ semantykę koloru — wzrost jest złym efektem
  // (czerwony), spadek dobrym (zielony). Ta sama zasada co w
  // reflectionScreen.js (patrz oosLayout.js#createResultTile).
  chips.appendChild(createEffectChip("🌡️ Frustracja", summary.frustrationChange, "down"));

  if (summary.hasFatigueData && summary.fatigueChange !== 0) {
    chips.appendChild(createEffectChip("🌀 Przeciążenie", summary.fatigueChange, "down"));
  }

  card.appendChild(chips);

  // v0.22: Pattern Foundation / Narrative Echoes. Blok "Co zaczyna być
  // wzorem" pod chipsami — do 3 AKTYWNYCH wzorców (nie pojedynczych
  // ech). Style w osobnym, nowym pliku css/patterns-v0-22.css
  // (namespace .oos-weekly-summary__pattern-*), nie w
  // weekly-summary-v0-21.css.
  const patterns = getWeeklyPatternEchoes(state, 3);
  if (patterns.length > 0) {
    card.appendChild(buildPatternsBlock(patterns));
  }

  return card;
}

function buildPatternsBlock(patterns) {
  const wrapper = document.createElement("div");
  wrapper.className = "oos-weekly-summary__patterns";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__patterns-heading";
  heading.textContent = "Co zaczyna być wzorem";
  wrapper.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "oos-weekly-summary__pattern-list";

  patterns.forEach((pattern) => {
    const item = document.createElement("li");
    item.className = "oos-weekly-summary__pattern-item";

    const title = document.createElement("span");
    title.className = "oos-weekly-summary__pattern-title";
    title.textContent = pattern.title;
    item.appendChild(title);

    const description = document.createElement("span");
    description.className = "oos-weekly-summary__pattern-description";
    description.textContent = ` — ${pattern.description}`;
    item.appendChild(description);

    list.appendChild(item);
  });

  wrapper.appendChild(list);
  return wrapper;
}

function createEffectChip(label, value, desirableDirection) {
  const direction = resolveChipDirection(value, desirableDirection);

  const chip = document.createElement("span");
  chip.className = `oos-weekly-summary__effect-chip oos-weekly-summary__effect-chip--${direction}`;

  const labelEl = document.createElement("span");
  labelEl.className = "oos-weekly-summary__effect-chip-label";
  labelEl.textContent = label;
  chip.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "oos-weekly-summary__effect-chip-value";
  valueEl.textContent = formatSigned(value);
  chip.appendChild(valueEl);

  return chip;
}

function resolveChipDirection(value, desirableDirection) {
  if (!value) {
    return "neutral";
  }

  const isIncrease = value > 0;

  if (desirableDirection === "down") {
    return isIncrease ? "negative" : "positive";
  }

  return isIncrease ? "positive" : "negative";
}

// --------------------------------------------------------------------
// Karta 2 — Aktualny stan
// --------------------------------------------------------------------

function buildStateCard(summary, state) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--state";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Aktualny stan";
  card.appendChild(heading);

  const list = document.createElement("div");
  list.className = "oos-weekly-summary__stat-lines";

  list.appendChild(createStatLine("Spoons", `${summary.currentSpoons}/${summary.maxSpoons}`));

  if (summary.currentTrust !== null) {
    list.appendChild(createStatLine("Zaufanie", `${summary.currentTrust}/100`));
  }

  if (summary.currentFrustration !== null) {
    list.appendChild(createStatLine("Frustracja", `${summary.currentFrustration}/100`));
  }

  if (summary.relationshipMoodLabel) {
    list.appendChild(createStatLine("Stan relacji", summary.relationshipMoodLabel));
  }

  card.appendChild(list);

  if (summary.relationshipMoodDescription) {
    const description = document.createElement("p");
    description.className = "oos-weekly-summary__mood-description";
    description.textContent = summary.relationshipMoodDescription;
    card.appendChild(description);
  }

  // v0.23: Partner Capacity Foundation. Krótka, zagregowana notatka o
  // partnerze z ostatniego tygodnia — reużywa ISTNIEJĄCEJ klasy CSS
  // (.oos-weekly-summary__mood-description), zero nowego pliku CSS.
  const partnerNote = buildWeeklyPartnerCapacityNote(state);
  if (partnerNote) {
    const partnerNoteEl = document.createElement("p");
    partnerNoteEl.className = "oos-weekly-summary__mood-description";
    partnerNoteEl.textContent = partnerNote;
    card.appendChild(partnerNoteEl);
  }

  // v0.25: Relationship Scars. Krótka, naturalna wzmianka o aktywnych
  // bliznach relacyjnych (max 2 tytuły) — znowu reużywa ISTNIEJĄCEJ
  // klasy CSS, zero nowego pliku CSS, zero tabeli/listy.
  const scarsNote = buildWeeklyRelationshipScarsNote(state);
  if (scarsNote) {
    const scarsNoteEl = document.createElement("p");
    scarsNoteEl.className = "oos-weekly-summary__mood-description";
    scarsNoteEl.textContent = scarsNote;
    card.appendChild(scarsNoteEl);
  }

  // v0.26: Repair Events. Krótka notatka, JEŚLI w ostatnim tygodniu
  // zadziałała naprawa blizny — znowu reużywa ISTNIEJĄCEJ klasy CSS,
  // zero nowego pliku CSS.
  const repairNote = buildWeeklyRelationshipRepairNote(state);
  if (repairNote) {
    const repairNoteEl = document.createElement("p");
    repairNoteEl.className = "oos-weekly-summary__mood-description";
    repairNoteEl.textContent = repairNote;
    card.appendChild(repairNoteEl);
  }

  // v0.27: The Static. Krótka wzmianka, JEŚLI w ostatnim tygodniu szum
  // wewnętrzny osiągnął intensity >= 2 przynajmniej raz — reużywa
  // ISTNIEJĄCEJ klasy CSS, zero nowego pliku CSS, zero listy powodów.
  const staticNote = buildWeeklyStaticNote(state);
  if (staticNote) {
    const staticNoteEl = document.createElement("p");
    staticNoteEl.className = "oos-weekly-summary__mood-description";
    staticNoteEl.textContent = staticNote;
    card.appendChild(staticNoteEl);
  }

  return card;
}

function createStatLine(label, value) {
  const line = document.createElement("div");
  line.className = "oos-weekly-summary__stat-line";

  const labelEl = document.createElement("span");
  labelEl.className = "oos-weekly-summary__stat-line-label";
  labelEl.textContent = label;
  line.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "oos-weekly-summary__stat-line-value";
  valueEl.textContent = value;
  line.appendChild(valueEl);

  return line;
}

// --------------------------------------------------------------------
// Karta 3 — Stawka tygodnia
// --------------------------------------------------------------------

function buildWeeklyStakeCard(challengeSummary) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--weekly-stake";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Stawka tygodnia";
  card.appendChild(heading);

  if (challengeSummary.lastResult) {
    card.appendChild(buildResultBlock({
      titleText: challengeSummary.lastResult.success
        ? `Udało się: ${challengeSummary.lastResult.title}`
        : `Nie udało się: ${challengeSummary.lastResult.title}`,
      detailText: challengeSummary.lastResult.success
        ? "Relacja wytrzymała próbę."
        : "Wchodzisz w kolejny tydzień z większym napięciem.",
      effectText: challengeSummary.lastResult.success
        ? "Nagroda: +1 do maksymalnych spoons."
        : "Kara: -2 spoons na start tygodnia.",
      success: challengeSummary.lastResult.success
    }));
  }

  if (challengeSummary.upcoming) {
    card.appendChild(buildUpcomingBlock({
      eyebrowText: "Stawka nadchodzącego tygodnia",
      titleText: challengeSummary.upcoming.title,
      conditionText: challengeSummary.upcomingConditionText,
      daysLeftText: `Pozostało: ${challengeSummary.upcomingDaysLeft} dni`
    }));
  }

  return card;
}

// --------------------------------------------------------------------
// Karta 4 — Wielki Test
// --------------------------------------------------------------------

function buildCriticalEventCard(criticalSummary, state) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--critical-event";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Wielki Test";
  card.appendChild(heading);

  if (criticalSummary.lastResult) {
    card.appendChild(buildResultBlock({
      titleText: criticalSummary.lastResult.success
        ? `Wielki Test zaliczony: ${criticalSummary.lastResult.title}`
        : `Wielki Test niezaliczony: ${criticalSummary.lastResult.title}`,
      detailText: criticalSummary.lastResult.text || "",
      effectText: `Efekt: ${formatCriticalEventEffect(criticalSummary.lastResult.effect)}`,
      success: criticalSummary.lastResult.success
    }));
  }

  if (criticalSummary.upcoming) {
    // v0.20.1, Część D (przeniesione bez zmian): separator "·" zamiast
    // " i " TYLKO w tym miejscu (Wielki Test w weekly summary) — sam
    // formatter w criticalEventSystem.js i Weekly Stakes dalej używają
    // pełnego " i ".
    const compactCondition = criticalSummary.upcomingConditionText.replace(/ i /g, " · ");

    const upcomingBlock = buildUpcomingBlock({
      eyebrowText: "Na horyzoncie",
      titleText: criticalSummary.upcoming.title,
      conditionText: compactCondition,
      daysLeftText: `Pozostało: ${criticalSummary.upcomingDaysLeft} dni`
    });

    // v0.20.1, Część B (przeniesione bez zmian, tekst poprawiony w v0.23:
    // "cykl" zamiast "łuk"): postęp miesięcznego cyklu, liczony lokalnie
    // tutaj — nie wymaga zmian w criticalEventSystem.js.
    const arcProgress = document.createElement("p");
    arcProgress.className = "oos-weekly-summary__arc-progress";
    arcProgress.textContent = buildMonthlyArcProgressText(criticalSummary.upcoming, state);
    upcomingBlock.appendChild(arcProgress);

    card.appendChild(upcomingBlock);
  }

  return card;
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

function buildMonthlyArcProgressText(event, state) {
  const total = event.dueDay - event.arcStartDay + 1;
  const rawDay = state.day - event.arcStartDay + 1;
  const clampedDay = Math.min(total, Math.max(1, rawDay));
  return `Miesięczny cykl: dzień ${clampedDay} z ${total}`;
}

// --------------------------------------------------------------------
// Wspólne bloki (result / upcoming) dla kart Stawka tygodnia i Wielki Test
// --------------------------------------------------------------------

function buildResultBlock({ titleText, detailText, effectText, success }) {
  const wrapper = document.createElement("div");
  wrapper.className = success
    ? "oos-weekly-summary__result oos-weekly-summary__result--success"
    : "oos-weekly-summary__result oos-weekly-summary__result--failure";

  const title = document.createElement("p");
  title.className = "oos-weekly-summary__result-title";
  title.textContent = titleText;
  wrapper.appendChild(title);

  if (detailText) {
    const detail = document.createElement("p");
    detail.className = "oos-weekly-summary__result-detail";
    detail.textContent = detailText;
    wrapper.appendChild(detail);
  }

  const effect = document.createElement("p");
  effect.className = "oos-weekly-summary__result-effect";
  effect.textContent = effectText;
  wrapper.appendChild(effect);

  return wrapper;
}

function buildUpcomingBlock({ eyebrowText, titleText, conditionText, daysLeftText }) {
  const wrapper = document.createElement("div");
  wrapper.className = "oos-weekly-summary__upcoming";

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-weekly-summary__upcoming-eyebrow";
  eyebrow.textContent = eyebrowText;
  wrapper.appendChild(eyebrow);

  const title = document.createElement("p");
  title.className = "oos-weekly-summary__upcoming-title";
  title.textContent = titleText;
  wrapper.appendChild(title);

  const condition = document.createElement("p");
  condition.className = "oos-weekly-summary__upcoming-condition";
  condition.textContent = `Warunek: ${conditionText}`;
  wrapper.appendChild(condition);

  const countdown = document.createElement("p");
  countdown.className = "oos-weekly-summary__upcoming-countdown";
  countdown.textContent = daysLeftText;
  wrapper.appendChild(countdown);

  return wrapper;
}

// --------------------------------------------------------------------
// Footer
// --------------------------------------------------------------------

function buildFooter() {
  const footer = document.createElement("footer");
  footer.className = "oos-weekly-summary__footer";

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Rozpocznij kolejny tydzień";
  continueButton.addEventListener("click", () => {
    saveGame();
    showScreen("game");
  });
  footer.appendChild(continueButton);

  return footer;
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
