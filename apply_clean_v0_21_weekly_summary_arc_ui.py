#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_21_weekly_summary_arc_ui.py

Updater dla Out of Spoons: v0.20.3 -> v0.21 (Weekly Summary / Monthly
Arc UI Polish).

BAZA: repo faktycznie na v0.20.3 w momencie przygotowania tego
updatera (potwierdzone: badge "Out of Spoons v0.20.3", index.html
"main.js?v=203", commit "Fix dev tools module cache v0.20.3").
Wszystkie "OLD" stale ponizej zostaly wziete bezposrednio z realnego
stanu repo (git show HEAD) w momencie przygotowania tego skryptu.

TO NIE JEST LAYOUT RESET. Grid .oos-game, oosLayout.js,
css/game-ui-v0-18.css NIE sa ruszane w ogole. Ekrany event/evening/
reflection/agenda/game TEZ nie sa ruszane. devTools.js, weeklyChallengeSystem.js,
criticalEventSystem.js, weeklySummarySystem.js (logika) - wszystkie
NIETKNIETE. To wylacznie PREZENTACJA jednego ekranu: weeklySummaryScreen.js.

Co robi:

  - PODMIENIA CALA ZAWARTOSC js/ui/screens/weeklySummaryScreen.js:
    stary wrapper "screen weekly-summary-screen" (lista techniczna,
    stare klasy .weekly-summary-panel/.weekly-summary-heading z
    css/style.css) zastapiony nowym, izolowanym namespace
    ".oos-weekly-summary" z 4 kartami w gridzie:
      - Karta "story" (Wynik tygodnia): summary.summaryText + effect
        chips (Spoons/Zaufanie/Frustracja/opcjonalnie Przeciazenie).
        Frustracja ma ODWROCONA semantyke koloru: wzrost = czerwony,
        spadek = zielony (ta sama zasada co reflection screen).
      - Karta "state" (Aktualny stan): spoons, trust, frustration,
        mood + opis nastroju relacji.
      - Karta "weekly-stake" (Stawka tygodnia): wynik poprzedniego
        wyzwania + nadchodzace wyzwanie - DOKLADNIE TA SAMA tresc co
        wczesniej, tylko w nowej, kartowej prezentacji.
      - Karta "critical-event" (Wielki Test): wynik poprzedniego
        Wielkiego Testu + horyzont + warunek (separator "*") + postep
        miesiecznego luku "dzien X z 28" - DOKLADNIE TA SAMA tresc i
        TA SAMA logika obliczen co w v0.20.1, tylko przeniesiona do
        nowej struktury.

  - MECHANIKA JEST CALKOWICIE NIETKNIETA: renderWeeklySummaryScreen()
    nadal, w tej samej kolejnosci: ensureWeeklyChallengeState ->
    evaluateWeeklyChallenge -> generateNextWeekChallenge ->
    ensureCriticalEventState -> evaluateCriticalEvent ->
    generateNextCriticalEvent -> buildWeeklySummary(). Wszystkie te
    wywolania sa idempotentne (nie zmieniane w tym updaterze) - ocena
    nadal nie aplikuje sie wielokrotnie przy wielokrotnym renderze.
    Guzik "Rozpocznij kolejny tydzien" nadal robi TYLKO saveGame() +
    showScreen("game"), bez advanceToNextDay().

  - NOWY plik css/weekly-summary-v0-21.css: kompletnie osobny,
    izolowany plik (namespace .oos-weekly-summary), NIE dopisany do
    css/game-ui-v0-18.css. Styl: cieply parchment / paper board, karty
    z miekkim cieniem, subtelna ramka - milestone screen, nie
    dashboard. Jedyny scoped (nie globalny) wyjatek: override
    szerokosci kontenera TYLKO dla body[data-game-screen="weeklySummary"]
    #app (stary css/style.css dawal tu wazkie 640px pod stara, listowa
    wersje ekranu; nowy uklad kartowy potrzebuje wiecej miejsca).
    Przycisk kontynuacji zachowuje historyczna klase "primary-button"
    (spojnosc z reszta gry), ale styl jest w pelni SCOPED przez
    ".oos-weekly-summary__footer .primary-button", nie globalny.

  - index.html: dodany <link> do nowego CSS (PO game-ui-v0-18.css),
    cache-bust main.js?v=210. js/main.js SAM PLIK nie jest zmieniany
    (jego wewnetrzny import devTools.js?v=203 zostaje bez zmian -
    devTools.js tez sie nie zmienia w tym patchu, wiec nie ma potrzeby
    podbijac tego konkretnego cache-busta).

  Podbija wersje w js/data/versionData.js do v0.21.

Nie zmienia saveVersion. Nie zmienia css/game-ui-v0-18.css,
js/ui/oosLayout.js, js/ui/screens/gameScreen.js,
js/ui/screens/agendaScreen.js, js/ui/screens/eventScreen.js,
js/ui/screens/eveningScreen.js, js/ui/screens/reflectionScreen.js,
js/dev/devTools.js, js/systems/weeklyChallengeSystem.js,
js/systems/criticalEventSystem.js, js/systems/weeklySummarySystem.js,
js/main.js, dayCycle.js.

Skrypt jest idempotentny: mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane, a nie duplikowane/nadpisywane ponownie.

WAZNE dla pelnej podmiany weeklySummaryScreen.js: poniewaz jest
PODMIENIANY W CALOSCI (nie male fragmenty), ten updater wymaga, zeby
zawartosc pliku w repo dokladnie odpowiadala stanowi v0.20.3 sprzed
patcha. Jesli plik lokalnie rozni sie (np. reczna edycja
nieopublikowana jeszcze na GitHubie), updater PRZERWIE dzialanie z
jasnym komunikatem zamiast zgadywac lub nadpisywac cos po cichu.

Uzycie:
    python apply_clean_v0_21_weekly_summary_arc_ui.py

Domyslnie oczekuje repo w C:\\OutOfSpoons. Mozna podac inna sciezke
jako pierwszy argument linii polecen.
"""

import sys
from pathlib import Path


DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"


class UpdaterError(Exception):
    """Podnoszony, gdy sanity check nie przechodzi - lepiej przerwac,
    niz zepsuc plik nieprecyzyjnym patchem."""
    pass


def read_text(path: Path, encoding: str = "utf-8") -> str:
    if not path.exists():
        raise UpdaterError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding=encoding)


def write_text(path: Path, content: str, encoding: str = "utf-8") -> None:
    path.write_text(content, encoding=encoding)


def apply_patches(path: Path, patches, encoding: str = "utf-8") -> None:
    """
    patches: lista krotek (old_str, new_str, label).
    Idempotentnosc: jesli new_str jest juz w pliku, patch jest pomijany.
    Bezpieczenstwo: jesli old_str nie wystepuje dokladnie raz, przerywamy.
    """
    content = read_text(path, encoding=encoding)
    changed = False

    for old_str, new_str, label in patches:
        if new_str in content:
            print(f"  [pominieto] {label} (juz zastosowano)")
            continue

        count = content.count(old_str)
        if count == 0:
            raise UpdaterError(
                f"{path}\n"
                f"  Nie znaleziono oczekiwanego fragmentu dla patcha: '{label}'.\n"
                f"  Plik mogl sie zmienic od czasu przygotowania tego updatera.\n"
                f"  Nie aplikuje zadnych zmian do tego pliku - napraw recznie albo zglos rozbieznosc."
            )
        if count > 1:
            raise UpdaterError(
                f"{path}\n"
                f"  Fragment dla patcha '{label}' wystepuje {count} razy (oczekiwano dokladnie 1).\n"
                f"  Nie moge bezpiecznie zpatchowac tego pliku automatycznie."
            )

        content = content.replace(old_str, new_str, 1)
        changed = True
        print(f"  [ok] {label}")

    if changed:
        write_text(path, content, encoding=encoding)
    else:
        print(f"  (brak zmian w {path.name} - wszystko juz zastosowane)")


def replace_whole_file(path: Path, old_content: str, new_content: str, label: str) -> None:
    """
    Uzywane dla plikow podmienianych w calosci. Idempotentne i
    bezpieczne - patrz apply_patches.
    """
    current = read_text(path)

    if current == new_content:
        print(f"  [pominieto] {label} (juz zastosowano)")
        return

    if current != old_content:
        raise UpdaterError(
            f"{path}\n"
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.20.3 sprzed\n"
            f"  patcha, ani stanowi v0.21 po patchu. Plik mogl zostac\n"
            f"  recznie zmieniony od czasu przygotowania tego updatera.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie roznice\n"
            f"  (np. git diff) przed ponowna proba."
        )

    write_text(path, new_content)
    print(f"  [ok] {label} (plik podmieniony w calosci)")


def create_new_file_if_needed(path: Path, content: str, marker: str, label: str) -> None:
    if path.exists():
        existing = read_text(path)
        if marker in existing:
            print(f"  [pominieto] {label} (plik juz istnieje z oczekiwana zawartoscia)")
            return
        raise UpdaterError(
            f"{path}\n"
            f"  Plik juz istnieje, ale nie zawiera oczekiwanego markera v0.21.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie."
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    write_text(path, content)
    print(f"  [ok] {label} (nowy plik utworzony)")


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED (v0.20.3) i PO (v0.21) dla weeklySummaryScreen.js
# ---------------------------------------------------------------------------

WEEKLY_SUMMARY_SCREEN_OLD = r"""// weeklySummaryScreen.js
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
"""

WEEKLY_SUMMARY_SCREEN_NEW = r"""// weeklySummaryScreen.js
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
} from "../../systems/criticalEventSystem.js";

export function renderWeeklySummaryScreen(container) {
  const state = getState();

  // v0.19: oceń poprzednie wyzwanie (jeśli jego termin minął) i od razu
  // wygeneruj kolejne na nadchodzący tydzień, ZANIM zbudujemy podsumowanie
  // — dzięki temu sekcja "Aktualny stan" niżej pokazuje spoons już po
  // ewentualnej nagrodzie/karze. Obie funkcje są idempotentne (patrz
  // weeklyChallengeSystem.js), więc bezpieczne nawet przy wielokrotnym
  // renderze tego ekranu. NIE ZMIENIONE w v0.21.
  ensureWeeklyChallengeState(state);
  evaluateWeeklyChallenge(state);
  generateNextWeekChallenge(state);

  // v0.20: Monthly Critical Event Foundation. Ta sama idempotentna
  // logika co Weekly Stakes powyżej, ale z 28-dniowym cyklem i innymi
  // efektami (trust/frustration/current spoons, BEZ max spoons — patrz
  // criticalEventSystem.js). To DRUGI, niezależny system. NIE ZMIENIONE
  // w v0.21.
  ensureCriticalEventState(state);
  evaluateCriticalEvent(state);
  generateNextCriticalEvent(state);

  const summary = buildWeeklySummary(state);
  const challengeSummary = buildWeeklyChallengeSummary(state);
  const criticalSummary = buildCriticalEventSummary(state);

  const root = document.createElement("section");
  root.className = "oos-weekly-summary screen";

  root.appendChild(buildHeader(summary));

  const grid = document.createElement("main");
  grid.className = "oos-weekly-summary__grid";
  grid.appendChild(buildStoryCard(summary));
  grid.appendChild(buildStateCard(summary));
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

function buildStoryCard(summary) {
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

  return card;
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

function buildStateCard(summary) {
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

    // v0.20.1, Część B (przeniesione bez zmian): postęp miesięcznego
    // łuku, liczony lokalnie tutaj — nie wymaga zmian w
    // criticalEventSystem.js.
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
  return `Miesięczny łuk: dzień ${clampedDay} z ${total}`;
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
"""

# ---------------------------------------------------------------------------
# Zawartosc nowego pliku: css/weekly-summary-v0-21.css
# ---------------------------------------------------------------------------

WEEKLY_SUMMARY_CSS = r"""/* weekly-summary-v0-21.css
 *
 * v0.21: Weekly Summary / Monthly Arc UI Polish.
 *
 * Kompletnie osobny, izolowany plik od css/game-ui-v0-18.css — ten
 * ekran NIE jest częścią planszy gameplayowej (.oos-game grid zostaje
 * całkowicie nietknięty). Wszystko tu jest spięte przez namespace
 * ".oos-weekly-summary" i jego potomków. Jedyny wyjątek to celowo
 * SCOPED (nie globalny) override szerokości kontenera dla TEGO
 * konkretnego ekranu (patrz sekcja 0) — stary css/style.css ustawiał
 * wąski (640px) kontener myślany pod starą, listową wersję tego
 * ekranu; nowy układ kartowy potrzebuje więcej miejsca.
 *
 * Styl: ciepły parchment / paper board, cozy diary, visual novel RPG —
 * milestone screen, nie dashboard. Bazuje na tym samym kierunku
 * kolorystycznym co gameplay UI (v0.18), ale z WŁASNYM zestawem
 * zmiennych CSS, żeby ten plik był w pełni samodzielny.
 */

/* --------------------------------------------------------------------
   0. Kontener ekranu — scoped override szerokości TYLKO dla
   weeklySummary (stary css/style.css dawał tu wąskie 640px pod starą
   listową wersję ekranu).
   -------------------------------------------------------------------- */

body[data-game-screen="weeklySummary"] #app {
  max-width: 980px !important;
  padding: 28px 20px 64px !important;
}

/* --------------------------------------------------------------------
   1. .oos-weekly-summary — plansza + zmienne
   -------------------------------------------------------------------- */

.oos-weekly-summary {
  --ws-paper: #F7F1E4;
  --ws-panel: #FBF7EC;
  --ws-ink: #3E362C;
  --ws-muted: #8A7A67;
  --ws-line: #C8B48C;
  --ws-blue: #5D7B90;
  --ws-gold: #C08A3E;
  --ws-sage: #74915E;
  --ws-rose: #B5624F;
  --ws-shadow: rgba(62, 54, 44, 0.18);

  display: block;
  max-width: 900px;
  margin: 0 auto;
  padding: 0;
  color: var(--ws-ink);
  font-family: Georgia, "Times New Roman", serif;
}

.oos-weekly-summary * {
  box-sizing: border-box;
}

/* --------------------------------------------------------------------
   2. Header — "Podsumowanie tygodnia" / "Tydzień X zakończony" / dni
   -------------------------------------------------------------------- */

.oos-weekly-summary__header {
  text-align: center;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--ws-line);
}

.oos-weekly-summary__eyebrow {
  margin: 0 0 6px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ws-muted);
}

.oos-weekly-summary__title {
  margin: 0 0 8px;
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 700;
  line-height: 1.15;
}

.oos-weekly-summary__period {
  margin: 0;
  font-size: 15px;
  color: var(--ws-muted);
}

/* --------------------------------------------------------------------
   3. Grid kart
   -------------------------------------------------------------------- */

.oos-weekly-summary__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.oos-weekly-summary__card--story,
.oos-weekly-summary__card--critical-event {
  grid-column: 1 / -1;
}

@media (max-width: 700px) {
  .oos-weekly-summary__grid {
    grid-template-columns: 1fr;
  }
}

/* --------------------------------------------------------------------
   4. Karta — bazowy wygląd
   -------------------------------------------------------------------- */

.oos-weekly-summary__card {
  padding: 22px 24px;
  border-radius: 16px;
  border: 1px solid var(--ws-line);
  background:
    radial-gradient(circle at 92% 8%, rgba(192, 138, 62, 0.10), transparent 30%),
    linear-gradient(180deg, var(--ws-panel), var(--ws-paper));
  box-shadow: 0 8px 20px var(--ws-shadow);
}

.oos-weekly-summary__card-heading {
  margin: 0 0 14px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ws-blue);
}

/* --------------------------------------------------------------------
   5. Karta 1 — Wynik tygodnia (story) + effect chips
   -------------------------------------------------------------------- */

.oos-weekly-summary__story-text {
  margin: 0 0 18px;
  font-size: 18px;
  line-height: 1.5;
}

.oos-weekly-summary__effect-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.oos-weekly-summary__effect-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid rgba(62, 54, 44, 0.12);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13.5px;
  font-weight: 600;
}

.oos-weekly-summary__effect-chip-value {
  font-weight: 700;
}

.oos-weekly-summary__effect-chip--positive {
  background: #E4EFDD;
  color: #3E362C;
}

.oos-weekly-summary__effect-chip--positive .oos-weekly-summary__effect-chip-value {
  color: var(--ws-sage);
}

.oos-weekly-summary__effect-chip--negative {
  background: #F1DCD5;
  color: #3E362C;
}

.oos-weekly-summary__effect-chip--negative .oos-weekly-summary__effect-chip-value {
  color: var(--ws-rose);
}

.oos-weekly-summary__effect-chip--neutral {
  background: #EFE6D3;
  color: #3E362C;
}

.oos-weekly-summary__effect-chip--neutral .oos-weekly-summary__effect-chip-value {
  color: var(--ws-muted);
}

/* --------------------------------------------------------------------
   6. Karta 2 — Aktualny stan
   -------------------------------------------------------------------- */

.oos-weekly-summary__stat-lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oos-weekly-summary__stat-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(62, 54, 44, 0.1);
  font-size: 15px;
}

.oos-weekly-summary__stat-line:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.oos-weekly-summary__stat-line-label {
  color: var(--ws-muted);
}

.oos-weekly-summary__stat-line-value {
  font-weight: 700;
}

.oos-weekly-summary__mood-description {
  margin: 14px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--ws-line);
  font-size: 14px;
  font-style: italic;
  color: var(--ws-muted);
  line-height: 1.45;
}

/* --------------------------------------------------------------------
   7. Karty 3 + 4 — Stawka tygodnia / Wielki Test (result + upcoming)
   -------------------------------------------------------------------- */

.oos-weekly-summary__result {
  padding: 14px 16px;
  margin-bottom: 16px;
  border-radius: 12px;
  border-left: 4px solid var(--ws-sage);
  background: #EEF4EA;
}

.oos-weekly-summary__result--failure {
  border-left-color: var(--ws-rose);
  background: #F7EAE6;
}

.oos-weekly-summary__result-title {
  margin: 0 0 6px;
  font-size: 15.5px;
  font-weight: 700;
}

.oos-weekly-summary__result-detail {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--ws-ink);
}

.oos-weekly-summary__result-effect {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ws-muted);
}

.oos-weekly-summary__upcoming {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px dashed var(--ws-line);
  background: rgba(93, 123, 144, 0.06);
}

.oos-weekly-summary__upcoming-eyebrow {
  margin: 0 0 6px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ws-blue);
}

.oos-weekly-summary__upcoming-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
}

.oos-weekly-summary__upcoming-condition,
.oos-weekly-summary__upcoming-countdown,
.oos-weekly-summary__arc-progress {
  margin: 4px 0 0;
  font-size: 13.5px;
  color: var(--ws-muted);
}

.oos-weekly-summary__arc-progress {
  font-weight: 600;
  color: var(--ws-blue);
}

/* --------------------------------------------------------------------
   8. Footer / CTA — button zachowuje historyczną klasę "primary-button"
   (spójność z resztą gry), ale styl jest w pełni SCOPED do tego
   footera, nie globalny.
   -------------------------------------------------------------------- */

.oos-weekly-summary__footer {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

.oos-weekly-summary__footer .primary-button {
  min-height: 60px;
  padding: 14px 36px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(180deg, #9B6846, #6F442E);
  color: #F7F1E4;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 17px;
  font-weight: 700;
  box-shadow: 0 6px 0 rgba(74, 45, 31, 0.75), 0 12px 20px var(--ws-shadow);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.oos-weekly-summary__footer .primary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 0 rgba(74, 45, 31, 0.7), 0 16px 24px var(--ws-shadow);
}

@media (max-width: 700px) {
  .oos-weekly-summary__card {
    padding: 18px 18px;
  }
}
"""

WEEKLY_SUMMARY_CSS_MARKER = "v0.21: Weekly Summary / Monthly Arc UI Polish"


# ---------------------------------------------------------------------------
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        r"""export const GAME_VERSION = "v0.20.3";
export const GAME_VERSION_LABEL = "Out of Spoons v0.20.3";""",
        r"""export const GAME_VERSION = "v0.21";
export const GAME_VERSION_LABEL = "Out of Spoons v0.21";""",
        'GAME_VERSION -> v0.21',
    ),
]

INDEX_HTML_PATCHES = [
    (
        r"""  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="./css/game-ui-v0-18.css?v=180">
</head>""",
        r"""  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="./css/game-ui-v0-18.css?v=180">
  <link rel="stylesheet" href="./css/weekly-summary-v0-21.css?v=210">
</head>""",
        'index.html: dodanie weekly-summary-v0-21.css',
    ),
    (
        r"""  <script type="module" src="./js/main.js?v=203"></script>""",
        r"""  <script type="module" src="./js/main.js?v=210"></script>""",
        'cache-bust ?v=210 w index.html',
    ),
]


def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.21 (Weekly Summary / Monthly Arc UI Polish)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f'Podaj poprawna sciezke jako argument, np.:\n'
            f'  python apply_clean_v0_21_weekly_summary_arc_ui.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/ui/screens/weeklySummaryScreen.js",
        "js/systems/weeklySummarySystem.js",
        "js/systems/weeklyChallengeSystem.js",
        "js/systems/criticalEventSystem.js",
        "js/dev/devTools.js",
        "js/ui/oosLayout.js",
        "css/game-ui-v0-18.css",
        "css/style.css",
        "js/main.js",
        "js/data/versionData.js",
        "index.html",
    ]

    missing = [f for f in expected_files if not (project_root / f).exists()]
    if missing:
        raise UpdaterError(
            "Brakuje oczekiwanych plikow w projekcie:\n"
            + "\n".join(f"  - {f}" for f in missing)
            + "\n\nTo repo wyglada inaczej niz zakladal ten updater. Przerywam."
        )

    print("Sanity check OK - wszystkie oczekiwane pliki znalezione (w tym v0.18/v0.19/v0.20/v0.20.x).\n")

    print("1/3 js/ui/screens/weeklySummaryScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/weeklySummaryScreen.js", WEEKLY_SUMMARY_SCREEN_OLD, WEEKLY_SUMMARY_SCREEN_NEW, "weeklySummaryScreen.js -> nowy oos-weekly-summary namespace")
    print()

    print("2/3 css/weekly-summary-v0-21.css (nowy plik)")
    create_new_file_if_needed(
        project_root / "css/weekly-summary-v0-21.css",
        WEEKLY_SUMMARY_CSS,
        WEEKLY_SUMMARY_CSS_MARKER,
        "weekly-summary-v0-21.css -> nowy izolowany CSS",
    )
    print()

    print("3/3 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.21 (Weekly Summary / Monthly Arc UI Polish) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Badge pokazuje "Out of Spoons v0.21", index.html ma ?v=210 oraz
    laduje css/weekly-summary-v0-21.css?v=210.
 2. Zagraj do konca 1. tygodnia (dzien 7 -> weekly summary).
 3. Weekly Summary wyglada jak osobny milestone screen (cieply
    parchment, karty z cieniem), NIE jak techniczna lista.
 4. Karta "Jak minal tydzien" pokazuje summary.summaryText + chipsy
    efektow (Spoons/Zaufanie/Frustracja, opcjonalnie Przeciazenie).
 5. Frustracja +X ma czerwony chip, frustracja -X ma zielony chip
    (odwrotnie niz Spoons/Zaufanie).
 6. Karta "Aktualny stan" pokazuje spoons, zaufanie, frustracje, stan
    relacji i opis nastroju.
 7. Karta "Stawka tygodnia" pokazuje (po odpowiednim tygodniu) wynik
    poprzedniego wyzwania oraz nadchodzace wyzwanie z warunkiem i
    odliczaniem dni.
 8. Karta "Wielki Test" pokazuje wynik / horyzont / warunek (separator
    "*") / "Pozostalo: X dni" / "Miesieczny luk: dzien N z 28".
 9. Otworz konsole (F12): window.oosDev.showStateSummary() nadal
    dziala bez bledow.
10. Kliknij "Rozpocznij kolejny tydzien" - wraca do ekranu poranka,
    dzien sie NIE cofa ani nie resetuje (advanceToNextDay() juz sie
    wykonalo wczesniej w eveningScreen.js).
11. Sprawdz agende/event/evening - karty wyboru nadal NIE pokazuja
    przewidywanych efektow mechanicznych.
12. Gameplay layout .oos-game (poranek/agenda/event/reflection/wieczor)
    wyglada dokladnie tak samo jak wczesniej - zero zmian.
13. Wczytaj stary zapis (jesli masz) - nie crashuje.
14. Spoons nadal NIE resetuja sie do maksimum miedzy dniami.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)