#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_15_rpg_gameplay_shell.py

Updater dla Out of Spoons: v0.14 -> v0.15 (RPG Gameplay Shell).

Co robi:
  - NAPRAWIA krytyczny bug w js/ui/screens/reflectionScreen.js: zdublowany
    import "hasRemainingAgendaItems" powodujący SyntaxError, który
    wywala cały moduł (a przez to całą grę) przy starcie,
  - dodaje nowy plik js/ui/gameHud.js (globalny HUD gameplayowy),
  - patchuje uiManager.js (dołącza HUD po każdym renderze ekranu
    gameplayowego + ustawia body.dataset.gameScreen),
  - patchuje agendaScreen.js (karty slotów pokazują teraz ryzyko,
    obciążenie i hint - "wybór akcji", nie quiz),
  - patchuje reflectionScreen.js (panel "Skutek decyzji" + postęp dnia),
  - patchuje eveningScreen.js (notatka fazy "Koniec dnia"),
  - dopisuje/patchuje CSS: HUD, karty agendy, panel refleksji, noc,
    różne fazy dnia (body[data-game-screen="..."]),
  - podbija wersję w js/data/versionData.js do v0.15,
  - podbija cache-bust w index.html do ?v=150.

Nie zmienia saveVersion. Nie usuwa istniejącej funkcjonalności (poza
naprawą duplikatu importu, który i tak wywalał grę).
Skrypt jest idempotentny: można go uruchomić wielokrotnie - już
zaaplikowane fragmenty są pomijane, a nie duplikowane.

Użycie:
    python apply_clean_v0_15_rpg_gameplay_shell.py

Domyślnie oczekuje repo w C:\\OutOfSpoons. Można to zmienić podając
inną ścieżkę jako pierwszy argument linii poleceń.
"""

import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Konfiguracja
# ---------------------------------------------------------------------------

DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"


class UpdaterError(Exception):
    """Podnoszony, gdy sanity check nie przechodzi - lepiej przerwać,
    niż zepsuć plik nieprecyzyjnym patchem."""
    pass


# ---------------------------------------------------------------------------
# Pomocnicze funkcje I/O
# ---------------------------------------------------------------------------

def read_text(path: Path, encoding: str = "utf-8") -> str:
    if not path.exists():
        raise UpdaterError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding=encoding)


def write_text(path: Path, content: str, encoding: str = "utf-8") -> None:
    path.write_text(content, encoding=encoding)


def apply_patches(path: Path, patches, encoding: str = "utf-8") -> None:
    """
    patches: lista krotek (old_str, new_str, label).
    Każdy patch jest aplikowany do zawartości pliku w pamięci, w kolejności,
    a cały plik jest zapisywany raz na końcu (jeśli cokolwiek się zmieniło).

    Idempotentność: jeśli new_str jest już w pliku, patch jest pomijany.
    Bezpieczeństwo: jeśli old_str nie występuje dokładnie raz, przerywamy
    z jasnym komunikatem zamiast zgadywać.
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


def create_new_file_if_needed(path: Path, content: str, marker: str, label: str) -> None:
    """
    Tworzy nowy plik. Jeśli plik już istnieje i zawiera nasz marker
    (czyli poprzednie uruchomienie tego samego skryptu), pomija zapis.
    Jeśli plik istnieje i NIE zawiera markera, przerywa - nie chcemy
    nadpisywać czegoś, czego nie rozpoznajemy.
    """
    if path.exists():
        existing = read_text(path)
        if marker in existing:
            print(f"  [pominieto] {label} (plik juz istnieje z oczekiwana zawartoscia)")
            return
        raise UpdaterError(
            f"{path}\n"
            f"  Plik juz istnieje, ale nie zawiera oczekiwanego markera v0.15.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie, czy to nie jest\n"
            f"  inny plik o tej samej nazwie."
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    write_text(path, content)
    print(f"  [ok] {label} (nowy plik utworzony)")


def append_css_block_if_needed(path: Path, block: str, marker: str, label: str) -> None:
    content = read_text(path)
    if marker in content:
        print(f"  [pominieto] {label} (blok CSS juz obecny)")
        return

    if not content.endswith("\n"):
        content += "\n"
    content += "\n" + block
    write_text(path, content)
    print(f"  [ok] {label}")


# ---------------------------------------------------------------------------
# Zawartosc nowego pliku: js/ui/gameHud.js
# ---------------------------------------------------------------------------

GAME_HUD_JS = r"""// gameHud.js
//
// v0.15: RPG Gameplay Shell.
//
// Globalny HUD dodawany automatycznie przez uiManager.js na wszystkich
// ekranach gameplayowych (nie na menu głównym ani w kreatorze postaci).
// Ma dawać graczowi stały widok na to, kim jest, jaki jest dzień/faza,
// ile ma zasobów i jaki jest stan relacji z partnerem — feedback
// testerów mówił, że gra wygląda jak quiz, bo statystyki nie są stale
// widoczne. Ten moduł to naprawia, nie zmieniając żadnej mechaniki gry.
//
// UWAGA: logika "stanu emocjonalnego relacji" (buildRelationshipMood)
// jest tu celowo zduplikowana z js/ui/screens/gameScreen.js zamiast
// importowana stamtąd — uiManager.js już importuje gameScreen.js, więc
// dodatkowy import z powrotem do gameScreen.js pogłębiałby istniejący
// cykl importów (gameScreen.js <-> uiManager.js). Jeśli progi nastroju
// relacji się kiedyś zmienią, trzeba zaktualizować obie kopie.

import { getState } from "../state/gameState.js";

const HUD_VISIBLE_SCREENS = new Set([
  "game",
  "morning",
  "agenda",
  "event",
  "reflection",
  "evening",
  "weeklySummary"
]);

const SCREEN_PHASE_LABELS = {
  game: "Poranek",
  morning: "Poranek",
  agenda: "Plan dnia",
  event: "Wydarzenie",
  reflection: "Refleksja",
  evening: "Wieczór",
  weeklySummary: "Podsumowanie tygodnia"
};

/**
 * Dołącza globalny HUD na początku kontenera ekranu (nad kartą ekranu),
 * jeśli aktualny ekran jest ekranem gameplayowym i istnieje aktywna gra
 * z graczem. Bezpieczne do wywołania na każdym ekranie — samo decyduje,
 * czy ma się pokazać.
 */
export function appendGameHud(container, screenName) {
  if (!container || !HUD_VISIBLE_SCREENS.has(screenName)) {
    return;
  }

  const state = getState();
  if (!state || !state.player) {
    return;
  }

  const hud = buildHud(state, screenName);
  container.insertBefore(hud, container.firstChild);
}

function buildHud(state, screenName) {
  const hud = document.createElement("div");
  hud.className = "gameplay-hud";

  hud.appendChild(buildMainSection(state, screenName));
  hud.appendChild(buildStatsSection(state));

  const npc = getPartnerNpc(state);
  if (npc) {
    hud.appendChild(buildRelationshipSection(npc));
  }

  const dayProgress = buildDayProgress(state);
  if (dayProgress) {
    hud.appendChild(dayProgress);
  }

  return hud;
}

function buildMainSection(state, screenName) {
  const main = document.createElement("div");
  main.className = "gameplay-hud-main";

  const name = document.createElement("p");
  name.className = "gameplay-hud-name";
  name.textContent = state.player.name;
  main.appendChild(name);

  const meta = document.createElement("p");
  meta.className = "gameplay-hud-meta";
  meta.textContent = `Dzień ${state.day} · ${getPhaseLabel(screenName)}`;
  main.appendChild(meta);

  return main;
}

function getPhaseLabel(screenName) {
  return SCREEN_PHASE_LABELS[screenName] || "";
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

function buildStatsSection(state) {
  const stats = document.createElement("div");
  stats.className = "gameplay-hud-stats";

  const spoons = state.resources ? state.resources.spoons : null;
  if (spoons) {
    stats.appendChild(
      buildStatBar("Spoons", `${spoons.current}/${spoons.max}`, percentage(spoons.current, spoons.max), "spoons")
    );
  }

  return stats;
}

function buildStatBar(label, valueText, percent, modifier) {
  const stat = document.createElement("div");
  stat.className = "gameplay-hud-stat";

  const labelRow = document.createElement("div");
  labelRow.className = "gameplay-hud-label";

  const labelText = document.createElement("span");
  labelText.textContent = label;
  labelRow.appendChild(labelText);

  const valueEl = document.createElement("span");
  valueEl.className = "gameplay-hud-value";
  valueEl.textContent = valueText;
  labelRow.appendChild(valueEl);

  stat.appendChild(labelRow);

  const bar = document.createElement("div");
  bar.className = "gameplay-hud-bar";

  const fill = document.createElement("div");
  fill.className = `gameplay-hud-bar-fill gameplay-hud-bar-fill--${modifier}`;
  fill.style.width = `${percent}%`;
  bar.appendChild(fill);

  stat.appendChild(bar);

  return stat;
}

function buildRelationshipSection(npc) {
  const section = document.createElement("div");
  section.className = "gameplay-hud-relationship";

  section.appendChild(
    buildStatBar("Zaufanie", `${clampPercent(npc.trust)}`, clampPercent(npc.trust), "trust")
  );
  section.appendChild(
    buildStatBar("Frustracja", `${clampPercent(npc.frustration)}`, clampPercent(npc.frustration), "frustration")
  );

  const mood = buildRelationshipMoodLabel(npc);
  const moodLine = document.createElement("p");
  moodLine.className = "gameplay-hud-mood";
  moodLine.textContent = `Relacja: ${mood}`;
  section.appendChild(moodLine);

  return section;
}

// Duplikat progów z gameScreen.js#buildRelationshipMood — patrz komentarz
// na górze pliku, dlaczego to nie jest współdzielony import.
function buildRelationshipMoodLabel(npc) {
  const trust = clampPercent(npc.trust);
  const frustration = clampPercent(npc.frustration);

  if (trust >= 70 && frustration <= 25) {
    return "Bezpiecznie";
  }

  if (trust >= 50 && frustration <= 45) {
    return "Stabilnie";
  }

  if (frustration >= 70 && trust >= 40) {
    return "Napięcie";
  }

  if (trust < 35 && frustration >= 55) {
    return "Krucho";
  }

  if (trust < 35) {
    return "Niepewnie";
  }

  if (frustration >= 55) {
    return "Przeciążenie";
  }

  return "Niejasno";
}

function buildDayProgress(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;

  const progress = document.createElement("p");
  progress.className = "gameplay-hud-day-progress";
  progress.textContent = `Dzień: ${completed}/${total} wydarzeń`;
  return progress;
}

function percentage(current, max) {
  if (!max) {
    return 0;
  }

  return clampPercent((current / max) * 100);
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}
"""

GAME_HUD_MARKER = "v0.15: RPG Gameplay Shell"


# ---------------------------------------------------------------------------
# Blok CSS dopisywany na koncu css/style.css
# ---------------------------------------------------------------------------

RPG_SHELL_CSS_BLOCK = r"""/* CLEAN v0.15 RPG gameplay shell */

/* --------------------------------------------------------------------
   Globalny HUD (karta postaci / panel gry)
   -------------------------------------------------------------------- */

.gameplay-hud {
  background-color: var(--color-panel);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  box-shadow: 0 1px 3px rgba(43, 42, 40, 0.08);
}

.gameplay-hud-main {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-line);
}

.gameplay-hud-name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-ink);
}

.gameplay-hud-meta {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.gameplay-hud-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.gameplay-hud-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.gameplay-hud-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.gameplay-hud-value {
  color: var(--color-ink);
  font-weight: 600;
}

.gameplay-hud-bar {
  height: 6px;
  background-color: var(--color-line);
  border-radius: 3px;
  overflow: hidden;
}

.gameplay-hud-bar-fill {
  height: 100%;
  border-radius: 3px;
}

.gameplay-hud-bar-fill--spoons {
  background-color: var(--color-gold);
}

.gameplay-hud-bar-fill--trust {
  background-color: var(--color-sage);
}

.gameplay-hud-bar-fill--frustration {
  background-color: var(--color-rose);
}

.gameplay-hud-relationship {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-line);
}

.gameplay-hud-mood {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.gameplay-hud-day-progress {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
  text-align: right;
}

/* --------------------------------------------------------------------
   Agenda dnia jako karty wyboru akcji (ryzyko / obciążenie / hint)
   -------------------------------------------------------------------- */

.agenda-choice-card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-line);
  font-size: 0.8rem;
}

.agenda-choice-risk,
.agenda-choice-pressure {
  color: var(--color-muted);
}

.agenda-choice-hint {
  margin-top: 2px;
  color: var(--color-muted);
  font-style: italic;
}

/* --------------------------------------------------------------------
   Refleksja: panel skutku decyzji
   -------------------------------------------------------------------- */

.reflection-impact-panel {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin: 0 0 var(--space-md) 0;
}

.reflection-impact-title {
  margin: 0 0 var(--space-sm) 0;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-ink);
}

.reflection-day-progress {
  margin: var(--space-sm) 0 0 0;
  font-size: 0.85rem;
  color: var(--color-muted);
  text-align: right;
}

/* --------------------------------------------------------------------
   Wieczór: nuta końca dnia
   -------------------------------------------------------------------- */

.evening-phase-note {
  color: var(--color-muted);
  font-style: italic;
  border-left: 2px solid var(--color-line);
  padding-left: var(--space-sm);
  margin-bottom: var(--space-lg);
}

/* --------------------------------------------------------------------
   Fazy dnia — różny odcień w zależności od ekranu (body[data-game-screen])
   -------------------------------------------------------------------- */

body[data-game-screen="event"],
body[data-game-screen="reflection"] {
  --color-panel: #EFE8D8;
  --color-line: #B8AF9C;
}

body[data-game-screen="evening"] {
  --color-paper: #1E1C1A;
  --color-panel: #2A2724;
  --color-line: #45403A;
  --color-ink: #E7E2D8;
  --color-muted: #A39C8E;
}

body[data-game-screen="weeklySummary"] {
  --color-panel: #F5EEDC;
}
/* END CLEAN v0.15 RPG gameplay shell */
"""

RPG_SHELL_CSS_MARKER = "CLEAN v0.15 RPG gameplay shell"


# ---------------------------------------------------------------------------
# Patch: KRYTYCZNA NAPRAWA + rozbudowa js/ui/screens/reflectionScreen.js
# ---------------------------------------------------------------------------

REFLECTION_SCREEN_PATCHES = [
    (
        "import { saveGame } from \"../../state/saveManager.js\";\n"
        "import { hasRemainingAgendaItems } from \"../../systems/dayAgendaSystem.js\";\n"
        "import { hasRemainingAgendaItems } from \"../../systems/dayAgendaSystem.js\";\n"
        "export function renderReflectionScreen(container, data) {",
        "import { saveGame } from \"../../state/saveManager.js\";\n"
        "import { hasRemainingAgendaItems } from \"../../systems/dayAgendaSystem.js\";\n"
        "\n"
        "export function renderReflectionScreen(container, data) {",
        "KRYTYCZNA NAPRAWA: usuniecie zdublowanego importu (SyntaxError wywalajacy cala gre)",
    ),
    (
        "  if (consequences) {\n"
        "    wrapper.appendChild(renderConsequences(consequences));\n"
        "  }",
        "  if (consequences) {\n"
        "    wrapper.appendChild(renderImpactPanel(consequences, state));\n"
        "  }",
        "reflectionScreen: uzycie panelu Skutek decyzji zamiast surowych konsekwencji",
    ),
    (
        "function renderConsequences(consequences) {",
        "// CLEAN v0.15 reflection impact panel START\n"
        "// v0.15: RPG Gameplay Shell. Opakowuje istniejące konsekwencje w bardziej\n"
        "// \"gameplayowy\" panel z wyraźnym nagłówkiem, żeby refleksja mocniej\n"
        "// pokazywała skutek decyzji, zamiast wyglądać jak sam tekst.\n"
        "function renderImpactPanel(consequences, state) {\n"
        "  const panel = document.createElement(\"div\");\n"
        "  panel.className = \"reflection-impact-panel\";\n"
        "\n"
        "  const title = document.createElement(\"p\");\n"
        "  title.className = \"reflection-impact-title\";\n"
        "  title.textContent = \"Skutek decyzji\";\n"
        "  panel.appendChild(title);\n"
        "\n"
        "  panel.appendChild(renderConsequences(consequences));\n"
        "\n"
        "  const dayProgress = buildDayProgressLine(state);\n"
        "  if (dayProgress) {\n"
        "    panel.appendChild(dayProgress);\n"
        "  }\n"
        "\n"
        "  return panel;\n"
        "}\n"
        "\n"
        "function buildDayProgressLine(state) {\n"
        "  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {\n"
        "    return null;\n"
        "  }\n"
        "\n"
        "  const total = state.dailyAgenda.slots.length;\n"
        "  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;\n"
        "\n"
        "  const line = document.createElement(\"p\");\n"
        "  line.className = \"reflection-day-progress\";\n"
        "  line.textContent = `Postęp dnia: ${completed}/${total}`;\n"
        "  return line;\n"
        "}\n"
        "// CLEAN v0.15 reflection impact panel END\n"
        "\n"
        "function renderConsequences(consequences) {",
        "reflectionScreen: definicja renderImpactPanel() / buildDayProgressLine()",
    ),
]


# ---------------------------------------------------------------------------
# Patch: js/ui/screens/eveningScreen.js
# ---------------------------------------------------------------------------

EVENING_SCREEN_PATCHES = [
    (
        "  const title = document.createElement(\"h2\");\n"
        "  title.textContent = \"Wieczór\";\n"
        "  wrapper.appendChild(title);\n"
        "\n"
        "  const intro = document.createElement(\"p\");",
        "  const title = document.createElement(\"h2\");\n"
        "  title.textContent = \"Wieczór\";\n"
        "  wrapper.appendChild(title);\n"
        "\n"
        "  const phaseNote = document.createElement(\"p\");\n"
        "  phaseNote.className = \"evening-phase-note\";\n"
        "  phaseNote.textContent = \"Koniec dnia. To, co zostało w zasobach, przechodzi na jutro.\";\n"
        "  wrapper.appendChild(phaseNote);\n"
        "\n"
        "  const intro = document.createElement(\"p\");",
        "eveningScreen: dodanie notatki fazy 'Koniec dnia'",
    ),
]


# ---------------------------------------------------------------------------
# Patch: js/ui/screens/agendaScreen.js
# ---------------------------------------------------------------------------

AGENDA_SCREEN_PATCHES = [
    (
        "function renderAgendaChoiceButton(item, index, state) {\n"
        "  const button = document.createElement(\"button\");\n"
        "  const classes = [\"agenda-choice-button\"];\n"
        "\n"
        "  if (item.completed) {\n"
        "    classes.push(\"agenda-choice-button--completed\");\n"
        "  }\n"
        "\n"
        "  button.className = classes.join(\" \");\n"
        "  button.disabled = item.completed;\n"
        "\n"
        "  const marker = document.createElement(\"span\");\n"
        "  marker.className = \"agenda-choice-marker\";\n"
        "  marker.textContent = item.completed ? \"[✓]\" : \"[ ]\";\n"
        "  button.appendChild(marker);\n"
        "\n"
        "  const label = document.createElement(\"span\");\n"
        "  label.className = \"agenda-choice-label\";\n"
        "  label.textContent = getAgendaSlotLabel(item.slot);\n"
        "  button.appendChild(label);\n"
        "\n"
        "  const status = document.createElement(\"span\");\n"
        "  status.className = \"agenda-choice-status\";\n"
        "  status.textContent = item.completed ? \"ukończone\" : \"wybierz\";\n"
        "  button.appendChild(status);\n"
        "\n"
        "  if (!item.completed) {\n"
        "    button.addEventListener(\"click\", () => {\n"
        "      selectAgendaItem(state, index);\n"
        "      saveGame(state);\n"
        "      showScreen(\"event\");\n"
        "    });\n"
        "  }\n"
        "\n"
        "  return button;\n"
        "}",
        "function renderAgendaChoiceButton(item, index, state) {\n"
        "  const button = document.createElement(\"button\");\n"
        "  const classes = [\"agenda-choice-button\"];\n"
        "\n"
        "  if (item.completed) {\n"
        "    classes.push(\"agenda-choice-button--completed\");\n"
        "  }\n"
        "\n"
        "  button.className = classes.join(\" \");\n"
        "  button.disabled = item.completed;\n"
        "\n"
        "  const header = document.createElement(\"span\");\n"
        "  header.className = \"agenda-choice-header\";\n"
        "\n"
        "  const marker = document.createElement(\"span\");\n"
        "  marker.className = \"agenda-choice-marker\";\n"
        "  marker.textContent = item.completed ? \"[✓]\" : \"[ ]\";\n"
        "  header.appendChild(marker);\n"
        "\n"
        "  const label = document.createElement(\"span\");\n"
        "  label.className = \"agenda-choice-label\";\n"
        "  label.textContent = getAgendaSlotLabel(item.slot);\n"
        "  header.appendChild(label);\n"
        "\n"
        "  const status = document.createElement(\"span\");\n"
        "  status.className = \"agenda-choice-status\";\n"
        "  status.textContent = item.completed ? \"ukończone\" : \"wybierz\";\n"
        "  header.appendChild(status);\n"
        "\n"
        "  button.appendChild(header);\n"
        "  button.appendChild(buildSlotMeta(item, state));\n"
        "\n"
        "  if (!item.completed) {\n"
        "    button.addEventListener(\"click\", () => {\n"
        "      selectAgendaItem(state, index);\n"
        "      saveGame(state);\n"
        "      showScreen(\"event\");\n"
        "    });\n"
        "  }\n"
        "\n"
        "  return button;\n"
        "}\n"
        "\n"
        "// CLEAN v0.15 agenda choice cards START\n"
        "// v0.15: RPG Gameplay Shell. Karty agendy mają teraz komunikować stawkę\n"
        "// decyzji (obciążenie / ryzyko / hint), zamiast wyglądać jak lista pytań\n"
        "// quizu. Te wartości są na razie czysto informacyjne — nie wpływają\n"
        "// jeszcze na mechanikę wyboru ani na losowanie eventów.\n"
        "function buildSlotMeta(item, state) {\n"
        "  const meta = document.createElement(\"span\");\n"
        "  meta.className = \"agenda-choice-card-meta\";\n"
        "\n"
        "  const risk = document.createElement(\"span\");\n"
        "  risk.className = \"agenda-choice-risk\";\n"
        "  risk.textContent = `Ryzyko: ${buildSlotRiskLabel(item)}`;\n"
        "  meta.appendChild(risk);\n"
        "\n"
        "  const pressure = document.createElement(\"span\");\n"
        "  pressure.className = \"agenda-choice-pressure\";\n"
        "  pressure.textContent = `Obciążenie: ${buildSlotPressure(item, state)}`;\n"
        "  meta.appendChild(pressure);\n"
        "\n"
        "  const hint = document.createElement(\"span\");\n"
        "  hint.className = \"agenda-choice-hint\";\n"
        "  hint.textContent = buildSlotOrderHint(item, state);\n"
        "  meta.appendChild(hint);\n"
        "\n"
        "  return meta;\n"
        "}\n"
        "\n"
        "function buildSlotPressure(item, state) {\n"
        "  const spoons = state.resources.spoons.current;\n"
        "  let pressure = \"niskie\";\n"
        "\n"
        "  if (spoons <= 3) {\n"
        "    pressure = \"wysokie\";\n"
        "  } else if (spoons <= 6) {\n"
        "    pressure = \"średnie\";\n"
        "  }\n"
        "\n"
        "  if (item.slot === \"relationship\") {\n"
        "    const npc = getPartnerNpc(state);\n"
        "    if (npc && Number(npc.frustration) >= 60) {\n"
        "      pressure = \"wysokie\";\n"
        "    }\n"
        "  }\n"
        "\n"
        "  if (item.slot === \"obligation\" && spoons <= 3) {\n"
        "    pressure = \"wysokie\";\n"
        "  }\n"
        "\n"
        "  return pressure;\n"
        "}\n"
        "\n"
        "function buildSlotRiskLabel(item) {\n"
        "  if (item.slot === \"relationship\") {\n"
        "    return \"emocjonalne\";\n"
        "  }\n"
        "\n"
        "  if (item.slot === \"obligation\") {\n"
        "    return \"logistyczne\";\n"
        "  }\n"
        "\n"
        "  if (item.slot === \"inner\") {\n"
        "    return \"regulacyjne\";\n"
        "  }\n"
        "\n"
        "  return \"nieznane\";\n"
        "}\n"
        "\n"
        "function buildSlotOrderHint(item, state) {\n"
        "  if (item.slot === \"relationship\") {\n"
        "    return \"Rozmowa później może być trudniejsza, jeśli wcześniej spadną Ci spoons.\";\n"
        "  }\n"
        "\n"
        "  if (item.slot === \"obligation\") {\n"
        "    return \"Obowiązki zrobione wcześnie zdejmują presję, ale mogą zużyć energię przed relacją.\";\n"
        "  }\n"
        "\n"
        "  if (item.slot === \"inner\") {\n"
        "    return \"Zajęcie się sobą wcześniej może pomóc wejść w resztę dnia spokojniej.\";\n"
        "  }\n"
        "\n"
        "  return \"\";\n"
        "}\n"
        "\n"
        "function getPartnerNpc(state) {\n"
        "  if (!state.partner || !state.npcs) {\n"
        "    return null;\n"
        "  }\n"
        "\n"
        "  return state.npcs[state.partner.id] || null;\n"
        "}\n"
        "// CLEAN v0.15 agenda choice cards END",
        "agendaScreen: karty pokazuja ryzyko/obciazenie/hint (buildSlotMeta i helpery)",
    ),
]


# ---------------------------------------------------------------------------
# Patch: js/ui/uiManager.js
# ---------------------------------------------------------------------------

UI_MANAGER_PATCHES = [
    (
        "import { appendVersionBadge } from \"./versionBadge.js\";\n"
        "import { renderAgendaScreen } from \"./screens/agendaScreen.js\";",
        "import { appendVersionBadge } from \"./versionBadge.js\";\n"
        "import { renderAgendaScreen } from \"./screens/agendaScreen.js\";\n"
        "import { appendGameHud } from \"./gameHud.js\";",
        "uiManager: import appendGameHud",
    ),
    (
        "  appContainer.innerHTML = \"\";\n"
        "  render(appContainer, data);\n"
        "  appendVersionBadge(appContainer);\n"
        "}",
        "  appContainer.innerHTML = \"\";\n"
        "  document.body.dataset.gameScreen = screenName;\n"
        "  render(appContainer, data);\n"
        "  appendGameHud(appContainer, screenName);\n"
        "  appendVersionBadge(appContainer);\n"
        "}",
        "uiManager: wywolanie appendGameHud + body.dataset.gameScreen",
    ),
]


# ---------------------------------------------------------------------------
# Patch: css/style.css (istniejacy blok .agenda-choice-button z v0.14)
# ---------------------------------------------------------------------------

CSS_AGENDA_BUTTON_PATCHES = [
    (
        ".agenda-choice-button {\n"
        "  display: flex;\n"
        "  align-items: center;\n"
        "  gap: var(--space-sm);\n"
        "  text-align: left;\n"
        "  padding: 0.9rem 1rem;\n"
        "  background-color: var(--color-paper);\n"
        "  border: 1px solid var(--color-line);\n"
        "  color: var(--color-ink);\n"
        "  font-family: var(--font-body);\n"
        "  font-size: 1rem;\n"
        "}",
        ".agenda-choice-button {\n"
        "  display: flex;\n"
        "  flex-direction: column;\n"
        "  align-items: stretch;\n"
        "  gap: var(--space-sm);\n"
        "  text-align: left;\n"
        "  padding: 0.9rem 1rem;\n"
        "  background-color: var(--color-paper);\n"
        "  border: 1px solid var(--color-line);\n"
        "  color: var(--color-ink);\n"
        "  font-family: var(--font-body);\n"
        "  font-size: 1rem;\n"
        "}\n"
        "\n"
        ".agenda-choice-header {\n"
        "  display: flex;\n"
        "  align-items: center;\n"
        "  gap: var(--space-sm);\n"
        "  width: 100%;\n"
        "}",
        "css: .agenda-choice-button -> layout kolumnowy + .agenda-choice-header",
    ),
]


# ---------------------------------------------------------------------------
# Patch: js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        "export const GAME_VERSION = \"v0.14\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.14\";",
        "export const GAME_VERSION = \"v0.15\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.15\";",
        "GAME_VERSION -> v0.15",
    ),
]

INDEX_HTML_PATCHES = [
    (
        "  <script type=\"module\" src=\"./js/main.js?v=140\"></script>",
        "  <script type=\"module\" src=\"./js/main.js?v=150\"></script>",
        "cache-bust ?v=150 w index.html",
    ),
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.15 (RPG Gameplay Shell)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f"Podaj poprawna sciezke jako argument, np.:\n"
            f"  python apply_clean_v0_15_rpg_gameplay_shell.py \"D:\\sciezka\\do\\OutOfSpoons\""
        )

    # --- sanity check: wszystkie oczekiwane pliki musza istniec ---
    expected_files = [
        "js/ui/uiManager.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/agendaScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eveningScreen.js",
        "js/ui/screens/weeklySummaryScreen.js",
        "js/systems/dayAgendaSystem.js",
        "js/systems/dayCycle.js",
        "js/state/gameState.js",
        "js/data/versionData.js",
        "index.html",
        "css/style.css",
    ]

    missing = [f for f in expected_files if not (project_root / f).exists()]
    if missing:
        raise UpdaterError(
            "Brakuje oczekiwanych plikow w projekcie:\n"
            + "\n".join(f"  - {f}" for f in missing)
            + "\n\nTo repo wyglada inaczej niz zakladal ten updater. Przerywam."
        )

    print("Sanity check OK - wszystkie oczekiwane pliki znalezione.\n")

    # --- 1. NAPRAWA KRYTYCZNEGO BUGA + rozbudowa reflectionScreen.js ---
    print("1/7 js/ui/screens/reflectionScreen.js (w tym naprawa zdublowanego importu)")
    apply_patches(project_root / "js/ui/screens/reflectionScreen.js", REFLECTION_SCREEN_PATCHES)
    print()

    # --- 2. eveningScreen.js ---
    print("2/7 js/ui/screens/eveningScreen.js")
    apply_patches(project_root / "js/ui/screens/eveningScreen.js", EVENING_SCREEN_PATCHES)
    print()

    # --- 3. agendaScreen.js ---
    print("3/7 js/ui/screens/agendaScreen.js")
    apply_patches(project_root / "js/ui/screens/agendaScreen.js", AGENDA_SCREEN_PATCHES)
    print()

    # --- 4. nowy plik: gameHud.js ---
    print("4/7 js/ui/gameHud.js")
    create_new_file_if_needed(
        project_root / "js/ui/gameHud.js",
        GAME_HUD_JS,
        GAME_HUD_MARKER,
        "utworzenie gameHud.js",
    )
    print()

    # --- 5. uiManager.js ---
    print("5/7 js/ui/uiManager.js")
    apply_patches(project_root / "js/ui/uiManager.js", UI_MANAGER_PATCHES)
    print()

    # --- 6. css/style.css ---
    print("6/7 css/style.css")
    apply_patches(project_root / "css/style.css", CSS_AGENDA_BUTTON_PATCHES)
    append_css_block_if_needed(
        project_root / "css/style.css",
        RPG_SHELL_CSS_BLOCK,
        RPG_SHELL_CSS_MARKER,
        "dopisanie bloku CSS RPG gameplay shell",
    )
    print()

    # --- 7. versionData.js + index.html ---
    print("7/7 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.15 (RPG Gameplay Shell) zaaplikowane.")
    print("=" * 70)
    print("""
WAZNE: ten updater naprawia takze krytyczny bug znaleziony w repo
(zdublowany import w reflectionScreen.js, ktory powodowal SyntaxError
i wywalal cala gre przy starcie). Jesli gra nie dzialala PRZED tym
updaterem - to byl tego powod.

TEST PO WDROZENIU:

 1. Uruchom gre (otworz index.html w przegladarce / serwuj lokalnie).
 2. Sprawdz badge: powinno pokazywac "Out of Spoons v0.15".
 3. Zacznij nowa gre.
 4. Na ekranach gameplayowych (poranek/agenda/event/refleksja/wieczor/
    podsumowanie tygodnia) powinien byc widoczny HUD na gorze ekranu:
    imie gracza, dzien i faza, pasek spoons, zaufanie, frustracja,
    stan relacji, postep dnia.
 5. Menu glowne i kreator postaci NIE pokazuja HUD.
 6. Poranek/agenda/event/refleksja maja jedno "dzienne" tlo, wieczor
    wyglada wyraznie ciemniej/spokojniej, podsumowanie tygodnia ma
    lekko cieplejszy panel.
 7. Ekran agendy wyglada jak wybor akcji: kazda karta pokazuje
    Ryzyko / Obciazenie / krotki hint, nie tylko nazwe slotu.
 8. Po refleksji nadal wraca sie do agendy po 1. i 2. evencie
    (przycisk "Wroc do agendy dnia"), a na refleksji widac wyrazny
    panel "Skutek decyzji" z postepem dnia (np. "Postep dnia: 1/3").
 9. Po 3. evencie przycisk to "Zakoncz dzien" i prowadzi do wieczoru.
10. Wieczor pokazuje notatke "Koniec dnia. To, co zostalo w zasobach,
    przechodzi na jutro." nad istniejacym tekstem wieczoru.
11. Spoons nadal NIE resetuja sie do maksimum miedzy dniami.
12. Po dniu 7 weekly summary nadal dziala (i tez pokazuje HUD).
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)
