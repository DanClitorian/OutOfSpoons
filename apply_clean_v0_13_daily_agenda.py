# apply_clean_v0_13_daily_agenda.py
#
# Clean v0.13 updater for Out of Spoons.
#
# Daily Agenda Prototype:
# - each day has 3 agenda slots:
#   1. obligation
#   2. relationship
#   3. inner
# - each slot gets one weighted event
# - reflection goes to next event until all 3 are done
# - after the 3rd event reflection goes to evening
#
# This updater is intentionally less fragile than a strict OLD -> NEW script:
# - eventData.js is patched by event id
# - exported functions are replaced or patched by balanced-brace parsing
# - imports are inserted after existing imports
# - saveVersion is not changed
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_clean_v0_13_daily_agenda.py

from pathlib import Path
import re
import sys

ROOT = Path.cwd()
VERSION = "v0.13"
CACHE = "130"

FORBIDDEN = ["morningMessage", "npc-message", "pisze:", "{name} pisze"]

AGENDA_SLOT_TAGS = {
    "talk_request": ["relationship"],
    "cancel_plans": ["relationship", "inner"],
    "need_rest": ["inner"],
    "text_misunderstanding": ["relationship"],
    "social_invitation": ["obligation"],
    "life_obligation": ["obligation"],
}

def fail(message):
    print(f"BLAD: {message}")
    sys.exit(1)

def path(rel):
    p = ROOT / rel
    if not p.exists():
        fail(f"nie znaleziono {rel}; uruchom skrypt z folderu C:\\OutOfSpoons")
    return p

def read(rel):
    return path(rel).read_text(encoding="utf-8")

def guard(rel, content):
    for token in FORBIDDEN:
        if token in content:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

def write(rel, content):
    guard(str(rel), content)
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

def insert_after_last_import(content, import_line):
    if import_line in content:
        return content

    imports = list(re.finditer(r'^import .+;\s*$', content, flags=re.MULTILINE))
    if not imports:
        fail("nie znaleziono importów w pliku, którego próbuję patchować")

    insert_at = imports[-1].end()
    return content[:insert_at] + "\n" + import_line + content[insert_at:]

# ---------------------------------------------------------------------------
# JS parsing helpers
# ---------------------------------------------------------------------------

def find_matching_brace(text, open_index):
    if open_index < 0 or open_index >= len(text) or text[open_index] != "{":
        fail("find_matching_brace: niepoprawny indeks otwarcia")

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
            fail(f"nie znaleziono funkcji export function {name}")
        return None

    open_index = text.find("{", start)
    if open_index == -1:
        fail(f"nie znaleziono otwarcia funkcji {name}")

    close_index = find_matching_brace(text, open_index)
    return start, close_index + 1, text[start:close_index + 1]

def replace_exported_function(text, name, replacement):
    start, end, old = extract_exported_function(text, name, required=True)
    return text[:start] + replacement + text[end:]

def check_advance_no_reset(day_cycle_content):
    result = extract_exported_function(day_cycle_content, "advanceToNextDay", required=False)
    if not result:
        return
    _, _, fn = result
    if re.search(r"spoons\.current\s*=\s*[^;\n]*\.max", fn):
        fail("advanceToNextDay wygląda jakby resetował spoons do max")

def find_event_object_bounds(text, event_id):
    match = re.search(r'id\s*:\s*["\']' + re.escape(event_id) + r'["\']', text)
    if not match:
        fail(f"nie znaleziono eventu o id {event_id} w eventData.js")

    open_index = text.rfind("{", 0, match.start())
    if open_index == -1:
        fail(f"nie znaleziono początku obiektu eventu {event_id}")

    close_index = find_matching_brace(text, open_index)
    return open_index, close_index + 1

def format_array(values):
    return "[" + ", ".join(f'"{value}"' for value in values) + "]"

# ---------------------------------------------------------------------------
# Sanity check
# ---------------------------------------------------------------------------

def sanity_check():
    required = [
        "js/data/eventData.js",
        "js/systems/eventSystem.js",
        "js/systems/eventWeightSystem.js",
        "js/systems/dayCycle.js",
        "js/state/saveManager.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eveningScreen.js",
        "js/data/versionData.js",
        "index.html",
        "css/style.css",
    ]

    for rel in required:
        path(rel)

    if "export function getWeightedEventForDay" not in read("js/systems/eventWeightSystem.js"):
        fail("eventWeightSystem.js nie eksportuje getWeightedEventForDay")

    if "export function getEventForDay" not in read("js/systems/eventSystem.js"):
        fail("eventSystem.js nie eksportuje getEventForDay")

    if "export function goToEvent" not in read("js/systems/dayCycle.js"):
        fail("dayCycle.js nie eksportuje goToEvent")

    game = read("js/ui/screens/gameScreen.js")
    for token in ["renderPersistentSpoonsNote", "renderMorningEvents", "renderPreviousEveningSummary"]:
        if token not in game:
            fail(f"gameScreen.js nie wygląda na v0.10+, brak: {token}")

    check_advance_no_reset(read("js/systems/dayCycle.js"))

# ---------------------------------------------------------------------------
# 1. dayAgendaSystem.js
# ---------------------------------------------------------------------------

DAY_AGENDA_SYSTEM = r'''// dayAgendaSystem.js
//
// v0.13: Daily Agenda Prototype.
// Each day has three fixed slots: obligation, relationship and inner.
// Slot order is fixed for now; player-controlled ordering can come later.

import { eventPool } from "../data/eventData.js";
import { getWeightedEventForDay } from "./eventWeightSystem.js";

const AGENDA_SLOT_ORDER = ["obligation", "relationship", "inner"];

const AGENDA_SLOT_LABELS = {
  obligation: "Obowiązek",
  relationship: "Relacja",
  inner: "Wewnętrzne"
};

export function ensureDailyAgenda(state) {
  if (state.dailyAgenda && state.dailyAgenda.day === state.day) {
    return state.dailyAgenda;
  }

  const previousEntry = Array.isArray(state.log) ? state.log[state.log.length - 1] : null;
  const previousEventId = previousEntry ? previousEntry.eventId : null;
  const chosenIds = [];

  const slots = AGENDA_SLOT_ORDER.map((slot) => {
    const eventId = pickEventIdForAgendaSlot(slot, state, previousEventId, chosenIds);
    chosenIds.push(eventId);

    return {
      slot,
      eventId,
      completed: false
    };
  });

  state.dailyAgenda = {
    day: state.day,
    slots,
    currentIndex: 0
  };

  return state.dailyAgenda;
}

export function getCurrentAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);
  return agenda.slots[agenda.currentIndex];
}

export function getCurrentAgendaProgress(state) {
  const agenda = ensureDailyAgenda(state);
  const currentItem = agenda.slots[agenda.currentIndex];

  return {
    current: agenda.currentIndex + 1,
    total: agenda.slots.length,
    slot: currentItem.slot,
    label: getAgendaSlotLabel(currentItem.slot)
  };
}

export function completeCurrentAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);
  const currentItem = agenda.slots[agenda.currentIndex];

  if (currentItem) {
    currentItem.completed = true;
  }

  return currentItem;
}

export function hasNextAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);
  return agenda.currentIndex < agenda.slots.length - 1;
}

export function moveToNextAgendaItem(state) {
  const agenda = ensureDailyAgenda(state);

  if (agenda.currentIndex < agenda.slots.length - 1) {
    agenda.currentIndex += 1;
  }

  const nextItem = agenda.slots[agenda.currentIndex];

  state.currentEventId = nextItem.eventId;
  state.phase = "event";

  return state;
}

export function getAgendaSlotLabel(slot) {
  return AGENDA_SLOT_LABELS[slot] || "Nieznane";
}

function pickEventIdForAgendaSlot(slot, state, previousEventId, chosenIds) {
  const eligibleByDay = getEligibleEventsForDay(state.day);

  const eligibleBySlot = eligibleByDay.filter(
    (event) => Array.isArray(event.agendaSlots) && event.agendaSlots.includes(slot)
  );

  const slotPool = eligibleBySlot.length > 0 ? eligibleBySlot : eligibleByDay;

  const withoutTodayRepeats = slotPool.filter((event) => !chosenIds.includes(event.id));
  const candidates = withoutTodayRepeats.length > 0 ? withoutTodayRepeats : slotPool;

  const chosenEvent = getWeightedEventForDay(candidates, state, previousEventId);
  return chosenEvent.id;
}

function getEligibleEventsForDay(day) {
  const eligible = eventPool.filter((event) => !event.minDay || day >= event.minDay);
  return eligible.length > 0 ? eligible : eventPool;
}
'''

write(Path("js/systems/dayAgendaSystem.js"), DAY_AGENDA_SYSTEM)

# ---------------------------------------------------------------------------
# 2. eventData.js: agendaSlots by event id
# ---------------------------------------------------------------------------

def patch_event_data():
    content = read("js/data/eventData.js")

    for event_id, slots in AGENDA_SLOT_TAGS.items():
        start, end = find_event_object_bounds(content, event_id)
        obj = content[start:end]
        agenda_line = f"agendaSlots: {format_array(slots)}"

        if re.search(r'agendaSlots\s*:', obj):
            obj_new = re.sub(r'agendaSlots\s*:\s*\[[^\]]*\]', agenda_line, obj, count=1)
        elif re.search(r'weightTags\s*:', obj):
            match = re.search(r'^(\s*)weightTags\s*:\s*\[[^\]]*\]\s*,?', obj, flags=re.MULTILINE)
            if not match:
                fail(f"weightTags istnieje, ale nie umiem go znaleźć liniowo w evencie {event_id}")
            indent = match.group(1)
            pos = match.end()
            comma = "" if obj[pos - 1] == "," else ","
            obj_new = obj[:pos] + comma + f"\n{indent}{agenda_line}," + obj[pos:]
        elif re.search(r'tags\s*:', obj):
            match = re.search(r'^(\s*)tags\s*:\s*\[[^\]]*\]\s*,?', obj, flags=re.MULTILINE)
            if not match:
                fail(f"tags istnieje, ale nie umiem go znaleźć liniowo w evencie {event_id}")
            indent = match.group(1)
            pos = match.end()
            comma = "" if obj[pos - 1] == "," else ","
            obj_new = obj[:pos] + comma + f"\n{indent}{agenda_line}," + obj[pos:]
        else:
            match = re.search(r'^(\s*)id\s*:\s*["\']' + re.escape(event_id) + r'["\']\s*,?', obj, flags=re.MULTILINE)
            if not match:
                fail(f"nie znaleziono miejsca na agendaSlots w evencie {event_id}")
            indent = match.group(1)
            pos = match.end()
            comma = "" if obj[pos - 1] == "," else ","
            obj_new = obj[:pos] + comma + f"\n{indent}{agenda_line}," + obj[pos:]

        content = content[:start] + obj_new + content[end:]

    if "agendaSlots" not in content:
        fail("nie udało się dodać agendaSlots do eventData.js")

    if "v0.13: agendaSlots" not in content:
        marker = "export const eventPool"
        i = content.find(marker)
        if i != -1:
            content = (
                content[:i]
                + "// v0.13: agendaSlots przypisują eventy do slotów dziennej agendy.\n\n"
                + content[i:]
            )

    write(Path("js/data/eventData.js"), content)

patch_event_data()

# ---------------------------------------------------------------------------
# 3. dayCycle.js: goToEvent uses agenda
# ---------------------------------------------------------------------------

day_cycle = read("js/systems/dayCycle.js")

if "dayAgendaSystem.js" not in day_cycle:
    day_cycle = insert_after_last_import(
        day_cycle,
        'import { ensureDailyAgenda, getCurrentAgendaItem } from "./dayAgendaSystem.js";'
    )

GO_TO_EVENT_REPLACEMENT = r'''export function goToEvent() {
  const state = getState();

  ensureDailyAgenda(state);

  const currentItem = getCurrentAgendaItem(state);
  state.currentEventId = currentItem.eventId;
  state.phase = "event";

  return state;
}'''

if "ensureDailyAgenda(state);" not in extract_exported_function(day_cycle, "goToEvent", True)[2]:
    day_cycle = replace_exported_function(day_cycle, "goToEvent", GO_TO_EVENT_REPLACEMENT)

check_advance_no_reset(day_cycle)
write(Path("js/systems/dayCycle.js"), day_cycle)

# ---------------------------------------------------------------------------
# 4. eventSystem.js: mark current agenda item complete after choice is applied
# ---------------------------------------------------------------------------

event_system = read("js/systems/eventSystem.js")

if "dayAgendaSystem.js" not in event_system:
    event_system = insert_after_last_import(
        event_system,
        'import { completeCurrentAgendaItem } from "./dayAgendaSystem.js";'
    )

if "completeCurrentAgendaItem(state);" not in event_system:
    start, end, apply_choice = extract_exported_function(event_system, "applyChoice", True)

    if "\n  return choice;" not in apply_choice:
        fail("nie znaleziono return choice; w applyChoice")

    apply_choice_new = apply_choice.replace(
        "\n  return choice;",
        "\n  completeCurrentAgendaItem(state);\n\n  return choice;",
        1
    )

    event_system = event_system[:start] + apply_choice_new + event_system[end:]

write(Path("js/systems/eventSystem.js"), event_system)

# ---------------------------------------------------------------------------
# 5. eventScreen.js: progress label
# ---------------------------------------------------------------------------

event_screen = read("js/ui/screens/eventScreen.js")

if "dayAgendaSystem.js" not in event_screen:
    event_screen = insert_after_last_import(
        event_screen,
        'import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js";'
    )

if "renderEventProgress(state)" not in event_screen:
    target = '  wrapper.className = "screen event-screen";\n'
    if target not in event_screen:
        fail('nie znaleziono wrapper.className = "screen event-screen"; w eventScreen.js')
    event_screen = event_screen.replace(
        target,
        target + "\n  wrapper.appendChild(renderEventProgress(state));\n",
        1
    )

if "function renderEventProgress(state)" not in event_screen:
    helper = r'''function renderEventProgress(state) {
  const progress = getCurrentAgendaProgress(state);

  const label = document.createElement("p");
  label.className = "event-progress";
  label.textContent = `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`;

  return label;
}

'''
    marker = "function renderResourceSummary"
    if marker not in event_screen:
        fail("nie znaleziono function renderResourceSummary w eventScreen.js")
    event_screen = event_screen.replace(marker, helper + marker, 1)

write(Path("js/ui/screens/eventScreen.js"), event_screen)

# ---------------------------------------------------------------------------
# 6. reflectionScreen.js: next event or evening
# ---------------------------------------------------------------------------

reflection = read("js/ui/screens/reflectionScreen.js")

if "saveManager.js" not in reflection:
    reflection = insert_after_last_import(
        reflection,
        'import { saveGame } from "../../state/saveManager.js";'
    )

if "dayAgendaSystem.js" not in reflection:
    reflection = insert_after_last_import(
        reflection,
        'import { hasNextAgendaItem, moveToNextAgendaItem } from "../../systems/dayAgendaSystem.js";'
    )

if "goesToNextEvent" not in reflection:
    start, end, render_reflection = extract_exported_function(reflection, "renderReflectionScreen", True)

    button_start = render_reflection.find('  const endDayButton = document.createElement("button");')
    if button_start == -1:
        fail("nie znaleziono bloku endDayButton w renderReflectionScreen")

    append_marker = "  wrapper.appendChild(endDayButton);"
    button_end = render_reflection.find(append_marker, button_start)
    if button_end == -1:
        fail("nie znaleziono wrapper.appendChild(endDayButton) w renderReflectionScreen")
    button_end += len(append_marker)

    new_button_block = r'''  const goesToNextEvent = hasNextAgendaItem(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button";
  endDayButton.textContent = goesToNextEvent
    ? "Przejdź do następnego wydarzenia"
    : "Zakończ dzień";

  endDayButton.addEventListener("click", () => {
    if (goesToNextEvent) {
      moveToNextAgendaItem(state);
      saveGame(state);
      showScreen("event");
    } else {
      state.phase = "evening";
      showScreen("evening");
    }
  });

  wrapper.appendChild(endDayButton);'''

    render_reflection_new = (
        render_reflection[:button_start]
        + new_button_block
        + render_reflection[button_end:]
    )

    reflection = reflection[:start] + render_reflection_new + reflection[end:]

write(Path("js/ui/screens/reflectionScreen.js"), reflection)

# ---------------------------------------------------------------------------
# 7. gameScreen.js: agenda section on morning
# ---------------------------------------------------------------------------

game = read("js/ui/screens/gameScreen.js")

if "dayAgendaSystem.js" not in game:
    game = insert_after_last_import(
        game,
        'import { ensureDailyAgenda, getAgendaSlotLabel } from "../../systems/dayAgendaSystem.js";'
    )

if "renderDailyAgendaSection(state)" not in game:
    target = "\n  if (state.player) {"
    if target not in game:
        fail("nie znaleziono miejsca przed status sentence w gameScreen.js")
    game = game.replace(
        target,
        "\n  wrapper.appendChild(renderDailyAgendaSection(state));\n" + target,
        1
    )

if "function renderDailyAgendaSection(state)" not in game:
    helper = r'''// CLEAN v0.13 daily agenda helpers START
function renderDailyAgendaSection(state) {
  const agenda = ensureDailyAgenda(state);

  const section = document.createElement("div");
  section.className = "daily-agenda";

  const heading = document.createElement("p");
  heading.className = "daily-agenda-heading";
  heading.textContent = "Agenda dnia";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "daily-agenda-list";

  agenda.slots.forEach((item, index) => {
    list.appendChild(renderDailyAgendaItem(item, index, agenda.currentIndex, agenda.slots.length));
  });

  section.appendChild(list);
  return section;
}

function renderDailyAgendaItem(item, index, currentIndex, totalSlots) {
  const listItem = document.createElement("li");
  const classes = ["daily-agenda-item"];

  if (item.completed) {
    classes.push("daily-agenda-item--completed");
  } else if (index === currentIndex) {
    classes.push("daily-agenda-item--current");
  }

  listItem.className = classes.join(" ");

  const indexLabel = document.createElement("span");
  indexLabel.className = "daily-agenda-index";
  indexLabel.textContent = `[${index + 1}/${totalSlots}]`;
  listItem.appendChild(indexLabel);

  const label = document.createElement("span");
  label.className = "daily-agenda-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  listItem.appendChild(label);

  return listItem;
}
// CLEAN v0.13 daily agenda helpers END

'''
    marker = "function renderPartnerCard"
    if marker not in game:
        fail("nie znaleziono function renderPartnerCard w gameScreen.js")
    game = game.replace(marker, helper + marker, 1)

write(Path("js/ui/screens/gameScreen.js"), game)

# ---------------------------------------------------------------------------
# 8. CSS
# ---------------------------------------------------------------------------

style = read("css/style.css")

if "/* CLEAN v0.13 daily agenda */" not in style:
    style += r'''

/* CLEAN v0.13 daily agenda */
.daily-agenda {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin: var(--space-md) 0 var(--space-lg) 0;
}

.daily-agenda-heading {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.daily-agenda-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.daily-agenda-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  padding: 2px 0;
  color: var(--color-muted);
}

.daily-agenda-item--current {
  color: var(--color-ink);
  font-weight: 600;
}

.daily-agenda-item--completed {
  color: var(--color-sage);
}

.daily-agenda-index {
  font-family: var(--font-display);
  font-weight: 600;
  min-width: 2.5em;
}

.daily-agenda-label {
  font-family: var(--font-display);
}

.event-progress {
  color: var(--color-muted);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0 0 var(--space-sm) 0;
}
/* END CLEAN v0.13 daily agenda */
'''

write(Path("css/style.css"), style)

# ---------------------------------------------------------------------------
# 9. Version + cache bust
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
# Verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

checks = {
    "js/systems/dayAgendaSystem.js": [
        "ensureDailyAgenda",
        "getCurrentAgendaProgress",
        "completeCurrentAgendaItem",
        "moveToNextAgendaItem",
    ],
    "js/data/eventData.js": [
        "agendaSlots",
        '"obligation"',
        '"relationship"',
        '"inner"',
    ],
    "js/systems/dayCycle.js": [
        "dayAgendaSystem.js",
        "ensureDailyAgenda(state)",
        "state.currentEventId = currentItem.eventId",
    ],
    "js/systems/eventSystem.js": [
        "completeCurrentAgendaItem",
        "completeCurrentAgendaItem(state)",
    ],
    "js/ui/screens/eventScreen.js": [
        "getCurrentAgendaProgress",
        "Wydarzenie ${progress.current}/${progress.total}",
    ],
    "js/ui/screens/reflectionScreen.js": [
        "hasNextAgendaItem",
        "moveToNextAgendaItem",
        "Przejdź do następnego wydarzenia",
    ],
    "js/ui/screens/gameScreen.js": [
        "renderDailyAgendaSection",
        "Agenda dnia",
    ],
    "css/style.css": [
        "/* CLEAN v0.13 daily agenda */",
        ".daily-agenda",
        ".event-progress",
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

check_advance_no_reset(read("js/systems/dayCycle.js"))

for rel in [
    "js/systems/dayAgendaSystem.js",
    "js/systems/dayCycle.js",
    "js/systems/eventSystem.js",
    "js/ui/screens/eventScreen.js",
    "js/ui/screens/reflectionScreen.js",
    "js/ui/screens/gameScreen.js",
]:
    content = read(rel)
    for token in FORBIDDEN:
        if token in content:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

print("OK: v0.13 Daily Agenda Prototype dodany.")
print("")
print("Teraz:")
print("1. Ctrl+C")
print("2. py -m http.server 8000")
print("3. http://localhost:8000/?v=130")
print("4. Ctrl+F5")
print("")
print("Test:")
print("- badge: Out of Spoons v0.13")
print("- Nowa gra")
print("- poranek pokazuje Agenda dnia z 3 slotami")
print("- event pokazuje Wydarzenie 1/3")
print("- refleksja po 1 i 2 evencie prowadzi do następnego wydarzenia")
print("- refleksja po 3 evencie prowadzi do Wieczoru")
print("- spoons nadal nie resetują się między dniami")
print("- po dniu 7 weekly summary nadal działa")


if __name__ == "__main__":
    sanity_check()
