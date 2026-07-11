#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_20_monthly_critical_event_foundation.py

Updater dla Out of Spoons: v0.19.1 -> v0.20 (Monthly Critical Event /
Wielki Test Foundation).

BAZA: repo faktycznie na v0.19.1 w momencie przygotowania tego
updatera (potwierdzone: badge "Out of Spoons v0.19.1", index.html
"?v=191", commit "Polish choices and expand weekly stakes v0.19.1").
Wszystkie "OLD" stale ponizej zostaly wziete bezposrednio z realnego
stanu repo (git show HEAD) w momencie przygotowania tego skryptu.

TO NIE JEST LAYOUT RESET. Grid .oos-game, oosLayout.js, css/game-ui-v0-18.css
NIE sa ruszane. Ekrany event/evening/reflection/agenda TEZ nie sa
ruszane (spec explicite tego zakazuje). To wylacznie nowy system
gameplayowy + 2 male, tekstowe dopiski UI.

Co robi:

  - NOWY plik js/systems/criticalEventSystem.js: "Wielki Test" -
    drugi, DLUZSZY horyzont napiecia obok Weekly Stakes
    (weeklyChallengeSystem.js z v0.19). Architektura jest CELOWO
    bliznacza (ten sam wzorzec: pula szablonow, idempotentna ocena po
    dueDay, generowanie kolejnego po ocenie) - ale to DWA ROZNE,
    NIEZALEZNE systemy w osobnych polach stanu:

      state.weeklyChallenge  - 7-dniowy cykl, reward/penalty:
                                +1 max spoons (cap 14) / -2 current spoons
      state.criticalEvent    - 28-dniowy cykl, successEffect/failureEffect:
                                zmiana trust/frustration/current spoons
                                (BEZ max spoons - to zastrzezone dla
                                Weekly Stakes, zgodnie ze specyfikacja)

    Pula: 6 Wielkich Testow (Wizyta rodziny, Deadline projektu, Wspolny
    wyjazd, Przeprowadzka, Publiczne wydarzenie, Rozmowa o przyszlosci),
    kazdy z wielowymiarowym warunkiem (2-3 statystyki), successText i
    failureText w tonie cieplym-ale-nie-cukierkowym.

  - IDEMPOTENCJA: evaluateCriticalEvent() sprawdza
    criticalState.lastEvaluatedDueDay przed zastosowaniem efektu -
    jesli wydarzenie dla danego dueDay bylo juz ocenione, funkcja
    zwraca zapamietany wynik i NIC nie zmienia w stanie. Potwierdzone
    testem podwojnego renderu weekly summary DOKLADNIE na granicy
    dnia 28.

  - Efekty CLAMPOWANE: trust/frustration 0-100, spoons 0-max (max
    odczytywany w momencie ewaluacji, wiec respektuje ewentualne
    podwyzszenie max spoons przez Weekly Stakes).

  - js/ui/screens/gameScreen.js: Wielki Test generuje sie JUZ NA
    PIERWSZYM renderze poranka (w przeciwienstwie do Weekly Stakes,
    ktore czekaja na pierwszy weekly summary) - i od razu zapisuje
    stan. Narracja poranka dostaje TRZECIE zdanie-teaser ("Na
    horyzoncie: ... za X dni.") obok istniejacego drugiego zdania
    Weekly Stakes - wciaz jeden element DOM, zero zmian layoutu.
    Agenda NIE dostaje monthly teasera (spec explicite tego zakazuje,
    zeby jej nie przeladowac).

  - js/ui/screens/weeklySummaryScreen.js: nowa sekcja "Wielki Test" po
    istniejacej sekcji "Stawka tygodnia", zbudowana z ISTNIEJACYCH klas
    CSS (.weekly-summary-panel / .weekly-summary-heading /
    .weekly-challenge-result / .weekly-challenge-upcoming) - zero
    nowego CSS.

  - Podbija wersje w js/data/versionData.js do v0.20 i cache-bust w
    index.html do ?v=200.

Nie zmienia saveVersion. Nie zmienia css/game-ui-v0-18.css, js/ui/oosLayout.js,
js/ui/screens/agendaScreen.js, js/ui/screens/eventScreen.js,
js/ui/screens/eveningScreen.js, js/ui/screens/reflectionScreen.js,
js/systems/weeklyChallengeSystem.js, state/gameState.js,
state/saveManager.js, dayCycle.js, dayAgendaSystem.js,
weeklySummarySystem.js, eventData.js, eveningRecoverySystem.js.

Skrypt jest idempotentny: mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane, a nie duplikowane/nadpisywane ponownie.

WAZNE dla pelnych podmian plikow: poniewaz gameScreen.js i
weeklySummaryScreen.js sa PODMIENIANE W CALOSCI (nie male fragmenty),
ten updater wymaga, zeby zawartosc plikow w repo dokladnie odpowiadala
stanowi v0.19.1 sprzed patcha. Jesli plik lokalnie rozni sie (np. reczna
edycja nieopublikowana jeszcze na GitHubie), updater PRZERWIE dzialanie
z jasnym komunikatem zamiast zgadywac lub nadpisywac cos po cichu.

Uzycie:
    python apply_clean_v0_20_monthly_critical_event_foundation.py

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
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.19.1 sprzed\n"
            f"  patcha, ani stanowi v0.20 po patchu. Plik mogl zostac\n"
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
            f"  Plik juz istnieje, ale nie zawiera oczekiwanego markera v0.20.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie."
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    write_text(path, content)
    print(f"  [ok] {label} (nowy plik utworzony)")


# ---------------------------------------------------------------------------
# Zawartosc nowego pliku: js/systems/criticalEventSystem.js
# ---------------------------------------------------------------------------

CRITICAL_EVENT_SYSTEM_JS = r"""// criticalEventSystem.js
//
// v0.20: Monthly Critical Event / Wielki Test Foundation.
//
// Drugi, dłuższy horyzont napięcia obok Weekly Stakes
// (weeklyChallengeSystem.js): zamiast 7-dniowego cyklu, tu jest
// 28-dniowy "miesięczny" cykl z jednym dużym wydarzeniem na horyzoncie.
// Architektura jest CELOWO bliźniacza do weeklyChallengeSystem.js
// (te same wzorce: pula szablonów, idempotentna ocena po dueDay,
// generowanie kolejnego po ocenie) — to dwa RÓŻNE systemy, przechowywane
// w osobnych polach stanu (state.weeklyChallenge vs state.criticalEvent)
// i NIE dzielą efektów mechanicznych:
//
//   Weekly Stakes:    +1 max spoons (cap 14) / -2 current spoons
//   Critical Events:  zmiana trust / frustration / current spoons
//                      (BEZ max spoons — to zastrzeżone dla Weekly Stakes)
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w
// state.criticalEvent. Ekrany (weeklySummaryScreen.js, gameScreen.js)
// czytają z niego dane do wyświetlenia.

// --------------------------------------------------------------------
// Pula Wielkich Testów
// --------------------------------------------------------------------

const CRITICAL_EVENT_POOL = [
  {
    id: "family_visit",
    title: "Wizyta rodziny",
    description: "Za kilka tygodni trzeba będzie utrzymać spokój w sytuacji pełnej niewypowiedzianych oczekiwań.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 60 },
        { stat: "frustration", operator: "<=", value: 45 },
        { stat: "spoons", operator: ">=", value: 4 }
      ]
    },
    successText: "Nie było idealnie. Ale nie musiało być. Przeszliście przez to bez rozsadzania relacji od środka.",
    failureText: "Pytania rodziny zostały bez odpowiedzi, a milczenie zamieniło się w osobny temat do przegadania później."
  },
  {
    id: "work_deadline",
    title: "Deadline projektu",
    description: "Duży projekt w pracy zbliża się do finału i będzie chciał więcej, niż macie do oddania.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "frustration", operator: "<=", value: 50 }
      ]
    },
    successText: "Projekt poszedł, zanim zdążył się zamienić w katastrofę. Zmęczenie zostaje, ale bez wyrzutów sumienia.",
    failureText: "To nie był koniec świata. Bardziej rachunek z odsetkami, który przechodzi na kolejny miesiąc."
  },
  {
    id: "trip_together",
    title: "Wspólny wyjazd",
    description: "Zaplanowany wyjazd wymaga więcej niż wolnego czasu — wymaga bliskości, którą trzeba było odkładać przez cały miesiąc.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 65 },
        { stat: "spoons", operator: ">=", value: 5 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    },
    successText: "Wyjazd nie naprawił wszystkiego, ale dał wam coś, czego brakowało od tygodni: wspólny czas bez agendy.",
    failureText: "Wyjazd był, ale bliskości w nim zabrakło — wróciliście do domu bardziej zmęczeni niż wypoczęci."
  },
  {
    id: "moving_house",
    title: "Przeprowadzka",
    description: "Pakowanie całego życia do pudeł to test na cierpliwość, logistykę i to, ile jeszcze macie w sobie.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "trust", operator: ">=", value: 50 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    },
    successText: "Pudła się skończyły, a wy wciąż ze sobą rozmawiacie — to już jest coś.",
    failureText: "Przeprowadzka pochłonęła więcej z was, niż planowaliście oddać. Mieszkanie jest nowe, napięcie stare."
  },
  {
    id: "public_event",
    title: "Publiczne wydarzenie",
    description: "Trzeba będzie wyjść na duże wydarzenie towarzyskie i przez cały wieczór trzymać formę.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "frustration", operator: "<=", value: 50 },
        { stat: "trust", operator: ">=", value: 45 }
      ]
    },
    successText: "Udało się przejść przez wieczór bez zdejmowania maski w niewłaściwym momencie.",
    failureText: "Maska pękła gdzieś między trzecim toastem a niewygodnym pytaniem. Nikt tego nie nazwał, ale wszyscy poczuli."
  },
  {
    id: "future_conversation",
    title: "Rozmowa o przyszłości",
    description: "Temat, który odkładaliście z tygodnia na tydzień, w końcu domaga się rozmowy na głos.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 70 },
        { stat: "frustration", operator: "<=", value: 50 }
      ]
    },
    successText: "Rozmowa, której się baliście, okazała się mniej groźna niż tygodnie jej unikania.",
    failureText: "Temat wrócił, zawisł w powietrzu, i znowu nikt nie powiedział tego na głos."
  }
];

// v0.20: efekty są WSPÓLNE dla wszystkich wydarzeń w puli (tak jak
// reward/penalty w weeklyChallengeSystem.js) — łatwe do zbalansowania
// później per-wydarzenie, jeśli okaże się to potrzebne.
const SUCCESS_EFFECT = { trustChange: 8, frustrationChange: -6, spoonsChange: 2 };
const FAILURE_EFFECT = { trustChange: -8, frustrationChange: 8, spoonsChange: -3 };

const STAT_LABELS = {
  trust: "Zaufanie",
  frustration: "Frustracja",
  spoons: "Spoons"
};

const OPERATOR_SYMBOLS = {
  ">=": "≥",
  "<=": "≤",
  ">": ">",
  "<": "<",
  "==": "="
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.criticalEvent istnieje. Bezpieczne dla starych
 * zapisów (sprzed v0.20) — jeśli pole nie istnieje, tworzy je od zera,
 * nie nadpisuje istniejącego aktywnego wydarzenia. Naprawia brakującą
 * history, jeśli zapis jest stary/niepełny.
 */
export function ensureCriticalEventState(state) {
  if (!state.criticalEvent) {
    state.criticalEvent = {
      active: null,
      lastResult: null,
      lastEvaluatedDueDay: null,
      history: []
    };
  }

  if (!Array.isArray(state.criticalEvent.history)) {
    state.criticalEvent.history = [];
  }

  return state.criticalEvent;
}

/**
 * Generuje Wielki Test na nadchodzące 28 dni, jeśli nie ma już
 * aktywnego. Unika (jeśli to możliwe) powtórzenia id ostatnio
 * ocenionego wydarzenia. dueDay = arcStartDay + 27 (28-dniowy cykl,
 * licząc dzień startu włącznie — jeśli wygeneruje się dnia 1, test
 * wypada dnia 28, dokładnie jak w specyfikacji).
 */
export function generateNextCriticalEvent(state) {
  const criticalState = ensureCriticalEventState(state);

  if (criticalState.active) {
    return criticalState.active;
  }

  const arcStartDay = state.day;
  const dueDay = arcStartDay + 27;

  const previousId = criticalState.lastResult ? criticalState.lastResult.id : null;
  const candidates = previousId
    ? CRITICAL_EVENT_POOL.filter((template) => template.id !== previousId)
    : CRITICAL_EVENT_POOL;
  const pool = candidates.length > 0 ? candidates : CRITICAL_EVENT_POOL;

  const template = pool[Math.floor(Math.random() * pool.length)];

  const event = {
    id: template.id,
    title: template.title,
    description: template.description,
    arcStartDay,
    dueDay,
    condition: template.condition,
    successText: template.successText,
    failureText: template.failureText,
    successEffect: SUCCESS_EFFECT,
    failureEffect: FAILURE_EFFECT,
    status: "active"
  };

  criticalState.active = event;
  return event;
}

/**
 * Ocenia aktywny Wielki Test, jeśli jego dueDay już minął (dueDay <=
 * ukończony dzień = state.day - 1, dokładnie jak w
 * weeklyChallengeSystem.js). Stosuje successEffect albo failureEffect,
 * zapisuje wynik do lastResult/history.
 *
 * IDEMPOTENTNE: jeśli wydarzenie dla danego dueDay zostało już ocenione
 * (criticalState.lastEvaluatedDueDay === event.dueDay), zwraca
 * zapamiętany wynik i NIC nie zmienia w stanie — bezpieczne przy
 * wielokrotnym renderze weekly summary.
 *
 * Zwraca null, jeśli nie ma aktywnego wydarzenia albo jeszcze nie minął
 * jego termin (np. pierwsze 27 dni gry).
 */
export function evaluateCriticalEvent(state) {
  const criticalState = ensureCriticalEventState(state);
  const event = criticalState.active;

  if (!event) {
    return null;
  }

  const completedDay = state.day - 1;
  if (event.dueDay > completedDay) {
    return null;
  }

  if (criticalState.lastEvaluatedDueDay === event.dueDay) {
    return criticalState.lastResult;
  }

  const success = checkEventSuccess(event, state);
  const effect = success ? event.successEffect : event.failureEffect;

  applyEffect(state, effect);

  event.status = success ? "success" : "failed";

  const result = {
    id: event.id,
    title: event.title,
    dueDay: event.dueDay,
    success,
    text: success ? event.successText : event.failureText,
    effect
  };

  criticalState.lastResult = result;
  criticalState.history.push(result);
  criticalState.lastEvaluatedDueDay = event.dueDay;
  criticalState.active = null;

  return result;
}

function checkEventSuccess(event, state) {
  const requirements = (event.condition && event.condition.requirements) || [];
  const context = buildEvaluationContext(state);
  return requirements.every((requirement) => checkRequirement(requirement, context));
}

function checkRequirement(requirement, context) {
  const actual = context[requirement.stat];

  switch (requirement.operator) {
    case ">=":
      return actual >= requirement.value;
    case "<=":
      return actual <= requirement.value;
    case ">":
      return actual > requirement.value;
    case "<":
      return actual < requirement.value;
    case "==":
      return actual === requirement.value;
    default:
      return false;
  }
}

function buildEvaluationContext(state) {
  const npc = getPartnerNpc(state);

  return {
    spoons: state.resources.spoons.current,
    trust: npc ? npc.trust : 0,
    frustration: npc ? npc.frustration : 0
  };
}

/**
 * Aplikuje efekt (successEffect albo failureEffect) do istniejących
 * zasobów: aktualnych spoons (clamp 0..max — NIE max spoons, to
 * zastrzeżone dla Weekly Stakes) oraz trust/frustration partnera
 * (clamp 0..100).
 */
function applyEffect(state, effect) {
  if (!effect) {
    return;
  }

  if (typeof effect.spoonsChange === "number") {
    const spoons = state.resources.spoons;
    spoons.current = clamp(spoons.current + effect.spoonsChange, 0, spoons.max);
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    if (typeof effect.trustChange === "number") {
      npc.trust = clamp(npc.trust + effect.trustChange, 0, 100);
    }

    if (typeof effect.frustrationChange === "number") {
      npc.frustration = clamp(npc.frustration + effect.frustrationChange, 0, 100);
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

// --------------------------------------------------------------------
// Odczyt / prezentacja
// --------------------------------------------------------------------

/**
 * Zwraca aktualnie aktywny Wielki Test (albo null, jeśli nie ma
 * żadnego — praktycznie nie powinno się zdarzyć po v0.20, bo
 * gameScreen.js generuje pierwszy już na starcie gry).
 */
export function getCurrentCriticalEvent(state) {
  const criticalState = ensureCriticalEventState(state);
  return criticalState.active;
}

/**
 * Zwraca liczbę dni pozostałych do terminu aktywnego Wielkiego Testu,
 * licząc INKLUZYWNIE — tak samo jak getWeeklyChallengeCountdown() w
 * weeklyChallengeSystem.js (świeżo wygenerowany test na 28 dni pokazuje
 * "Pozostało: 28 dni", nie 27).
 */
export function getCriticalEventCountdown(state) {
  const event = getCurrentCriticalEvent(state);

  if (!event) {
    return null;
  }

  return Math.max(0, event.dueDay - state.day + 1);
}

/**
 * Zamienia warunek Wielkiego Testu na czytelny tekst, np.
 * "Zaufanie ≥ 65 i Spoons ≥ 5 i Frustracja ≤ 55".
 */
export function formatCriticalEventCondition(event) {
  if (!event || !event.condition || !Array.isArray(event.condition.requirements)) {
    return "";
  }

  return event.condition.requirements
    .map((requirement) => formatRequirement(requirement))
    .join(" i ");
}

function formatRequirement(requirement) {
  const label = STAT_LABELS[requirement.stat] || requirement.stat;
  const symbol = OPERATOR_SYMBOLS[requirement.operator] || requirement.operator;
  return `${label} ${symbol} ${requirement.value}`;
}

/**
 * Buduje gotowy do wyświetlenia zestaw danych dla weekly summary:
 * wynik ostatnio ocenionego Wielkiego Testu (jeśli jest) + nadchodzące
 * wydarzenie wraz z sformatowanym warunkiem i odliczaniem dni.
 */
export function buildCriticalEventSummary(state) {
  const criticalState = ensureCriticalEventState(state);
  const upcoming = criticalState.active;

  return {
    lastResult: criticalState.lastResult,
    upcoming,
    upcomingConditionText: upcoming ? formatCriticalEventCondition(upcoming) : "",
    upcomingDaysLeft: upcoming ? getCriticalEventCountdown(state) : null
  };
}
"""

CRITICAL_EVENT_SYSTEM_MARKER = "v0.20: Monthly Critical Event"


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED (v0.19.1) i PO (v0.20) dla podmienianych plikow
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
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createCtaButton
} from "../oosLayout.js";

export function renderGameScreen(container) {
  const state = getState();

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
function buildMorningNarrative(state) {
  const base = "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.";

  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return base;
  }

  const daysLeft = getWeeklyChallengeCountdown(state);
  const dayWord = daysLeft === 1 ? "dzień" : "dni";

  return `${base} Stawka tygodnia: ${challenge.title} za ${daysLeft} ${dayWord}.`;
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


# ---------------------------------------------------------------------------
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        r"""export const GAME_VERSION = "v0.19.1";
export const GAME_VERSION_LABEL = "Out of Spoons v0.19.1";""",
        r"""export const GAME_VERSION = "v0.20";
export const GAME_VERSION_LABEL = "Out of Spoons v0.20";""",
        'GAME_VERSION -> v0.20',
    ),
]

INDEX_HTML_PATCHES = [
    (
        r"""  <script type="module" src="./js/main.js?v=191"></script>""",
        r"""  <script type="module" src="./js/main.js?v=200"></script>""",
        'cache-bust ?v=200 w index.html',
    ),
]


def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.20 (Monthly Critical Event Foundation)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f'Podaj poprawna sciezke jako argument, np.:\n'
            f'  python apply_clean_v0_20_monthly_critical_event_foundation.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/systems/weeklyChallengeSystem.js",
        "js/ui/screens/weeklySummaryScreen.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/agendaScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/eveningScreen.js",
        "js/ui/oosLayout.js",
        "css/game-ui-v0-18.css",
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

    print("Sanity check OK - wszystkie oczekiwane pliki znalezione (w tym v0.18/v0.19/v0.19.1).\n")

    print("1/4 js/systems/criticalEventSystem.js (nowy plik)")
    create_new_file_if_needed(
        project_root / "js/systems/criticalEventSystem.js",
        CRITICAL_EVENT_SYSTEM_JS,
        CRITICAL_EVENT_SYSTEM_MARKER,
        "criticalEventSystem.js -> nowy system Wielkiego Testu",
    )
    print()

    print("2/4 js/ui/screens/gameScreen.js (pelna podmiana - generacja + teaser)")
    replace_whole_file(project_root / "js/ui/screens/gameScreen.js", GAME_SCREEN_OLD, GAME_SCREEN_NEW, "gameScreen.js -> Wielki Test na pierwszym poranku")
    print()

    print("3/4 js/ui/screens/weeklySummaryScreen.js (pelna podmiana - sekcja Wielki Test)")
    replace_whole_file(project_root / "js/ui/screens/weeklySummaryScreen.js", WEEKLY_SUMMARY_SCREEN_OLD, WEEKLY_SUMMARY_SCREEN_NEW, "weeklySummaryScreen.js -> ocena i sekcja Wielkiego Testu")
    print()

    print("4/4 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.20 (Monthly Critical Event Foundation) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Badge pokazuje "Out of Spoons v0.20", index.html ma ?v=200.
 2. Stary zapis (jesli masz) bez state.criticalEvent nie crashuje.
 3. Zacznij nowa gre - juz na PIERWSZYM poranku narracja pokazuje
    "Na horyzoncie: [tytul] za 28 dni." (Weekly Stakes jeszcze nie ma,
    to normalne - pojawi sie dopiero po 1. weekly summary).
 4. Agenda NIE pokazuje monthly teasera (tylko ewentualny Weekly
    Stakes teaser, jesli juz istnieje).
 5. Po kazdym weekly summary (dzien 7, 14, 21...) widac sekcje
    "Wielki Test" - ale bez wyniku, dopoki nie minie dzien 28.
 6. Po dniu 28: sekcja "Wielki Test" pokazuje "Wielki Test zaliczony:
    ..." albo "Wielki Test niezaliczony: ...", z tekstem narracyjnym i
    "Efekt: Zaufanie +/-X, Frustracja +/-X, Spoons +/-X".
 7. Sprawdz w karcie relacji / topbarze, ze zaufanie i frustracja
    faktycznie sie zmienily po ocenie, a spoons NIE przekroczyly max
    (i nie zeszly ponizej 0).
 8. Odswiez / wroc na weekly summary po dniu 28 (np. showScreen w
    konsoli, albo po prostu sprawdz w kolejnej turze) - efekt NIE
    aplikuje sie drugi raz.
 9. Po ocenie generuje sie kolejny Wielki Test (dueDay + 28 dni).
10. Weekly Stakes dalej dzialaja normalnie i NIEZALEZNIE (osobna
    historia, osobne dueDay, osobne efekty - +1 max spoons / -2
    current spoons, bez zadnego wplywu na Wielki Test i odwrotnie).
11. v0.19.1 polish wyborow dalej dziala (brak przewidywanych efektow
    na kartach agendy/eventu/wieczoru).
12. Layout v0.18/v0.19/v0.19.1 (.oos-game, karta postaci, karta
    relacji) wyglada dokladnie tak samo jak wczesniej.
13. Flow dnia dziala jak wczesniej, nie wrocil podwojny HUD, spoons
    nadal nie resetuja sie do maksimum miedzy dniami.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)