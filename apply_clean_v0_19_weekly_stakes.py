#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_19_weekly_stakes.py

Updater dla Out of Spoons: v0.18 -> v0.19 (Weekly Stakes / Stawka
Tygodnia).

BAZA: repo faktycznie na v0.18 w momencie przygotowania tego updatera
(potwierdzone: badge "Out of Spoons v0.18", index.html "?v=180",
commit "Reset gameplay UI layout v0.18"). Wszystkie "OLD" stale
ponizej zostaly wziete bezposrednio z realnego stanu repo (git show
HEAD) w momencie przygotowania tego skryptu.

TO JEST TICKET GAMEPLAY, NIE UI. Layout v0.18 (js/ui/oosLayout.js,
css/game-ui-v0-18.css, namespace .oos-*) NIE jest ruszany w ogole -
ten updater go nawet nie dotyka. Zadnych nowych klas CSS, zadnego
nowego pliku CSS, zadnej zmiany w .oos-game.

Co robi:

  - NOWY plik js/systems/weeklyChallengeSystem.js: system "Stawki
    Tygodnia" zbudowany na istniejacych spoons (BEZ osobnego zasobu
    fatigue - ten system zostal wczesniej odrzucony na rzecz
    persistent spoons i nie wraca). Co tydzien przypisywane jest jedno
    z 6 wyzwan z warunkiem sukcesu (zaufanie / frustracja / spoons).
    Sukces: +1 do max spoons (cap 14). Porazka: -2 do current spoons
    (nie ponizej 0).

  - state.weeklyChallenge = { active, lastResult, lastEvaluatedDueDay,
    history } - lazy-init przez ensureWeeklyChallengeState(), bezpieczne
    dla starych zapisow sprzed v0.19 (brak pola nie crashuje, saveVersion
    NIE jest zmieniany).

  - IDEMPOTENCJA: evaluateWeeklyChallenge() sprawdza
    weeklyState.lastEvaluatedDueDay przed zastosowaniem nagrody/kary -
    jesli wyzwanie dla danego dueDay bylo juz ocenione, funkcja zwraca
    zapamietany wynik i NIC nie zmienia w stanie. To jest krytyczne przy
    wielokrotnym renderze weekly summary (potwierdzone testem podwojnego
    renderu w tym samym stanie - patrz komentarze w kodzie).

  - js/ui/screens/weeklySummaryScreen.js: dodana sekcja "Stawka
    tygodnia" (wynik poprzedniego wyzwania + podglad nadchodzacego),
    zbudowana z ISTNIEJACYCH klas CSS (.weekly-summary-panel /
    .weekly-summary-heading) - zero nowego CSS.

  - js/ui/screens/gameScreen.js i js/ui/screens/agendaScreen.js:
    krotki tekstowy teaser aktywnego wyzwania dopisany jako DRUGIE
    zdanie do istniejacego akapitu narracji (ten sam element DOM,
    ta sama funkcja createNarrativeStrip()) - zero nowych elementow
    DOM, zero zmian layoutu.

  - Podbija wersje w js/data/versionData.js do v0.19 i cache-bust w
    index.html do ?v=190.

Nie zmienia saveVersion. Nie zmienia eventData.js, dayCycle.js,
dayAgendaSystem.js, eveningRecoverySystem.js, weeklySummarySystem.js,
saveManager.js. Nie zmienia js/ui/oosLayout.js ani css/game-ui-v0-18.css
ani css/style.css. Nie zmienia js/ui/screens/eventScreen.js ani
js/ui/screens/eveningScreen.js (spec nie prosil o teaser na tych
ekranach).

Skrypt jest idempotentny (mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane), co jest odrebna sprawa od
idempotencji SAMEGO SYSTEMU GAMEPLAYOWEGO opisanej wyzej.

WAZNE dla pelnych podmian plikow: poniewaz gameScreen.js, agendaScreen.js
i weeklySummaryScreen.js sa PODMIENIANE W CALOSCI (nie male fragmenty),
ten updater wymaga, zeby zawartosc plikow w repo dokladnie odpowiadala
stanowi v0.18 sprzed patcha. Jesli plik lokalnie rozni sie (np. reczna
edycja nieopublikowana jeszcze na GitHubie), updater PRZERWIE dzialanie
z jasnym komunikatem zamiast zgadywac lub nadpisywac cos po cichu.

Uzycie:
    python apply_clean_v0_19_weekly_stakes.py

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
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.18 sprzed\n"
            f"  patcha, ani stanowi v0.19 po patchu. Plik mogl zostac\n"
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
            f"  Plik juz istnieje, ale nie zawiera oczekiwanego markera v0.19.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie."
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    write_text(path, content)
    print(f"  [ok] {label} (nowy plik utworzony)")


# ---------------------------------------------------------------------------
# Zawartosc nowego pliku: js/systems/weeklyChallengeSystem.js
# ---------------------------------------------------------------------------

WEEKLY_CHALLENGE_SYSTEM_JS = r"""// weeklyChallengeSystem.js
//
// v0.19: Weekly Stakes / Stawka Tygodnia.
//
// Lekka mechanika tygodniowej presji zbudowana na istniejących spoons —
// CELOWO bez osobnego zasobu "fatigue" (ten system był wcześniej
// odrzucony na rzecz persistent spoons i nie wraca tutaj).
//
// Na każdy tydzień gry przypisane jest jedno wyzwanie (challenge) z
// warunkiem sukcesu opartym o zaufanie / frustrację / spoons. Na
// weekly summary wyzwanie jest oceniane:
//   - sukces  -> +1 do maksymalnych spoons (cap 14),
//   - porażka -> -2 do aktualnych spoons (nie poniżej 0),
// a zaraz potem generowane jest nowe wyzwanie na kolejny tydzień.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem wyzwania w
// state.weeklyChallenge. Ekrany (weeklySummaryScreen.js, gameScreen.js,
// agendaScreen.js) czytają z niego dane do wyświetlenia.

// --------------------------------------------------------------------
// Pula wyzwań
// --------------------------------------------------------------------

const CHALLENGE_POOL = [
  {
    id: "family_visit",
    title: "Wizyta rodziny",
    description: "Za kilka dni trzeba będzie utrzymać spokój w sytuacji pełnej niewypowiedzianych oczekiwań.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 60 },
        { stat: "frustration", operator: "<=", value: 45 }
      ]
    }
  },
  {
    id: "work_deadline",
    title: "Deadline w pracy",
    description: "Nadchodzi tydzień, w którym praca nie zostawi wiele miejsca na odpoczynek.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 5 }
      ]
    }
  },
  {
    id: "trip_together",
    title: "Wspólny wyjazd",
    description: "Zaplanowany wyjazd wymaga i bliskości, i energii, żeby dobrze go przejść.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 65 },
        { stat: "spoons", operator: ">=", value: 4 }
      ]
    }
  },
  {
    id: "hard_conversation",
    title: "Trudna rozmowa",
    description: "Coś, co odkładaliście, w końcu będzie trzeba powiedzieć na głos.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 50 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    }
  },
  {
    id: "stabilization_week",
    title: "Tydzień stabilizacji",
    description: "Nic dramatycznego się nie dzieje — pytanie, czy uda się to utrzymać.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "frustration", operator: "<=", value: 50 }
      ]
    }
  },
  {
    id: "logistics_crisis",
    title: "Kryzys logistyczny",
    description: "Coś się posypie organizacyjnie i trzeba będzie to ogarnąć bez zapasu sił.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 4 },
        { stat: "trust", operator: ">=", value: 45 }
      ]
    }
  }
];

const REWARD = { type: "max_spoons", amount: 1, cap: 14 };
const PENALTY = { type: "spoons_current", amount: -2 };

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
 * Upewnia się, że state.weeklyChallenge istnieje. Bezpieczne dla
 * starych zapisów (sprzed v0.19) — jeśli pole nie istnieje, tworzy je
 * od zera, nie nadpisuje istniejącego wyzwania.
 */
export function ensureWeeklyChallengeState(state) {
  if (!state.weeklyChallenge) {
    state.weeklyChallenge = {
      active: null,
      lastResult: null,
      lastEvaluatedDueDay: null,
      history: []
    };
  }

  if (!Array.isArray(state.weeklyChallenge.history)) {
    state.weeklyChallenge.history = [];
  }

  return state.weeklyChallenge;
}

/**
 * Generuje wyzwanie na nadchodzący tydzień, jeśli nie ma już aktywnego.
 * Unika (jeśli to możliwe) powtórzenia id ostatnio ocenionego wyzwania.
 * dueDay = koniec nadchodzącego tygodnia (7 dni licząc od aktualnego
 * dnia włącznie).
 */
export function generateNextWeekChallenge(state) {
  const weeklyState = ensureWeeklyChallengeState(state);

  if (weeklyState.active) {
    return weeklyState.active;
  }

  const weekStartDay = state.day;
  const dueDay = weekStartDay + 6;

  const previousId = weeklyState.lastResult ? weeklyState.lastResult.id : null;
  const candidates = previousId
    ? CHALLENGE_POOL.filter((template) => template.id !== previousId)
    : CHALLENGE_POOL;
  const pool = candidates.length > 0 ? candidates : CHALLENGE_POOL;

  const template = pool[Math.floor(Math.random() * pool.length)];

  const challenge = {
    id: template.id,
    title: template.title,
    description: template.description,
    weekStartDay,
    dueDay,
    condition: template.condition,
    reward: REWARD,
    penalty: PENALTY,
    status: "active"
  };

  weeklyState.active = challenge;
  return challenge;
}

/**
 * Ocenia aktywne wyzwanie, jeśli jego dueDay już minął (dueDay <=
 * ukończony dzień = state.day - 1, bo dzień jest już zaawansowany w
 * momencie renderowania weekly summary). Stosuje nagrodę albo karę,
 * zapisuje wynik do lastResult/history.
 *
 * IDEMPOTENTNE: jeśli wyzwanie dla danego dueDay zostało już ocenione
 * (weeklyState.lastEvaluatedDueDay === challenge.dueDay), zwraca
 * zapamiętany wynik i NIC nie zmienia w stanie — bezpieczne przy
 * wielokrotnym renderze weekly summary.
 *
 * Zwraca null, jeśli nie ma aktywnego wyzwania albo jeszcze nie minął
 * jego termin (np. pierwszy tydzień gry).
 */
export function evaluateWeeklyChallenge(state) {
  const weeklyState = ensureWeeklyChallengeState(state);
  const challenge = weeklyState.active;

  if (!challenge) {
    return null;
  }

  const completedDay = state.day - 1;
  if (challenge.dueDay > completedDay) {
    return null;
  }

  if (weeklyState.lastEvaluatedDueDay === challenge.dueDay) {
    return weeklyState.lastResult;
  }

  const success = checkChallengeSuccess(challenge, state);

  if (success) {
    applyReward(state, challenge.reward);
  } else {
    applyPenalty(state, challenge.penalty);
  }

  challenge.status = success ? "success" : "failed";

  const result = {
    id: challenge.id,
    title: challenge.title,
    dueDay: challenge.dueDay,
    success,
    reward: challenge.reward,
    penalty: challenge.penalty
  };

  weeklyState.lastResult = result;
  weeklyState.history.push(result);
  weeklyState.lastEvaluatedDueDay = challenge.dueDay;
  weeklyState.active = null;

  return result;
}

function checkChallengeSuccess(challenge, state) {
  const requirements = (challenge.condition && challenge.condition.requirements) || [];
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

function applyReward(state, reward) {
  if (!reward || reward.type !== "max_spoons") {
    return;
  }

  const cap = typeof reward.cap === "number" ? reward.cap : 14;
  const amount = typeof reward.amount === "number" ? reward.amount : 1;
  const spoons = state.resources.spoons;

  spoons.max = Math.min(spoons.max + amount, cap);
  spoons.current = Math.min(spoons.current + amount, spoons.max);
}

function applyPenalty(state, penalty) {
  if (!penalty || penalty.type !== "spoons_current") {
    return;
  }

  const amount = typeof penalty.amount === "number" ? penalty.amount : -2;
  const spoons = state.resources.spoons;

  spoons.current = Math.max(0, spoons.current + amount);
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
 * Zwraca aktualnie aktywne wyzwanie (albo null, jeśli nie ma żadnego —
 * np. przed pierwszym weekly summary).
 */
export function getCurrentWeeklyChallenge(state) {
  const weeklyState = ensureWeeklyChallengeState(state);
  return weeklyState.active;
}

/**
 * Zwraca liczbę dni pozostałych do terminu aktywnego wyzwania,
 * licząc INKLUZYWNIE (dzień wygenerowania + dzień terminu też się
 * liczą) — dzięki temu świeżo wygenerowane wyzwanie na 7-dniowy
 * tydzień pokazuje "Pozostało: 7 dni", nie 6.
 */
export function getWeeklyChallengeCountdown(state) {
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return null;
  }

  return Math.max(0, challenge.dueDay - state.day + 1);
}

/**
 * Zamienia warunek wyzwania na czytelny tekst, np.
 * "Zaufanie ≥ 60 i Frustracja ≤ 45".
 */
export function formatWeeklyChallengeCondition(challenge) {
  if (!challenge || !challenge.condition || !Array.isArray(challenge.condition.requirements)) {
    return "";
  }

  return challenge.condition.requirements
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
 * wynik ostatnio ocenionego wyzwania (jeśli jest) + nadchodzące
 * wyzwanie wraz z sformatowanym warunkiem i odliczaniem dni.
 */
export function buildWeeklyChallengeSummary(state) {
  const weeklyState = ensureWeeklyChallengeState(state);
  const upcoming = weeklyState.active;

  return {
    lastResult: weeklyState.lastResult,
    upcoming,
    upcomingConditionText: upcoming ? formatWeeklyChallengeCondition(upcoming) : "",
    upcomingDaysLeft: upcoming ? getWeeklyChallengeCountdown(state) : null
  };
}
"""

WEEKLY_CHALLENGE_SYSTEM_MARKER = "v0.19: Weekly Stakes"


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED (v0.18) i PO (v0.19) dla podmienianych plikow
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

  const narrative = createNarrativeStrip(
    "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw."
  );

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

AGENDA_SCREEN_OLD = r"""// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Karty slotów mają pełne,
// nieucinane tytuły i czytelne linie ryzyka/napięcia/hintu, każda
// osobno (nie sklejone w jeden string, jak to się zdarzało w v0.17.x).
//
// The player chooses which remaining daily agenda slot to handle next.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureDailyAgenda,
  getAvailableAgendaItems,
  selectAgendaItem,
  getAgendaSlotLabel
} from "../../systems/dayAgendaSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

const SLOT_ICONS = {
  obligation: "📌",
  relationship: "💬",
  inner: "🧠"
};

const SLOT_DESCRIPTIONS = {
  obligation: "Sprawy, które i tak trzeba załatwić.",
  relationship: "Bliskość i napięcie między Tobą a partnerem.",
  inner: "To, jak się dziś czujesz i ile jeszcze masz w sobie."
};

export function renderAgendaScreen(container) {
  const state = getState();
  const agenda = ensureDailyAgenda(state);
  const availableItems = getAvailableAgendaItems(state);

  if (availableItems.length === 0) {
    state.phase = "evening";
    saveGame(state);
    showScreen("evening");
    return;
  }

  const topbar = createTopBar(state, "agenda");
  const sidebar = createSidebar(state, "agenda");

  const scene = createScenePanel({
    modifier: "agenda",
    title: "Plan dnia"
  });

  const narrative = createNarrativeStrip("Wybierz, czym zajmiesz się teraz. Kolejność ma znaczenie.");

  const cards = agenda.slots.map((item, index) => buildAgendaCard(item, index, state));

  const shell = createGameShell({
    screenClass: "agenda",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "triple"
  });

  container.appendChild(shell);
}

function buildAgendaCard(item, index, state) {
  return createDecisionCard({
    icon: item.completed ? "✓" : SLOT_ICONS[item.slot] || "•",
    title: getAgendaSlotLabel(item.slot),
    statusText: item.completed ? "ukończone" : "wybierz",
    description: SLOT_DESCRIPTIONS[item.slot] || "",
    metaLines: [
      `Ryzyko: ${buildSlotRiskLabel(item)}`,
      `Napięcie: ${buildSlotPressure(item, state)}`,
      buildSlotOrderHint(item)
    ],
    disabled: item.completed,
    onClick: () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    }
  });
}

// v0.15: RPG Gameplay Shell. Karty agendy komunikują stawkę decyzji
// (napięcie / ryzyko / hint) — czysto informacyjnie, bez wpływu na
// mechanikę wyboru ani na losowanie eventów.
function buildSlotPressure(item, state) {
  const spoons = state.resources.spoons.current;
  let pressure = "niskie";

  if (spoons <= 3) {
    pressure = "wysokie";
  } else if (spoons <= 6) {
    pressure = "średnie";
  }

  if (item.slot === "relationship") {
    const npc = getPartnerNpc(state);
    if (npc && Number(npc.frustration) >= 60) {
      pressure = "wysokie";
    }
  }

  if (item.slot === "obligation" && spoons <= 3) {
    pressure = "wysokie";
  }

  return pressure;
}

function buildSlotRiskLabel(item) {
  if (item.slot === "relationship") {
    return "emocjonalne";
  }

  if (item.slot === "obligation") {
    return "logistyczne";
  }

  if (item.slot === "inner") {
    return "regulacyjne";
  }

  return "nieznane";
}

function buildSlotOrderHint(item) {
  if (item.slot === "relationship") {
    return "Rozmowa później może być trudniejsza, jeśli wcześniej spadną Ci spoons.";
  }

  if (item.slot === "obligation") {
    return "Obowiązki zrobione wcześnie zdejmują presję, ale mogą zużyć energię przed relacją.";
  }

  if (item.slot === "inner") {
    return "Zajęcie się sobą wcześniej może pomóc wejść w resztę dnia spokojniej.";
  }

  return "";
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}
"""

AGENDA_SCREEN_NEW = r"""// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Karty slotów mają pełne,
// nieucinane tytuły i czytelne linie ryzyka/napięcia/hintu, każda
// osobno (nie sklejone w jeden string, jak to się zdarzało w v0.17.x).
//
// The player chooses which remaining daily agenda slot to handle next.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureDailyAgenda,
  getAvailableAgendaItems,
  selectAgendaItem,
  getAgendaSlotLabel
} from "../../systems/dayAgendaSystem.js";
import {
  ensureWeeklyChallengeState,
  getCurrentWeeklyChallenge,
  formatWeeklyChallengeCondition
} from "../../systems/weeklyChallengeSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

const SLOT_ICONS = {
  obligation: "📌",
  relationship: "💬",
  inner: "🧠"
};

const SLOT_DESCRIPTIONS = {
  obligation: "Sprawy, które i tak trzeba załatwić.",
  relationship: "Bliskość i napięcie między Tobą a partnerem.",
  inner: "To, jak się dziś czujesz i ile jeszcze masz w sobie."
};

export function renderAgendaScreen(container) {
  const state = getState();
  const agenda = ensureDailyAgenda(state);
  const availableItems = getAvailableAgendaItems(state);

  if (availableItems.length === 0) {
    state.phase = "evening";
    saveGame(state);
    showScreen("evening");
    return;
  }

  const topbar = createTopBar(state, "agenda");
  const sidebar = createSidebar(state, "agenda");

  const scene = createScenePanel({
    modifier: "agenda",
    title: "Plan dnia"
  });

  const narrative = createNarrativeStrip(buildAgendaNarrative(state));

  const cards = agenda.slots.map((item, index) => buildAgendaCard(item, index, state));

  const shell = createGameShell({
    screenClass: "agenda",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "triple"
  });

  container.appendChild(shell);
}

// v0.19: Weekly Stakes. Krótki teaser aktywnego wyzwania — jak w
// gameScreen.js, drugie zdanie w tym samym akapicie narracji, bez
// nowych elementów DOM ani zmian w layoucie v0.18.
function buildAgendaNarrative(state) {
  const base = "Wybierz, czym zajmiesz się teraz. Kolejność ma znaczenie.";

  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return base;
  }

  const condition = formatWeeklyChallengeCondition(challenge);
  return `${base} W tle wisi: ${challenge.title}. Warunek: ${condition}.`;
}

function buildAgendaCard(item, index, state) {
  return createDecisionCard({
    icon: item.completed ? "✓" : SLOT_ICONS[item.slot] || "•",
    title: getAgendaSlotLabel(item.slot),
    statusText: item.completed ? "ukończone" : "wybierz",
    description: SLOT_DESCRIPTIONS[item.slot] || "",
    metaLines: [
      `Ryzyko: ${buildSlotRiskLabel(item)}`,
      `Napięcie: ${buildSlotPressure(item, state)}`,
      buildSlotOrderHint(item)
    ],
    disabled: item.completed,
    onClick: () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    }
  });
}

// v0.15: RPG Gameplay Shell. Karty agendy komunikują stawkę decyzji
// (napięcie / ryzyko / hint) — czysto informacyjnie, bez wpływu na
// mechanikę wyboru ani na losowanie eventów.
function buildSlotPressure(item, state) {
  const spoons = state.resources.spoons.current;
  let pressure = "niskie";

  if (spoons <= 3) {
    pressure = "wysokie";
  } else if (spoons <= 6) {
    pressure = "średnie";
  }

  if (item.slot === "relationship") {
    const npc = getPartnerNpc(state);
    if (npc && Number(npc.frustration) >= 60) {
      pressure = "wysokie";
    }
  }

  if (item.slot === "obligation" && spoons <= 3) {
    pressure = "wysokie";
  }

  return pressure;
}

function buildSlotRiskLabel(item) {
  if (item.slot === "relationship") {
    return "emocjonalne";
  }

  if (item.slot === "obligation") {
    return "logistyczne";
  }

  if (item.slot === "inner") {
    return "regulacyjne";
  }

  return "nieznane";
}

function buildSlotOrderHint(item) {
  if (item.slot === "relationship") {
    return "Rozmowa później może być trudniejsza, jeśli wcześniej spadną Ci spoons.";
  }

  if (item.slot === "obligation") {
    return "Obowiązki zrobione wcześnie zdejmują presję, ale mogą zużyć energię przed relacją.";
  }

  if (item.slot === "inner") {
    return "Zajęcie się sobą wcześniej może pomóc wejść w resztę dnia spokojniej.";
  }

  return "";
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
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

export function renderWeeklySummaryScreen(container) {
  const state = getState();
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


# ---------------------------------------------------------------------------
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        r"""export const GAME_VERSION = "v0.18";
export const GAME_VERSION_LABEL = "Out of Spoons v0.18";""",
        r"""export const GAME_VERSION = "v0.19";
export const GAME_VERSION_LABEL = "Out of Spoons v0.19";""",
        'GAME_VERSION -> v0.19',
    ),
]

INDEX_HTML_PATCHES = [
    (
        r"""  <script type="module" src="./js/main.js?v=180"></script>""",
        r"""  <script type="module" src="./js/main.js?v=190"></script>""",
        'cache-bust ?v=190 w index.html',
    ),
]


def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.19 (Weekly Stakes / Stawka Tygodnia)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f'Podaj poprawna sciezke jako argument, np.:\n'
            f'  python apply_clean_v0_19_weekly_stakes.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/state/gameState.js",
        "js/state/saveManager.js",
        "js/systems/weeklySummarySystem.js",
        "js/ui/screens/weeklySummaryScreen.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/agendaScreen.js",
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

    print("Sanity check OK - wszystkie oczekiwane pliki znalezione (w tym v0.18 layout).\n")

    print("1/5 js/systems/weeklyChallengeSystem.js (nowy plik)")
    create_new_file_if_needed(
        project_root / "js/systems/weeklyChallengeSystem.js",
        WEEKLY_CHALLENGE_SYSTEM_JS,
        WEEKLY_CHALLENGE_SYSTEM_MARKER,
        "weeklyChallengeSystem.js -> nowy system Stawki Tygodnia",
    )
    print()

    print("2/5 js/ui/screens/gameScreen.js (pelna podmiana - teaser w narracji)")
    replace_whole_file(project_root / "js/ui/screens/gameScreen.js", GAME_SCREEN_OLD, GAME_SCREEN_NEW, "gameScreen.js -> teaser stawki tygodnia")
    print()

    print("3/5 js/ui/screens/agendaScreen.js (pelna podmiana - teaser w narracji)")
    replace_whole_file(project_root / "js/ui/screens/agendaScreen.js", AGENDA_SCREEN_OLD, AGENDA_SCREEN_NEW, "agendaScreen.js -> teaser stawki tygodnia")
    print()

    print("4/5 js/ui/screens/weeklySummaryScreen.js (pelna podmiana - sekcja Stawka tygodnia)")
    replace_whole_file(project_root / "js/ui/screens/weeklySummaryScreen.js", WEEKLY_SUMMARY_SCREEN_OLD, WEEKLY_SUMMARY_SCREEN_NEW, "weeklySummaryScreen.js -> sekcja Stawka tygodnia")
    print()

    print("5/5 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.19 (Weekly Stakes / Stawka Tygodnia) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Badge pokazuje "Out of Spoons v0.19", index.html ma ?v=190.
 2. Stary zapis (jesli masz) bez state.weeklyChallenge nie crashuje -
    wczytaj go i sprawdz, ze gra dziala normalnie.
 3. Zacznij nowa gre. Przez pierwsze 7 dni na morning/agendzie NIE MA
    jeszcze teasera stawki (brak aktywnego wyzwania).
 4. Po 1. weekly summary (dzien 7->8): sekcja "Stawka tygodnia" nie
    pokazuje wyniku (bo nie bylo jeszcze aktywnego wyzwania), tylko
    "Stawka nadchodzacego tygodnia" z warunkiem i "Pozostalo: 7 dni".
 5. Od dnia 8: na morning i agendzie widac drugie zdanie w narracji
    z teaserem wyzwania (np. "Stawka tygodnia: Wizyta rodziny za X dni.").
 6. Po 2. weekly summary (dzien 14->15): sekcja "Stawka tygodnia"
    pokazuje "Udalo sie: ..." albo "Nie udalo sie: ..." dla poprzedniego
    wyzwania, plus nowa "Stawka nadchodzacego tygodnia" na tydzien 3.
 7. Sukces: max spoons +1 (sprawdz w karcie postaci / topbarze),
    nigdy wiecej niz 14. Porazka: current spoons -2, nigdy ponizej 0.
 8. Odswiez strone na ekranie weekly summary (albo wroc na niego) -
    spoons i historia wyzwan NIE zmieniaja sie po raz drugi.
 9. Layout v0.18 (.oos-game, karty, sidebar) wyglada dokladnie tak
    samo jak wczesniej - zero zmian wizualnych.
10. Nie wrocil podwojny HUD. Spoons nadal nie resetuja sie do maksimum
    miedzy dniami. Flow dnia (poranek->agenda->event->reflection->...
    ->evening->kolejny poranek/weekly summary) dziala jak wczesniej.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)