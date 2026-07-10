# apply_clean_v0_14_choose_agenda_order.py
#
# v0.14 — Choose Agenda Order
#
# Adds an agenda choice screen. The player chooses which remaining daily slot
# to handle next instead of automatically following a fixed order.
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_clean_v0_14_choose_agenda_order.py

from pathlib import Path
import re
import sys

ROOT = Path.cwd()
VERSION = "v0.14"
CACHE = "140"

FORBIDDEN = ["morningMessage", "npc-message", "pisze:", "{name} pisze"]

def fail(message):
    print(f"BLAD: {message}")
    sys.exit(1)

def require(rel):
    path = ROOT / rel
    if not path.exists():
        fail(f"nie znaleziono {rel}; uruchom skrypt z folderu C:\\OutOfSpoons")
    return path

def read(rel):
    return require(rel).read_text(encoding="utf-8")

def guard(rel, content):
    for token in FORBIDDEN:
        if token in content:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

def write(rel, content):
    guard(str(rel), content)
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

def insert_after_last_import(content, import_line):
    if import_line in content:
        return content

    imports = list(re.finditer(r'^import .+;\s*$', content, flags=re.MULTILINE))
    if not imports:
        fail("nie znaleziono importów w pliku")

    insert_at = imports[-1].end()
    return content[:insert_at] + "\n" + import_line + content[insert_at:]

def find_matching_brace(text, open_index):
    if open_index < 0 or open_index >= len(text) or text[open_index] != "{":
        fail("find_matching_brace: niepoprawny indeks")

    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False

    for i in range(open_index, len(text)):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if line_comment:
            if ch == "\n":
                line_comment = False
            continue

        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
            continue

        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            continue

        if ch == "/" and nxt == "/":
            line_comment = True
            continue

        if ch == "/" and nxt == "*":
            block_comment = True
            continue

        if ch in ['"', "'", "`"]:
            quote = ch
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i

    fail("nie znaleziono pasującej klamry")
    return -1

def extract_exported_function(text, name, required=True):
    start = text.find(f"export function {name}")
    if start == -1:
        if required:
            fail(f"nie znaleziono export function {name}")
        return None

    open_index = text.find("{", start)
    if open_index == -1:
        fail(f"nie znaleziono otwarcia funkcji {name}")

    close_index = find_matching_brace(text, open_index)
    return start, close_index + 1, text[start:close_index + 1]

def check_advance_no_reset(day_cycle_content):
    result = extract_exported_function(day_cycle_content, "advanceToNextDay", required=False)
    if not result:
        return

    _, _, fn = result
    if re.search(r"spoons\.current\s*=\s*[^;\n]*\.max", fn):
        fail("advanceToNextDay wygląda jakby resetował spoons do max")

def find_render_function_block(text, name):
    start = text.find(f"export function {name}")
    if start == -1:
        fail(f"nie znaleziono funkcji {name}")

    open_index = text.find("{", start)
    if open_index == -1:
        fail(f"nie znaleziono otwarcia funkcji {name}")

    close_index = find_matching_brace(text, open_index)
    return start, close_index + 1, text[start:close_index + 1]

def sanity_check():
    required = [
        "js/systems/dayAgendaSystem.js",
        "js/ui/uiManager.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/data/versionData.js",
        "index.html",
        "css/style.css",
    ]

    for rel in required:
        require(rel)

    agenda = read("js/systems/dayAgendaSystem.js")
    for token in [
        "ensureDailyAgenda",
        "getCurrentAgendaItem",
        "completeCurrentAgendaItem",
        "getAgendaSlotLabel",
    ]:
        if token not in agenda:
            fail(f"dayAgendaSystem.js nie wygląda na v0.13, brak: {token}")

    manager = read("js/ui/uiManager.js")
    for token in ["export function initUI", "export function showScreen"]:
        if token not in manager:
            fail(f"uiManager.js nie zawiera {token}")

    game = read("js/ui/screens/gameScreen.js")
    if "renderDailyAgendaSection" not in game:
        fail("gameScreen.js nie wygląda na v0.13, brak renderDailyAgendaSection")

    reflection = read("js/ui/screens/reflectionScreen.js")
    if "moveToNextAgendaItem" not in reflection and "hasNextAgendaItem" not in reflection:
        print("UWAGA: reflectionScreen.js nie ma starego v0.13 flow; spróbuję patchować ostrożnie.")

# ---------------------------------------------------------------------------
# 1. dayAgendaSystem.js — add new exports
# ---------------------------------------------------------------------------

day_agenda = read("js/systems/dayAgendaSystem.js")

if "export function getAvailableAgendaItems" not in day_agenda:
    addition = r'''

// CLEAN v0.14 choose agenda order helpers START
export function getAvailableAgendaItems(state) {
  const agenda = ensureDailyAgenda(state);

  return agenda.slots
    .map((item, index) => ({
      index,
      slot: item.slot,
      label: getAgendaSlotLabel(item.slot),
      eventId: item.eventId,
      completed: item.completed
    }))
    .filter((item) => !item.completed);
}

export function hasRemainingAgendaItems(state) {
  const agenda = ensureDailyAgenda(state);
  return agenda.slots.some((item) => !item.completed);
}

export function selectAgendaItem(state, agendaIndex) {
  const agenda = ensureDailyAgenda(state);
  let selectedIndex = agendaIndex;
  let selectedItem = agenda.slots[selectedIndex];

  if (!selectedItem || selectedItem.completed) {
    const fallbackIndex = agenda.slots.findIndex((item) => !item.completed);

    if (fallbackIndex === -1) {
      return state;
    }

    selectedIndex = fallbackIndex;
    selectedItem = agenda.slots[selectedIndex];
  }

  agenda.currentIndex = selectedIndex;
  state.currentEventId = selectedItem.eventId;
  state.phase = "event";

  return state;
}
// CLEAN v0.14 choose agenda order helpers END
'''
    day_agenda += addition

write(Path("js/systems/dayAgendaSystem.js"), day_agenda)

# ---------------------------------------------------------------------------
# 2. agendaScreen.js — new screen
# ---------------------------------------------------------------------------

agenda_screen = r'''// agendaScreen.js
//
// v0.14: Choose Agenda Order.
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

  const wrapper = document.createElement("div");
  wrapper.className = "screen agenda-choice-screen";

  const title = document.createElement("h2");
  title.textContent = "Agenda dnia";
  wrapper.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "agenda-choice-intro";
  intro.textContent = "Wybierz, czym zajmiesz się teraz.";
  wrapper.appendChild(intro);

  const list = document.createElement("div");
  list.className = "agenda-choice-list";

  agenda.slots.forEach((item, index) => {
    list.appendChild(renderAgendaChoiceButton(item, index, state));
  });

  wrapper.appendChild(list);
  container.appendChild(wrapper);
}

function renderAgendaChoiceButton(item, index, state) {
  const button = document.createElement("button");
  const classes = ["agenda-choice-button"];

  if (item.completed) {
    classes.push("agenda-choice-button--completed");
  }

  button.className = classes.join(" ");
  button.disabled = item.completed;

  const marker = document.createElement("span");
  marker.className = "agenda-choice-marker";
  marker.textContent = item.completed ? "[✓]" : "[ ]";
  button.appendChild(marker);

  const label = document.createElement("span");
  label.className = "agenda-choice-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  button.appendChild(label);

  const status = document.createElement("span");
  status.className = "agenda-choice-status";
  status.textContent = item.completed ? "ukończone" : "wybierz";
  button.appendChild(status);

  if (!item.completed) {
    button.addEventListener("click", () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    });
  }

  return button;
}
'''

write(Path("js/ui/screens/agendaScreen.js"), agenda_screen)

# ---------------------------------------------------------------------------
# 3. uiManager.js — register agenda screen
# ---------------------------------------------------------------------------

manager = read("js/ui/uiManager.js")

if "renderAgendaScreen" not in manager:
    manager = insert_after_last_import(
        manager,
        'import { renderAgendaScreen } from "./screens/agendaScreen.js";'
    )

if "agenda: renderAgendaScreen" not in manager:
    screens_pos = manager.find("const screens")
    if screens_pos == -1:
        fail("nie znaleziono const screens w uiManager.js")

    open_index = manager.find("{", screens_pos)
    if open_index == -1:
        fail("nie znaleziono otwarcia obiektu screens")

    close_index = find_matching_brace(manager, open_index)

    before_close = manager[:close_index].rstrip()
    after_close = manager[close_index:]

    if before_close.endswith("{"):
        insertion = "\n  agenda: renderAgendaScreen\n"
    else:
        insertion = ",\n  agenda: renderAgendaScreen\n"

    manager = before_close + insertion + after_close

write(Path("js/ui/uiManager.js"), manager)

# ---------------------------------------------------------------------------
# 4. gameScreen.js — morning button goes to agenda, not event
# ---------------------------------------------------------------------------

game = read("js/ui/screens/gameScreen.js")

if "saveManager.js" not in game:
    game = insert_after_last_import(
        game,
        'import { saveGame } from "../../state/saveManager.js";'
    )

# Remove goToEvent import if present in the common forms.
game = re.sub(
    r'^import \{ goToEvent \} from "../../systems/dayCycle\.js";\s*\n',
    "",
    game,
    flags=re.MULTILINE
)
game = re.sub(
    r'^import \{ goToEvent \} from "../../systems/dayCycle\.js";\r?\n',
    "",
    game,
    flags=re.MULTILINE
)

if "showScreen(\"agenda\")" not in game:
    start, end, render_game = find_render_function_block(game, "renderGameScreen")

    button_start = render_game.find('  const continueButton = document.createElement("button");')
    if button_start == -1:
        fail("nie znaleziono continueButton w renderGameScreen")

    append_marker = "  wrapper.appendChild(continueButton);"
    button_end = render_game.find(append_marker, button_start)
    if button_end == -1:
        fail("nie znaleziono wrapper.appendChild(continueButton) w renderGameScreen")

    button_end += len(append_marker)

    new_button = r'''  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Wybierz, czym zajmiesz się teraz";
  continueButton.addEventListener("click", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });
  wrapper.appendChild(continueButton);'''

    render_game_new = render_game[:button_start] + new_button + render_game[button_end:]
    game = game[:start] + render_game_new + game[end:]

write(Path("js/ui/screens/gameScreen.js"), game)

# ---------------------------------------------------------------------------
# 5. reflectionScreen.js — after reflection go to agenda if any remaining
# ---------------------------------------------------------------------------

reflection = read("js/ui/screens/reflectionScreen.js")

if "saveManager.js" not in reflection:
    reflection = insert_after_last_import(
        reflection,
        'import { saveGame } from "../../state/saveManager.js";'
    )

if "hasRemainingAgendaItems" not in reflection:
    reflection = insert_after_last_import(
        reflection,
        'import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";'
    )

# If old import is present, simplify it to avoid stale unused moveToNextAgendaItem.
reflection = re.sub(
    r'import \{[^}]*hasNextAgendaItem[^}]*\} from "../../systems/dayAgendaSystem\.js";',
    'import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";',
    reflection,
    count=1
)

if "goesBackToAgenda" not in reflection:
    start, end, render_reflection = find_render_function_block(reflection, "renderReflectionScreen")

    # Prefer replacing the full v0.13 block beginning with goesToNextEvent.
    old_start = render_reflection.find("  const goesToNextEvent")
    if old_start == -1:
        old_start = render_reflection.find('  const endDayButton = document.createElement("button");')

    if old_start == -1:
        fail("nie znaleziono bloku przycisku końca/refleksji w renderReflectionScreen")

    append_marker = "  wrapper.appendChild(endDayButton);"
    old_end = render_reflection.find(append_marker, old_start)
    if old_end == -1:
        fail("nie znaleziono wrapper.appendChild(endDayButton) w renderReflectionScreen")

    old_end += len(append_marker)

    new_block = r'''  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button";
  endDayButton.textContent = goesBackToAgenda
    ? "Wróć do agendy dnia"
    : "Zakończ dzień";

  endDayButton.addEventListener("click", () => {
    if (goesBackToAgenda) {
      saveGame(state);
      showScreen("agenda");
    } else {
      state.phase = "evening";
      saveGame(state);
      showScreen("evening");
    }
  });

  wrapper.appendChild(endDayButton);'''

    render_reflection_new = render_reflection[:old_start] + new_block + render_reflection[old_end:]
    reflection = reflection[:start] + render_reflection_new + reflection[end:]

write(Path("js/ui/screens/reflectionScreen.js"), reflection)

# ---------------------------------------------------------------------------
# 6. CSS
# ---------------------------------------------------------------------------

style = read("css/style.css")

if "/* CLEAN v0.14 agenda choice */" not in style:
    style += r'''

/* CLEAN v0.14 agenda choice */
.agenda-choice-intro {
  color: var(--color-muted);
  font-style: italic;
  margin: 0 0 var(--space-lg) 0;
}

.agenda-choice-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.agenda-choice-button {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  text-align: left;
  padding: 0.9rem 1rem;
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  color: var(--color-ink);
  font-family: var(--font-body);
  font-size: 1rem;
}

.agenda-choice-button:hover:not(:disabled) {
  border-color: var(--color-ink);
  background-color: var(--color-panel);
  cursor: pointer;
}

.agenda-choice-button--completed {
  color: var(--color-muted);
  border-style: dashed;
  cursor: default;
}

.agenda-choice-marker {
  font-family: var(--font-display);
  font-weight: 600;
  min-width: 2em;
}

.agenda-choice-label {
  font-family: var(--font-display);
  font-weight: 600;
  flex-grow: 1;
}

.agenda-choice-status {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-style: italic;
}
/* END CLEAN v0.14 agenda choice */
'''

write(Path("css/style.css"), style)

# ---------------------------------------------------------------------------
# 7. version + cache
# ---------------------------------------------------------------------------

version = read("js/data/versionData.js")
version, n1 = re.subn(
    r'GAME_VERSION\s*=\s*"[^"]*"',
    f'GAME_VERSION = "{VERSION}"',
    version,
    count=1
)
version, n2 = re.subn(
    r'GAME_VERSION_LABEL\s*=\s*"[^"]*"',
    f'GAME_VERSION_LABEL = "Out of Spoons {VERSION}"',
    version,
    count=1
)

if n1 != 1 or n2 != 1:
    fail("nie udało się zaktualizować versionData.js")

write(Path("js/data/versionData.js"), version)

index = read("index.html")
index, n = re.subn(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    f'src="./js/main.js?v={CACHE}"',
    index,
    count=1
)

if n != 1:
    fail("nie znaleziono script src dla js/main.js w index.html")

write(Path("index.html"), index)

# ---------------------------------------------------------------------------
# 8. verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

checks = {
    "js/systems/dayAgendaSystem.js": [
        "getAvailableAgendaItems",
        "hasRemainingAgendaItems",
        "selectAgendaItem",
    ],
    "js/ui/screens/agendaScreen.js": [
        "renderAgendaScreen",
        "selectAgendaItem",
        "Wybierz, czym zajmiesz się teraz",
    ],
    "js/ui/uiManager.js": [
        "renderAgendaScreen",
        "agenda: renderAgendaScreen",
        "export function initUI",
        "export function showScreen",
    ],
    "js/ui/screens/gameScreen.js": [
        "showScreen(\"agenda\")",
        "Wybierz, czym zajmiesz się teraz",
    ],
    "js/ui/screens/reflectionScreen.js": [
        "hasRemainingAgendaItems",
        "Wróć do agendy dnia",
        "showScreen(\"agenda\")",
        "showScreen(\"evening\")",
    ],
    "css/style.css": [
        "/* CLEAN v0.14 agenda choice */",
        ".agenda-choice-button",
    ],
    "js/data/versionData.js": [
        f'GAME_VERSION = "{VERSION}"',
        f"Out of Spoons {VERSION}",
    ],
    "index.html": [
        f"js/main.js?v={CACHE}",
    ],
}

for rel, tokens in checks.items():
    content = read(rel)
    for token in tokens:
        if token not in content:
            fail(f"{rel} nie zawiera wymaganego tokenu: {token}")

for rel in [
    "js/systems/dayAgendaSystem.js",
    "js/ui/screens/agendaScreen.js",
    "js/ui/uiManager.js",
    "js/ui/screens/gameScreen.js",
    "js/ui/screens/reflectionScreen.js",
]:
    content = read(rel)
    for token in FORBIDDEN:
        if token in content:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

print("OK: v0.14 Choose Agenda Order dodane.")
print("")
print("Teraz:")
print("1. Ctrl+C")
print("2. py -m http.server 8000")
print("3. http://localhost:8000/?v=140")
print("4. Ctrl+F5")
print("")
print("Test:")
print("- badge: Out of Spoons v0.14")
print("- Nowa gra")
print("- poranek -> przycisk: Wybierz, czym zajmiesz się teraz")
print("- ekran agenda pozwala wybrać dowolny nieukończony slot")
print("- po refleksji po 1. i 2. evencie wracasz do agendy")
print("- po 3. evencie refleksja prowadzi do Wieczoru")
print("- po dniu 7 weekly summary nadal działa")


if __name__ == "__main__":
    sanity_check()
