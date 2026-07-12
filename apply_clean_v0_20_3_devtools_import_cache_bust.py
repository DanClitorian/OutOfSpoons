#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_20_3_devtools_import_cache_bust.py

Hotfix dla Out of Spoons: v0.20.2 -> v0.20.3.

Problem:
  Po v0.20.2 devTools.js miał null-state guard, ale main.js importował go
  jako "./dev/devTools.js" bez query stringa. Browser mógł nadal używać
  starego zcache'owanego modułu ES, przez co window.oosDev.forceCriticalEventDue()
  nadal crashowało na main menu.

Cel:
  - upewnić się, że js/dev/devTools.js zawiera null-state guard,
  - zmienić import w js/main.js na ./dev/devTools.js?v=203,
  - podbić wersję do v0.20.3,
  - podbić index cache do main.js?v=203.

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


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if new in content:
        print(f"  [pominieto] {label} (juz zastosowano)")
        return content

    count = content.count(old)
    if count != 1:
        raise UpdaterError(
            f"Patch '{label}' nie pasuje bezpiecznie. "
            f"Oczekiwano 1 wystapienia, znaleziono {count}."
        )

    print(f"  [ok] {label}")
    return content.replace(old, new, 1)


DEVTOOLS_NEW = r"""// devTools.js
//
// v0.20.1: Critical Event Visibility + Testability.
// v0.20.2/v0.20.3: null-state guard + cache-busted import.
//
// DEV-ONLY helpery do testowania Weekly Stakes / Wielkiego Testu bez
// ręcznego przeklikiwania 7/28 dni. Ten moduł:
//   - NIE renderuje żadnego UI,
//   - NIE wywołuje się sam z siebie podczas normalnej gry,
//   - wystawia funkcje WYŁĄCZNIE pod window.oosDev.
//
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

function safeGetState() {
  return getState();
}

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

    print("Out of Spoons - hotfix v0.20.3 (devTools import cache bust)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(f"Katalog projektu nie istnieje: {project_root}")

    devtools = project_root / "js/dev/devTools.js"
    main_js = project_root / "js/main.js"
    version = project_root / "js/data/versionData.js"
    index = project_root / "index.html"

    for path in [devtools, main_js, version, index]:
        if not path.exists():
            raise UpdaterError(f"Brakuje pliku: {path}")

    print("1/4 js/dev/devTools.js")
    current_devtools = read_text(devtools)
    if "v0.20.2/v0.20.3: null-state guard + cache-busted import" in current_devtools:
        print("  [pominieto] devTools.js (juz zastosowano)")
    else:
        if "window.oosDev" not in current_devtools:
            raise UpdaterError("devTools.js nie wygląda jak oczekiwany plik dev tools.")
        write_text(devtools, DEVTOOLS_NEW)
        print("  [ok] devTools.js -> null-state guard")
    print()

    print("2/4 js/main.js")
    main_content = read_text(main_js)
    main_content = replace_once(
        main_content,
        'import "./dev/devTools.js";',
        'import "./dev/devTools.js?v=203";',
        "cache-bust importu devTools.js -> ?v=203",
    )
    # jeśli ktoś wcześniej ręcznie dodał ?v=202
    main_content = main_content.replace('import "./dev/devTools.js?v=202";', 'import "./dev/devTools.js?v=203";')
    write_text(main_js, main_content)
    print()

    print("3/4 js/data/versionData.js")
    version_content = read_text(version)
    if 'GAME_VERSION = "v0.20.3"' in version_content:
        print("  [pominieto] GAME_VERSION -> v0.20.3 (juz zastosowano)")
    elif 'GAME_VERSION = "v0.20.2"' in version_content:
        version_content = version_content.replace(
            'export const GAME_VERSION = "v0.20.2";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.20.2";',
            'export const GAME_VERSION = "v0.20.3";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.20.3";'
        )
        write_text(version, version_content)
        print("  [ok] GAME_VERSION -> v0.20.3")
    elif 'GAME_VERSION = "v0.20.1"' in version_content:
        version_content = version_content.replace(
            'export const GAME_VERSION = "v0.20.1";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.20.1";',
            'export const GAME_VERSION = "v0.20.3";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.20.3";'
        )
        write_text(version, version_content)
        print("  [ok] GAME_VERSION -> v0.20.3 (z v0.20.1)")
    else:
        raise UpdaterError("versionData.js nie ma oczekiwanej wersji v0.20.1/v0.20.2.")
    print()

    print("4/4 index.html")
    index_content = read_text(index, encoding="utf-8-sig")
    if 'main.js?v=203' in index_content:
        print("  [pominieto] cache-bust ?v=203 (juz zastosowano)")
    elif 'main.js?v=202' in index_content:
        index_content = index_content.replace('main.js?v=202', 'main.js?v=203')
        write_text(index, index_content, encoding="utf-8-sig")
        print("  [ok] cache-bust ?v=203")
    elif 'main.js?v=201' in index_content:
        index_content = index_content.replace('main.js?v=201', 'main.js?v=203')
        write_text(index, index_content, encoding="utf-8-sig")
        print("  [ok] cache-bust ?v=203 (z ?v=201)")
    else:
        raise UpdaterError("index.html nie ma oczekiwanego main.js?v=201/v=202.")
    print()

    print("=" * 70)
    print("Gotowe. v0.20.3 zaaplikowane.")
    print("=" * 70)
    print("""
TEST:
 1. Restart serwera i twardy refresh:
      Ctrl+C
      py -m http.server 8000
      Ctrl+F5

 2. W konsoli na main menu:
      window.oosDev.showStateSummary()
      window.oosDev.forceCriticalEventDue()

    Oczekiwane: ostrzeżenia [oosDev], NIE TypeError.

 3. Zacznij Nową grę / Kontynuuj, wejdź na poranek.

 4. W konsoli:
      window.oosDev.showStateSummary()
      window.oosDev.forceCriticalEventDue()

    Oczekiwane: tabela stanu i weekly summary z oceną Wielkiego Testu.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)
