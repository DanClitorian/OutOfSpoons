#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_20_2_devtools_null_state_guard.py

Hotfix dla Out of Spoons: v0.20.1 -> v0.20.2.

Problem:
  window.oosDev.showStateSummary() crashowało na main menu / przed
  rozpoczęciem lub wczytaniem gry, bo getState() zwracało null, a
  devTools.js od razu czytał state.partner.

Cel:
  Dev helpery mają być bezpieczne, jeśli nie ma aktywnego stanu gry.
  Zamiast TypeError mają wypisać czytelne ostrzeżenie do konsoli.

Zmienia:
  - js/dev/devTools.js
  - js/data/versionData.js
  - index.html

Nie zmienia gameplayu.
Nie zmienia layoutu.
Nie zmienia saveVersion.
"""

import sys
from pathlib import Path

DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"


class UpdaterError(Exception):
    pass


def read_text(path: Path, encoding: str = "utf-8") -> str:
    if not path.exists():
        raise UpdaterError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding=encoding)


def write_text(path: Path, content: str, encoding: str = "utf-8") -> None:
    path.write_text(content, encoding=encoding)


def apply_patches(path: Path, patches, encoding: str = "utf-8") -> None:
    content = read_text(path, encoding=encoding)
    changed = False

    for old, new, label in patches:
        if new in content:
            print(f"  [pominieto] {label} (juz zastosowano)")
            continue

        count = content.count(old)
        if count != 1:
            raise UpdaterError(
                f"{path}\n"
                f"  Patch '{label}' nie pasuje bezpiecznie. "
                f"Oczekiwano 1 wystapienia, znaleziono {count}."
            )

        content = content.replace(old, new, 1)
        changed = True
        print(f"  [ok] {label}")

    if changed:
        write_text(path, content, encoding=encoding)


DEVTOOLS_NEW = r"""// devTools.js
//
// v0.20.1: Critical Event Visibility + Testability.
// v0.20.2: null-state guard.
//
// DEV-ONLY helpery do testowania Weekly Stakes / Wielkiego Testu bez
// ręcznego przeklikiwania 7/28 dni. Ten moduł:
//   - NIE renderuje żadnego UI,
//   - NIE wywołuje się sam z siebie podczas normalnej gry,
//   - wystawia funkcje WYŁĄCZNIE pod window.oosDev.
//
// v0.20.2:
// getState() może zwrócić null, jeśli dev wywoła helper na main menu,
// przed Nową grą albo przed wczytaniem zapisu. Helpery nie mogą wtedy
// crashować. Zamiast tego wypisują czytelne ostrzeżenie.

import { getState } from "../state/gameState.js";
import { saveGame } from "../state/saveManager.js";
import { showScreen } from "../ui/uiManager.js";
import { getCurrentWeeklyChallenge } from "../systems/weeklyChallengeSystem.js";
import { getCurrentCriticalEvent } from "../systems/criticalEventSystem.js";

function requireActiveState(actionName) {
  const state = getState();

  if (!state) {
    console.warn(
      `[oosDev] Brak aktywnego stanu gry dla ${actionName}. ` +
      `Najpierw rozpocznij Nową grę albo wczytaj zapis, potem wywołaj helper ponownie.`
    );
    return null;
  }

  return state;
}

/**
 * Zwraca aktualny stan gry albo null, jeśli gra nie została jeszcze
 * rozpoczęta/wczytana.
 */
function safeGetState() {
  return getState();
}

/**
 * Ustawia state.day na wskazaną wartość. NIE resetuje spoons, NIE
 * zmienia partnera. Zapisuje stan. Celowo NIE przełącza automatycznie
 * ekranu.
 */
function jumpToDay(dayNumber) {
  const state = requireActiveState("jumpToDay()");
  if (!state) {
    return null;
  }

  const parsedDay = Number(dayNumber);
  if (!Number.isFinite(parsedDay) || parsedDay < 1) {
    console.warn("[oosDev] jumpToDay(dayNumber) wymaga liczby dnia >= 1.");
    return state;
  }

  state.day = Math.floor(parsedDay);
  saveGame(state);
  console.log(
    `[oosDev] state.day ustawiony na ${state.day}. ` +
    `Wywołaj window.oosDev.getState() żeby sprawdzić, albo przejdź na ekran poranka.`
  );
  return state;
}

/**
 * Przeskakuje do dnia TUŻ PO terminie aktywnego Wielkiego Testu
 * (dueDay + 1) i od razu pokazuje weekly summary.
 */
function jumpToCriticalDueDay() {
  const state = requireActiveState("jumpToCriticalDueDay()");
  if (!state) {
    return null;
  }

  const active = getCurrentCriticalEvent(state);

  if (!active) {
    console.warn(
      "[oosDev] Brak aktywnego Wielkiego Testu. " +
      "Wejdź najpierw na ekran poranka, żeby gra wygenerowała Wielki Test."
    );
    return state;
  }

  state.day = active.dueDay + 1;
  saveGame(state);
  showScreen("weeklySummary");
  console.log(
    `[oosDev] state.day ustawiony na ${state.day} ` +
    `(dueDay+1 aktywnego Wielkiego Testu "${active.title}"). Pokazano weekly summary.`
  );
  return state;
}

/**
 * Skraca termin aktywnego Wielkiego Testu do "wczoraj" (state.day - 1)
 * i od razu pokazuje weekly summary.
 */
function forceCriticalEventDue() {
  const state = requireActiveState("forceCriticalEventDue()");
  if (!state) {
    return null;
  }

  const active = getCurrentCriticalEvent(state);

  if (!active) {
    console.warn(
      "[oosDev] Brak aktywnego Wielkiego Testu. " +
      "Wejdź najpierw na ekran poranka, żeby gra wygenerowała Wielki Test."
    );
    return state;
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
 * Wypisuje do konsoli kompaktowe podsumowanie aktualnego stanu gry.
 * Jeśli nie ma aktywnej gry, nie crashuje — zwraca null i ostrzega.
 */
function showStateSummary() {
  const state = requireActiveState("showStateSummary()");
  if (!state) {
    return null;
  }

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
    getState: safeGetState,
    jumpToDay,
    jumpToCriticalDueDay,
    forceCriticalEventDue,
    showStateSummary
  };
}
"""


def main():
    project_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - hotfix v0.20.2 (devTools null-state guard)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(f"Katalog projektu nie istnieje: {project_root}")

    devtools = project_root / "js/dev/devTools.js"
    version = project_root / "js/data/versionData.js"
    index = project_root / "index.html"

    for path in [devtools, version, index]:
        if not path.exists():
            raise UpdaterError(f"Brakuje pliku: {path}")

    current_devtools = read_text(devtools)
    if "v0.20.2: null-state guard" in current_devtools:
        print("1/3 js/dev/devTools.js")
        print("  [pominieto] devTools.js (juz zastosowano)")
    elif "function showStateSummary()" not in current_devtools or "window.oosDev" not in current_devtools:
        raise UpdaterError(
            "js/dev/devTools.js nie wygląda jak wersja v0.20.1. "
            "Nie nadpisuję automatycznie."
        )
    else:
        print("1/3 js/dev/devTools.js")
        write_text(devtools, DEVTOOLS_NEW)
        print("  [ok] devTools.js -> null-state guard")
    print()

    print("2/3 js/data/versionData.js")
    apply_patches(version, [
        (
            'export const GAME_VERSION = "v0.20.1";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.20.1";',
            'export const GAME_VERSION = "v0.20.2";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.20.2";',
            "GAME_VERSION -> v0.20.2",
        )
    ])
    print()

    print("3/3 index.html")
    apply_patches(index, [
        (
            '  <script type="module" src="./js/main.js?v=201"></script>',
            '  <script type="module" src="./js/main.js?v=202"></script>',
            "cache-bust ?v=202",
        )
    ], encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.20.2 zaaplikowane.")
    print("=" * 70)
    print("""
TEST:
 1. Ctrl+C, py -m http.server 8000, Ctrl+F5.
 2. Na main menu odpal w konsoli:
      window.oosDev.showStateSummary()
    Oczekiwane: ostrzeżenie, NIE TypeError.
 3. Zacznij Nową grę albo Kontynuuj, wejdź na poranek.
 4. Odpal:
      window.oosDev.showStateSummary()
    Oczekiwane: console.table ze stanem.
 5. Odpal:
      window.oosDev.forceCriticalEventDue()
    Oczekiwane: weekly summary z oceną Wielkiego Testu.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)
