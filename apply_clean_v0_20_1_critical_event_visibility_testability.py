#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_20_1_critical_event_visibility_testability.py

Updater dla Out of Spoons: v0.20 -> v0.20.1 (Critical Event Visibility
+ Testability).

BAZA: repo faktycznie na v0.20 w momencie przygotowania tego updatera
(potwierdzone: badge "Out of Spoons v0.20", index.html "?v=200",
commit "Add monthly critical event foundation v0.20"). Wszystkie "OLD"
stale ponizej zostaly wziete bezposrednio z realnego stanu repo (git
show HEAD) w momencie przygotowania tego skryptu.

TO NIE JEST LAYOUT RESET. Grid .oos-game, oosLayout.js,
css/game-ui-v0-18.css NIE sa ruszane. Ekrany agenda/event/evening/
reflection TEZ nie sa ruszane. To wylacznie: (A) krotszy teaser
porankowy, (B) postep miesiecznego luku w weekly summary, (C) DEV-only
fast-forward helpery, (D) kompaktowy separator warunku w jednym miejscu.

Co robi:

  CZESC A - krotszy morning teaser:
    js/ui/screens/gameScreen.js#buildMorningNarrative przepisany tak,
    zeby przy AKTYWNYM Weekly Stake i/albo Wielkim Tescie uzywac
    krotkiej formy "Dzis: plan dnia. Stawka: ... Wielki Test: ...",
    zamiast pelnego zdania "Nowy dzien sie zaczyna..." + dwoch
    dlugich teaserow. Pelne zdanie zostaje TYLKO gdy zaden system nie
    istnieje jeszcze (w praktyce bardzo krotki moment, bo Wielki Test
    generuje sie juz na pierwszym renderze poranka).

  CZESC B - postep miesiecznego luku:
    js/ui/screens/weeklySummaryScreen.js#renderUpcomingCriticalEvent
    dostaje nowa linie "Miesieczny luk: dzien X z 28", liczona LOKALNIE
    w tym pliku (arcStartDay, dueDay z eventu + state.day) - NIE
    wymagalo to zadnej zmiany w criticalEventSystem.js. Czysty tekst,
    bez paska CSS, bez nowego layoutu.

  CZESC C - DEV-only fast-forward helpery:
    NOWY plik js/dev/devTools.js podpina window.oosDev = { getState,
    jumpToDay, jumpToCriticalDueDay, forceCriticalEventDue,
    showStateSummary } - wylacznie do recznego wywolania z konsoli
    przegladarki. Sam import (dodany do js/main.js) NIC nie robi poza
    podpieciem tych funkcji - zero automatycznego gameplayu, zero UI.

  CZESC D - kompaktowy separator warunku:
    W weeklySummaryScreen.js#renderUpcomingCriticalEvent tekst warunku
    Wielkiego Testu dostaje .replace(/ i /g, " \u00b7 ") TYLKO w tym
    miejscu - formatCriticalEventCondition() w criticalEventSystem.js i
    Weekly Stakes nadal uzywaja pelnego " i ".

  Podbija wersje w js/data/versionData.js do v0.20.1 i cache-bust w
  index.html do ?v=201.

Nie zmienia saveVersion. Nie zmienia css/game-ui-v0-18.css,
js/ui/oosLayout.js, js/ui/screens/agendaScreen.js,
js/ui/screens/eventScreen.js, js/ui/screens/eveningScreen.js,
js/ui/screens/reflectionScreen.js, js/systems/weeklyChallengeSystem.js,
js/systems/criticalEventSystem.js, state/gameState.js,
state/saveManager.js, dayCycle.js, dayAgendaSystem.js, eventData.js,
eveningRecoverySystem.js.

Skrypt jest idempotentny: mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane, a nie duplikowane/nadpisywane ponownie.

WAZNE dla pelnych podmian plikow: poniewaz gameScreen.js,
weeklySummaryScreen.js i main.js sa PODMIENIANE W CALOSCI (nie male
fragmenty), ten updater wymaga, zeby zawartosc plikow w repo dokladnie
odpowiadala stanowi v0.20 sprzed patcha. Jesli plik lokalnie rozni sie
(np. reczna edycja nieopublikowana jeszcze na GitHubie), updater
PRZERWIE dzialanie z jasnym komunikatem zamiast zgadywac lub
nadpisywac cos po cichu.

Uzycie:
    python apply_clean_v0_20_1_critical_event_visibility_testability.py

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
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.20 sprzed\n"
            f"  patcha, ani stanowi v0.20.1 po patchu. Plik mogl zostac\n"
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
            f"  Plik juz istnieje, ale nie zawiera oczekiwanego markera v0.20.1.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie."
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    write_text(path, content)
    print(f"  [ok] {label} (nowy plik utworzony)")


# ---------------------------------------------------------------------------
# Zawartosc nowego pliku: js/dev/devTools.js
# ---------------------------------------------------------------------------

DEV_TOOLS_JS = r"""// devTools.js
//
// v0.20.1: Critical Event Visibility + Testability.
//
// DEV-ONLY helpery do testowania Weekly Stakes / Wielkiego Testu bez
// ręcznego przeklikiwania 7/28 dni. Ten moduł:
//   - NIE renderuje żadnego UI,
//   - NIE wywołuje się sam z siebie podczas normalnej gry (import
//     samego pliku tylko PODPINA window.oosDev — nic więcej się nie
//     dzieje, dopóki dev ręcznie nie wywoła którejś funkcji z konsoli),
//   - wystawia funkcje WYŁĄCZNIE pod window.oosDev.
//
// Bezpieczny do zaimportowania zawsze (nawet w środowiskach bez
// window, np. przyszłe testy Node) — sprawdza typeof window przed
// podpięciem czegokolwiek.
//
// Przykład użycia z konsoli przeglądarki:
//   window.oosDev.showStateSummary()
//   window.oosDev.forceCriticalEventDue()
//   window.oosDev.jumpToCriticalDueDay()

import { getState } from "../state/gameState.js";
import { saveGame } from "../state/saveManager.js";
import { showScreen } from "../ui/uiManager.js";
import { getCurrentWeeklyChallenge } from "../systems/weeklyChallengeSystem.js";
import { getCurrentCriticalEvent } from "../systems/criticalEventSystem.js";

/**
 * Ustawia state.day na wskazaną wartość. NIE resetuje spoons, NIE
 * zmienia partnera. Zapisuje stan. Celowo NIE przełącza automatycznie
 * ekranu — dev może chcieć sprawdzić stan z dowolnego innego miejsca
 * bez przeładowania widoku. Żeby zobaczyć efekt na poranku, wywołaj
 * ręcznie showScreen("game") (dostępne w konsoli przez uiManager, albo
 * po prostu odśwież grę).
 */
function jumpToDay(dayNumber) {
  const state = getState();
  state.day = dayNumber;
  saveGame(state);
  console.log(
    `[oosDev] state.day ustawiony na ${dayNumber}. Wywołaj window.oosDev.getState() żeby sprawdzić, ` +
    `albo przejdź na ekran poranka, żeby zobaczyć efekt.`
  );
  return state;
}

/**
 * Przeskakuje do dnia TUŻ PO terminie aktywnego Wielkiego Testu
 * (dueDay + 1) i od razu pokazuje weekly summary, żeby natychmiast
 * zobaczyć ocenę.
 */
function jumpToCriticalDueDay() {
  const state = getState();
  const active = getCurrentCriticalEvent(state);

  if (!active) {
    console.warn("[oosDev] Brak aktywnego Wielkiego Testu — nie ma do czego skakać.");
    return null;
  }

  state.day = active.dueDay + 1;
  saveGame(state);
  showScreen("weeklySummary");
  console.log(
    `[oosDev] state.day ustawiony na ${state.day} (dueDay+1 aktywnego Wielkiego Testu "${active.title}"). ` +
    `Pokazano weekly summary.`
  );
  return state;
}

/**
 * Skraca termin aktywnego Wielkiego Testu do "wczoraj" (state.day - 1)
 * i od razu pokazuje weekly summary — ocenia go NATYCHMIAST, bez
 * przesuwania kalendarza o wiele dni do przodu. Najszybszy sposób na
 * przetestowanie sukcesu/porażki przy aktualnych statystykach gracza.
 */
function forceCriticalEventDue() {
  const state = getState();
  const active = getCurrentCriticalEvent(state);

  if (!active) {
    console.warn("[oosDev] Brak aktywnego Wielkiego Testu — nie ma czego wymusić.");
    return null;
  }

  active.dueDay = state.day - 1;
  saveGame(state);
  showScreen("weeklySummary");
  console.log(
    `[oosDev] dueDay Wielkiego Testu "${active.title}" ustawiony na ${active.dueDay} (wczoraj). ` +
    `Pokazano weekly summary.`
  );
  return state;
}

/**
 * Wypisuje do konsoli (console.table) kompaktowe podsumowanie
 * aktualnego stanu gry: dzień, spoons, trust/frustration partnera,
 * aktywny Weekly Stake, aktywny Wielki Test, ostatni wynik Wielkiego
 * Testu.
 */
function showStateSummary() {
  const state = getState();
  const npc = state.partner && state.npcs ? state.npcs[state.partner.id] : null;
  const weeklyChallenge = getCurrentWeeklyChallenge(state);
  const criticalEvent = getCurrentCriticalEvent(state);
  const lastCriticalResult = state.criticalEvent ? state.criticalEvent.lastResult : null;

  const summary = {
    day: state.day,
    spoons: state.resources ? `${state.resources.spoons.current}/${state.resources.spoons.max}` : "brak danych",
    partnerTrust: npc ? npc.trust : "brak partnera",
    partnerFrustration: npc ? npc.frustration : "brak partnera",
    activeWeeklyChallenge: weeklyChallenge ? `${weeklyChallenge.title} (dueDay ${weeklyChallenge.dueDay})` : "brak",
    activeCriticalEvent: criticalEvent ? `${criticalEvent.title} (dueDay ${criticalEvent.dueDay})` : "brak",
    lastCriticalResult: lastCriticalResult
      ? `${lastCriticalResult.success ? "sukces" : "porażka"}: ${lastCriticalResult.title}`
      : "brak"
  };

  console.table(summary);
  return summary;
}

if (typeof window !== "undefined") {
  window.oosDev = {
    getState,
    jumpToDay,
    jumpToCriticalDueDay,
    forceCriticalEventDue,
    showStateSummary
  };
}
"""

DEV_TOOLS_MARKER = "v0.20.1: Critical Event Visibility"


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED (v0.20) i PO (v0.20.1) dla podmienianych plikow
# ---------------------------------------------------------------------------

GAME_SCREEN_OLD = r"""// gameScreen.js
//
// Morning screen.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Żadnej zależności od
// starych klas .vn-*.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { ensureDailyAgenda } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureWeeklyChallengeState,
  getCurrentWeeklyChallenge,
  getWeeklyChallengeCountdown
} from "../../systems/weeklyChallengeSystem.js";
import {
  ensureCriticalEventState,
  generateNextCriticalEvent,
  getCurrentCriticalEvent,
  getCriticalEventCountdown
} from "../../systems/criticalEventSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createCtaButton
} from "../oosLayout.js";

export function renderGameScreen(container) {
  const state = getState();

  // v0.20: Monthly Critical Event Foundation. Wielki Test ma istnieć od
  // pierwszego możliwego renderu poranka (w przeciwieństwie do Weekly
  // Stakes, które generują się dopiero po pierwszym weekly summary) —
  // jeśli go jeszcze nie ma, generujemy go tutaj i od razu zapisujemy.
  ensureCriticalEventState(state);
  if (!getCurrentCriticalEvent(state)) {
    generateNextCriticalEvent(state);
    saveGame(state);
  }

  const topbar = createTopBar(state, "game");
  const sidebar = createSidebar(state, "game");

  const scene = createScenePanel({
    modifier: "morning",
    title: `Dzień ${state.day}`
  });

  const narrative = createNarrativeStrip(buildMorningNarrative(state));

  const cta = createCtaButton("Otwórz plan dnia", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });

  const shell = createGameShell({
    screenClass: "morning",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [cta],
    actionsVariant: "single"
  });

  container.appendChild(shell);
}

// v0.19: Weekly Stakes. Krótki teaser aktywnego wyzwania dopisany jako
// DRUGIE zdanie do tego samego akapitu narracji — celowo bez nowych
// elementów DOM ani zmian w oosLayout.js/CSS (layout v0.18 zostaje
// nietknięty).
//
// v0.20: Monthly Critical Event Foundation. Analogiczny teaser dla
// Wielkiego Testu dopisany jako TRZECIE zdanie w tym samym akapicie —
// wciąż jeden element DOM, wciąż bez zmian w layoucie/CSS. Podczas
// pierwszego tygodnia gry (dni 1-7) Weekly Stakes jeszcze nie istnieją
// (generują się dopiero po pierwszym weekly summary), więc naturalnie
// widać tylko teaser Wielkiego Testu — od 2. tygodnia widać oba.
function buildMorningNarrative(state) {
  const base = "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.";

  const parts = [base, buildWeeklyStakeTeaser(state), buildCriticalEventTeaser(state)].filter(Boolean);
  return parts.join(" ");
}

function buildWeeklyStakeTeaser(state) {
  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return null;
  }

  const daysLeft = getWeeklyChallengeCountdown(state);
  const dayWord = daysLeft === 1 ? "dzień" : "dni";

  return `Stawka tygodnia: ${challenge.title} za ${daysLeft} ${dayWord}.`;
}

function buildCriticalEventTeaser(state) {
  ensureCriticalEventState(state);
  const event = getCurrentCriticalEvent(state);

  if (!event) {
    return null;
  }

  const daysLeft = getCriticalEventCountdown(state);
  const dayWord = daysLeft === 1 ? "dzień" : "dni";

  return `Na horyzoncie: ${event.title} za ${daysLeft} ${dayWord}.`;
}
"""

GAME_SCREEN_NEW = r"""// gameScreen.js
//
// Morning screen.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Żadnej zależności od
// starych klas .vn-*.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { ensureDailyAgenda } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureWeeklyChallengeState,
  getCurrentWeeklyChallenge,
  getWeeklyChallengeCountdown
} from "../../systems/weeklyChallengeSystem.js";
import {
  ensureCriticalEventState,
  generateNextCriticalEvent,
  getCurrentCriticalEvent,
  getCriticalEventCountdown
} from "../../systems/criticalEventSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createCtaButton
} from "../oosLayout.js";

export function renderGameScreen(container) {
  const state = getState();

  // v0.20: Monthly Critical Event Foundation. Wielki Test ma istnieć od
  // pierwszego możliwego renderu poranka (w przeciwieństwie do Weekly
  // Stakes, które generują się dopiero po pierwszym weekly summary) —
  // jeśli go jeszcze nie ma, generujemy go tutaj i od razu zapisujemy.
  ensureCriticalEventState(state);
  if (!getCurrentCriticalEvent(state)) {
    generateNextCriticalEvent(state);
    saveGame(state);
  }

  const topbar = createTopBar(state, "game");
  const sidebar = createSidebar(state, "game");

  const scene = createScenePanel({
    modifier: "morning",
    title: `Dzień ${state.day}`
  });

  const narrative = createNarrativeStrip(buildMorningNarrative(state));

  const cta = createCtaButton("Otwórz plan dnia", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });

  const shell = createGameShell({
    screenClass: "morning",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [cta],
    actionsVariant: "single"
  });

  container.appendChild(shell);
}

// v0.19: Weekly Stakes. Krótki teaser aktywnego wyzwania dopisany jako
// DRUGIE zdanie do tego samego akapitu narracji — celowo bez nowych
// elementów DOM ani zmian w oosLayout.js/CSS (layout v0.18 zostaje
// nietknięty).
//
// v0.20: Monthly Critical Event Foundation. Analogiczny teaser dla
// Wielkiego Testu dopisany jako TRZECIE zdanie w tym samym akapicie.
//
// v0.20.1: Critical Event Visibility + Testability. Pełne zdanie
// "Nowy dzień się zaczyna..." + dwa teasery robiło się zbyt długie i
// ryzykowało ellipsis w wąskim pasku narracji. Gdy istnieje choć jeden
// aktywny system (Weekly Stake i/lub Wielki Test), narracja przechodzi
// na krótszą formę "Dziś: plan dnia. ...". Pełne, "opisowe" zdanie
// zostaje TYLKO wtedy, gdy żaden system jeszcze nie istnieje (pierwszy
// możliwy moment w grze — w praktyce ułamek sekundy, bo Wielki Test
// generuje się już na tym samym renderze, ale zostawiamy to jako
// bezpieczny fallback).
function buildMorningNarrative(state) {
  const weeklyTeaser = buildWeeklyStakeTeaser(state);
  const criticalTeaser = buildCriticalEventTeaser(state);

  if (!weeklyTeaser && !criticalTeaser) {
    return "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.";
  }

  const parts = ["Dziś: plan dnia.", weeklyTeaser, criticalTeaser].filter(Boolean);
  return parts.join(" ");
}

function buildWeeklyStakeTeaser(state) {
  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return null;
  }

  const daysLeft = getWeeklyChallengeCountdown(state);
  return `Stawka: ${challenge.title} za ${daysLeft} ${dayWord(daysLeft)}.`;
}

function buildCriticalEventTeaser(state) {
  ensureCriticalEventState(state);
  const event = getCurrentCriticalEvent(state);

  if (!event) {
    return null;
  }

  const daysLeft = getCriticalEventCountdown(state);
  return `Wielki Test: ${event.title} za ${daysLeft} ${dayWord(daysLeft)}.`;
}

function dayWord(daysLeft) {
  return daysLeft === 1 ? "dzień" : "dni";
}
"""

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
    panel.appendChild(renderUpcomingCriticalEvent(eventSummary));
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

function renderUpcomingCriticalEvent(eventSummary) {
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-challenge-upcoming";

  const heading = document.createElement("p");
  heading.textContent = "Na horyzoncie";
  wrapper.appendChild(heading);

  const title = document.createElement("p");
  title.textContent = eventSummary.upcoming.title;
  wrapper.appendChild(title);

  const condition = document.createElement("p");
  condition.textContent = `Warunek: ${eventSummary.upcomingConditionText}`;
  wrapper.appendChild(condition);

  const countdown = document.createElement("p");
  countdown.textContent = `Pozostało: ${eventSummary.upcomingDaysLeft} dni`;
  wrapper.appendChild(countdown);

  return wrapper;
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

MAIN_JS_OLD = r"""﻿// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).

import { initUI, showScreen } from "./ui/uiManager.js";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
"""

MAIN_JS_NEW = r"""﻿// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).

import { initUI, showScreen } from "./ui/uiManager.js";
// v0.20.1: DEV-only helpery (window.oosDev) do testowania Weekly Stakes /
// Wielkiego Testu bez ręcznego przeklikiwania 7/28 dni. Sam import nic
// nie robi poza podpięciem funkcji pod window.oosDev — nic nie zmienia
// w normalnym gameplayu, dopóki nie zostanie ręcznie wywołane z konsoli.
import "./dev/devTools.js";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
"""


# ---------------------------------------------------------------------------
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        r"""export const GAME_VERSION = "v0.20";
export const GAME_VERSION_LABEL = "Out of Spoons v0.20";""",
        r"""export const GAME_VERSION = "v0.20.1";
export const GAME_VERSION_LABEL = "Out of Spoons v0.20.1";""",
        'GAME_VERSION -> v0.20.1',
    ),
]

INDEX_HTML_PATCHES = [
    (
        r"""  <script type="module" src="./js/main.js?v=200"></script>""",
        r"""  <script type="module" src="./js/main.js?v=201"></script>""",
        'cache-bust ?v=201 w index.html',
    ),
]


def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.20.1 (Critical Event Visibility + Testability)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f'Podaj poprawna sciezke jako argument, np.:\n'
            f'  python apply_clean_v0_20_1_critical_event_visibility_testability.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/systems/criticalEventSystem.js",
        "js/systems/weeklyChallengeSystem.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/weeklySummaryScreen.js",
        "js/ui/screens/agendaScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/eveningScreen.js",
        "js/ui/oosLayout.js",
        "css/game-ui-v0-18.css",
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

    print("Sanity check OK - wszystkie oczekiwane pliki znalezione (w tym v0.18/v0.19/v0.20).\n")

    print("1/5 js/dev/devTools.js (nowy plik)")
    create_new_file_if_needed(
        project_root / "js/dev/devTools.js",
        DEV_TOOLS_JS,
        DEV_TOOLS_MARKER,
        "devTools.js -> window.oosDev fast-forward helpery",
    )
    print()

    print("2/5 js/ui/screens/gameScreen.js (pelna podmiana - krotszy teaser)")
    replace_whole_file(project_root / "js/ui/screens/gameScreen.js", GAME_SCREEN_OLD, GAME_SCREEN_NEW, "gameScreen.js -> krotsza narracja poranka")
    print()

    print("3/5 js/ui/screens/weeklySummaryScreen.js (pelna podmiana - postep luku)")
    replace_whole_file(project_root / "js/ui/screens/weeklySummaryScreen.js", WEEKLY_SUMMARY_SCREEN_OLD, WEEKLY_SUMMARY_SCREEN_NEW, "weeklySummaryScreen.js -> postep miesiecznego luku + separator")
    print()

    print("4/5 js/main.js (pelna podmiana - import devTools.js)")
    replace_whole_file(project_root / "js/main.js", MAIN_JS_OLD, MAIN_JS_NEW, "main.js -> import devTools.js")
    print()

    print("5/5 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.20.1 (Critical Event Visibility + Testability) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Badge pokazuje "Out of Spoons v0.20.1", index.html ma ?v=201.
 2. Morning narrative jest krotsza, gdy istnieje aktywny system:
      "Dzis: plan dnia. Wielki Test: [tytul] za X dni."
    albo (gdy oba systemy aktywne):
      "Dzis: plan dnia. Stawka: [tytul] za X dni. Wielki Test: [tytul] za Y dni."
 3. Agenda nadal NIE ma monthly teasera.
 4. Otworz konsole przegladarki (F12) i sprawdz:
      window.oosDev
    - powinien byc obiektem z 5 funkcjami.
 5. window.oosDev.showStateSummary() - wypisuje tabele ze stanem gry.
 6. window.oosDev.forceCriticalEventDue() - natychmiast przenosi do
    weekly summary i pokazuje ocene aktywnego Wielkiego Testu (bez
    przewijania kalendarza).
 7. window.oosDev.jumpToCriticalDueDay() - ustawia dzien na dueDay+1
    aktywnego Wielkiego Testu i pokazuje weekly summary.
 8. window.oosDev.jumpToDay(50) - zmienia tylko state.day, spoons i
    partner zostaja bez zmian.
 9. W weekly summary, sekcja "Wielki Test" pokazuje teraz dodatkowo
    linie "Miesieczny luk: dzien X z 28" pod "Pozostalo: Y dni".
10. Warunek Wielkiego Testu w weekly summary uzywa "*" (np. "Zaufanie
    >= 65 * Spoons >= 5"), a Weekly Stakes nadal uzywa " i ".
11. Karty wyborow (agenda/event/evening) nadal NIE pokazuja
    przewidywanych efektow mechanicznych (v0.19.1 nietkniete).
12. Layout v0.18/v0.19/v0.20 (.oos-game, karta postaci, karta relacji)
    wyglada dokladnie tak samo jak wczesniej.
13. Dev helpery NIC nie robia same z siebie podczas normalnej gry -
    zero widocznego UI, zero automatycznych zmian stanu.
14. Spoons nadal NIE resetuja sie do maksimum miedzy dniami.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)