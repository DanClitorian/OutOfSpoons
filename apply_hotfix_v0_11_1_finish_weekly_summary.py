# apply_hotfix_v0_11_1_finish_weekly_summary.py
#
# Hotfix for failed v0.11 updater.
#
# Problem:
# apply_clean_v0_11_weekly_summary.py crashed while patching eveningScreen.js
# because the updater used regex patterns on JS code snippets.
#
# This hotfix:
# - safely rewrites/ensures weekly summary files,
# - patches eveningScreen.js using string/bracket parsing, not regex patterns,
# - patches uiManager.js robustly,
# - appends CSS if needed,
# - cache-busts index.html to ?v=111.
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_hotfix_v0_11_1_finish_weekly_summary.py

from pathlib import Path
import re
import sys

ROOT = Path.cwd()

FORBIDDEN_ACTIVE_TOKENS = [
    "morningMessage",
    "npc-message",
    "pisze:",
    "{name} pisze"
]

def fail(message):
    print(f"BLAD: {message}")
    sys.exit(1)

def require(rel):
    path = ROOT / rel
    if not path.exists():
        fail(f"nie znaleziono {rel}. Uruchom skrypt z folderu C:\\OutOfSpoons.")
    return path

def read(rel):
    return require(rel).read_text(encoding="utf-8")

def write(rel, text):
    guard(rel, text)
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

def guard(rel, text):
    for token in FORBIDDEN_ACTIVE_TOKENS:
        if token in text:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

def sanity_check():
    required = [
        Path("js/ui/screens/eveningScreen.js"),
        Path("js/ui/uiManager.js"),
        Path("css/style.css"),
        Path("index.html"),
        Path("js/ui/screens/gameScreen.js"),
        Path("js/systems/eveningRecoverySystem.js"),
    ]

    for rel in required:
        require(rel)

    game = read(Path("js/ui/screens/gameScreen.js"))
    for token in ["renderPersistentSpoonsNote", "renderMorningEvents", "renderPreviousEveningSummary"]:
        if token not in game:
            fail(f"gameScreen.js nie wyglada na v0.10, brak: {token}")

    evening = read(Path("js/ui/screens/eveningScreen.js"))
    for token in ["applyEveningRecovery", "advanceToNextDay", "showScreen(\"game\")"]:
        if token not in evening and token != "showScreen(\"game\")":
            fail(f"eveningScreen.js nie wyglada na v0.9+, brak: {token}")

    manager = read(Path("js/ui/uiManager.js"))
    for token in ["export function initUI", "export function showScreen"]:
        if token not in manager:
            fail(f"uiManager.js nie zawiera {token}")

# ---------------------------------------------------------------------------
# 1. Ensure weeklySummarySystem.js
# ---------------------------------------------------------------------------

weekly_summary_system = r'''// weeklySummarySystem.js
//
// v0.11: weekly summary logic.
// This module only reads existing state and aggregates existing log entries.
// It does not create or store new state.

export function shouldShowWeeklySummary(completedDay) {
  return completedDay > 0 && completedDay % 7 === 0;
}

export function buildWeeklySummary(state) {
  const endDay = state.day - 1;
  const startDay = Math.max(1, endDay - 6);
  const weekNumber = Math.ceil(endDay / 7);

  const entries = Array.isArray(state.log)
    ? state.log.filter((entry) => entry.day >= startDay && entry.day <= endDay)
    : [];

  const totals = sumConsequences(entries);
  const npc = state.partner && state.npcs ? state.npcs[state.partner.id] : null;
  const mood = npc ? buildRelationshipMood(npc) : null;

  const summary = {
    weekNumber,
    startDay,
    endDay,
    eventCount: entries.length,

    spoonsChange: totals.spoonsChange,
    trustChange: totals.trustChange,
    frustrationChange: totals.frustrationChange,
    fatigueChange: totals.fatigueChange,
    hasFatigueData: totals.hasFatigueData,

    currentSpoons: state.resources.spoons.current,
    maxSpoons: state.resources.spoons.max,
    currentTrust: npc ? npc.trust : null,
    currentFrustration: npc ? npc.frustration : null,
    relationshipMoodLabel: mood ? mood.label : null,
    relationshipMoodDescription: mood ? mood.description : null
  };

  summary.summaryText = buildSummaryText(summary);

  return summary;
}

function sumConsequences(entries) {
  const totals = {
    spoonsChange: 0,
    trustChange: 0,
    frustrationChange: 0,
    fatigueChange: 0,
    hasFatigueData: false
  };

  entries.forEach((entry) => {
    if (!entry.consequences) {
      return;
    }

    const consequences = entry.consequences;

    totals.spoonsChange += Number(consequences.spoonsChange) || 0;
    totals.trustChange += Number(consequences.trustChange) || 0;
    totals.frustrationChange += Number(consequences.frustrationChange) || 0;

    if (typeof consequences.fatigueChange === "number") {
      totals.fatigueChange += consequences.fatigueChange;
      totals.hasFatigueData = true;
    }
  });

  return totals;
}

function buildSummaryText(summary) {
  if (summary.frustrationChange >= 10) {
    return "Ten tydzień zostawił w relacji więcej napięcia niż odpowiedzi. Nie wszystko pękło, ale coś zaczęło wymagać ostrożniejszego dotyku.";
  }

  if (summary.trustChange >= 8) {
    return "Ten tydzień nie był lekki, ale kilka decyzji zbudowało więcej bezpieczeństwa niż było go na początku.";
  }

  if (summary.spoonsChange <= -12) {
    return "Ten tydzień kosztował dużo pojemności. Nie jako jedna wielka katastrofa, raczej jako suma małych obciążeń, które przestały być małe.";
  }

  return "To nie był tydzień spektakularnych rozstrzygnięć. Raczej siedem dni drobnych kosztów, małych ulg i decyzji, które zaczynają układać się w wzór.";
}

function buildRelationshipMood(npc) {
  const trust = clampToPercentage(Number(npc.trust) || 0);
  const frustration = clampToPercentage(Number(npc.frustration) || 0);

  if (trust >= 70 && frustration <= 25) {
    return {
      label: "Bezpiecznie",
      description: "W tej relacji jest dużo zaufania i niewiele napięcia."
    };
  }

  if (trust >= 50 && frustration <= 45) {
    return {
      label: "Stabilnie",
      description: "Relacja trzyma się dobrze, choć nadal wymaga uważności."
    };
  }

  if (frustration >= 70 && trust >= 40) {
    return {
      label: "Napięcie",
      description: "Zaufanie jeszcze istnieje, ale napięcie zaczyna dominować."
    };
  }

  if (trust < 35 && frustration >= 55) {
    return {
      label: "Krucho",
      description: "Relacja może źle znosić kolejne uniki albo niejasne sygnały."
    };
  }

  if (trust < 35) {
    return {
      label: "Niepewnie",
      description: "W relacji brakuje poczucia bezpieczeństwa."
    };
  }

  if (frustration >= 55) {
    return {
      label: "Przeciążenie",
      description: "Nagromadzone napięcie zaczyna być trudne do ignorowania."
    };
  }

  return {
    label: "Niejasno",
    description: "Relacja jest w ruchu. Jeszcze nie wiadomo, w którą stronę pójdzie."
  };
}

function clampToPercentage(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
'''

write(Path("js/systems/weeklySummarySystem.js"), weekly_summary_system)

# ---------------------------------------------------------------------------
# 2. Ensure weeklySummaryScreen.js
# ---------------------------------------------------------------------------

weekly_summary_screen = r'''// weeklySummaryScreen.js
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
'''

write(Path("js/ui/screens/weeklySummaryScreen.js"), weekly_summary_screen)

# ---------------------------------------------------------------------------
# 3. Patch eveningScreen.js with bracket parsing, no fragile regex pattern
# ---------------------------------------------------------------------------

def find_balanced_block(text, start_index):
    brace_start = text.find("{", start_index)
    if brace_start == -1:
        fail("nie znaleziono otwarcia bloku addEventListener.")

    depth = 0
    for i in range(brace_start, len(text)):
        char = text[i]

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1

            if depth == 0:
                # Include trailing ");"
                end = text.find(");", i)
                if end == -1:
                    fail("nie znaleziono zamkniecia ); po handlerze.")
                return start_index, end + 2

    fail("nie znaleziono konca handlera.")
    return None

evening_path = require(Path("js/ui/screens/eveningScreen.js"))
evening = evening_path.read_text(encoding="utf-8")

if "weeklySummarySystem.js" not in evening:
    import_anchor = '} from "../../systems/eveningRecoverySystem.js";'
    if import_anchor not in evening:
        fail("nie znaleziono importu eveningRecoverySystem.js w eveningScreen.js.")
    evening = evening.replace(
        import_anchor,
        import_anchor + '\nimport { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";',
        1
    )

if "shouldShowWeeklySummary(completedDay)" not in evening:
    function_start = evening.find("function renderEveningOptionButton")
    if function_start == -1:
        fail("nie znaleziono renderEveningOptionButton w eveningScreen.js.")

    handler_start = evening.find('button.addEventListener("click"', function_start)
    if handler_start == -1:
        fail("nie znaleziono click handlera w renderEveningOptionButton.")

    # Preserve indentation.
    line_start = evening.rfind("\n", 0, handler_start) + 1
    indent = evening[line_start:handler_start]

    block_start, block_end = find_balanced_block(evening, handler_start)

    new_handler = f'''{indent}button.addEventListener("click", () => {{
{indent}  const currentState = getState();
{indent}  const completedDay = currentState.day;

{indent}  applyEveningRecovery(option.id, currentState);
{indent}  advanceToNextDay();
{indent}  saveGame(currentState);

{indent}  if (shouldShowWeeklySummary(completedDay)) {{
{indent}    showScreen("weeklySummary");
{indent}  }} else {{
{indent}    showScreen("game");
{indent}  }}
{indent}}});'''

    evening = evening[:block_start] + new_handler + evening[block_end:]

write(Path("js/ui/screens/eveningScreen.js"), evening)

# ---------------------------------------------------------------------------
# 4. Patch uiManager.js robustly
# ---------------------------------------------------------------------------

manager_path = require(Path("js/ui/uiManager.js"))
manager = manager_path.read_text(encoding="utf-8")

if "renderWeeklySummaryScreen" not in manager:
    imports = list(re.finditer(r'^import .+;\s*$', manager, flags=re.MULTILINE))
    if not imports:
        fail("nie znaleziono importow w uiManager.js.")

    insert_at = imports[-1].end()
    manager = (
        manager[:insert_at]
        + '\nimport { renderWeeklySummaryScreen } from "./screens/weeklySummaryScreen.js";'
        + manager[insert_at:]
    )

if "weeklySummary: renderWeeklySummaryScreen" not in manager:
    manager, count = re.subn(
        r'(evening\s*:\s*renderEveningScreen)(\s*,?)',
        r'\1,\n  weeklySummary: renderWeeklySummaryScreen',
        manager,
        count=1
    )

    if count != 1:
        fail("nie udalo sie dodac weeklySummary do screens w uiManager.js.")

write(Path("js/ui/uiManager.js"), manager)

# ---------------------------------------------------------------------------
# 5. CSS
# ---------------------------------------------------------------------------

style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

if "/* CLEAN v0.11 weekly summary */" not in style:
    style += r'''

/* CLEAN v0.11 weekly summary */
.weekly-summary-period {
  color: var(--color-muted);
  font-style: italic;
  margin: 0 0 var(--space-md) 0;
}

.weekly-summary-text {
  color: var(--color-ink);
  margin: 0 0 var(--space-lg) 0;
}

.weekly-summary-panel,
.weekly-summary-current-state {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin: 0 0 var(--space-md) 0;
}

.weekly-summary-heading {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 1.05rem;
  color: var(--color-ink);
  margin: 0 0 var(--space-sm) 0;
  border-bottom: 1px dotted var(--color-line);
  padding-bottom: var(--space-sm);
}

.weekly-summary-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weekly-summary-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px dotted var(--color-line);
}

.weekly-summary-item:last-child {
  border-bottom: none;
}

.weekly-summary-label {
  color: var(--color-muted);
}

.weekly-summary-value {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--color-ink);
}

.weekly-summary-current-state p {
  margin: 0 0 4px 0;
}

.weekly-summary-current-state p:last-child {
  margin-bottom: 0;
}

.weekly-summary-mood-description {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
}
/* END CLEAN v0.11 weekly summary */
'''

write(Path("css/style.css"), style)

# ---------------------------------------------------------------------------
# 6. Cache bust
# ---------------------------------------------------------------------------

index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index, count = re.subn(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=111"',
    index,
    count=1
)

if count != 1:
    fail("nie znaleziono script src dla js/main.js w index.html.")

write(Path("index.html"), index)

# ---------------------------------------------------------------------------
# 7. Verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

checks = {
    "js/systems/weeklySummarySystem.js": [
        "shouldShowWeeklySummary",
        "completedDay > 0 && completedDay % 7 === 0",
        "buildWeeklySummary"
    ],
    "js/ui/screens/weeklySummaryScreen.js": [
        "renderWeeklySummaryScreen",
        "Podsumowanie tygodnia",
        "Rozpocznij kolejny tydzień"
    ],
    "js/ui/screens/eveningScreen.js": [
        "weeklySummarySystem.js",
        "const completedDay = currentState.day",
        "shouldShowWeeklySummary(completedDay)",
        "showScreen(\"weeklySummary\")"
    ],
    "js/ui/uiManager.js": [
        "renderWeeklySummaryScreen",
        "weeklySummary: renderWeeklySummaryScreen",
        "export function initUI",
        "export function showScreen"
    ],
    "css/style.css": [
        "/* CLEAN v0.11 weekly summary */",
        ".weekly-summary-panel",
        ".weekly-summary-current-state"
    ],
    "index.html": [
        "js/main.js?v=111"
    ]
}

for rel, tokens in checks.items():
    content = (ROOT / rel).read_text(encoding="utf-8")
    for token in tokens:
        if token not in content:
            fail(f"{rel} nie zawiera: {token}")

for rel in [
    "js/systems/weeklySummarySystem.js",
    "js/ui/screens/weeklySummaryScreen.js",
    "js/ui/screens/eveningScreen.js",
    "js/ui/uiManager.js"
]:
    content = (ROOT / rel).read_text(encoding="utf-8")
    for token in FORBIDDEN_ACTIVE_TOKENS:
        if token in content:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

print("OK: v0.11 dokończone.")
print("OK: weekly summary screen zarejestrowany.")
print("OK: eveningScreen kieruje po dniu 7/14/21 do weeklySummary.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=111")
print("4. Ctrl+F5")
print("")
print("Test:")
print("- przejdz przez 7 pelnych dni")
print("- po wyborze opcji wieczornej dnia 7 powinien pokazac sie ekran Podsumowanie tygodnia")
print("- kliknij Rozpocznij kolejny tydzien")
print("- powinien pojawic sie poranek dnia 8")


if __name__ == "__main__":
    sanity_check()
