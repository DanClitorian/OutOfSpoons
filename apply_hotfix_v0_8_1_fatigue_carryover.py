# apply_hotfix_v0_8_1_fatigue_carryover.py
#
# Hotfix for Out of Spoons:
# v0.8 UI made choices depend on spoons, but spoons effectively reset each day,
# so the mechanic had weak/no pressure. This hotfix adds fatigue carryover.
#
# New rule:
# - The game stores fatigue in state.resources.fatigue.
# - Morning spoons = max spoons - fatigue, minimum 1.
# - Ending a day exhausted increases fatigue.
# - Ending a day with spare capacity reduces fatigue.
# - Clicking a forced choice that costs more spoons than you have adds debt.
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_hotfix_v0_8_1_fatigue_carryover.py

from pathlib import Path
import re
import sys

ROOT = Path.cwd()

def require(rel):
    path = ROOT / rel
    if not path.exists():
        print(f"BLAD: nie znaleziono {rel}")
        print("Uruchom skrypt z folderu C:\\OutOfSpoons.")
        sys.exit(1)
    return path

def write(rel, text):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

def patch_file(rel, patcher):
    path = require(rel)
    old = path.read_text(encoding="utf-8")
    new = patcher(old)
    if new == old:
        print(f"OK -> {rel} bez zmian")
    else:
        path.write_text(new, encoding="utf-8", newline="\n")
        print(f"OK -> {rel}")

# ---------------------------------------------------------------------------
# 1. New fatigueSystem.js
# ---------------------------------------------------------------------------

fatigue_system = r'''// fatigueSystem.js
//
// Hotfix v0.8.1: fatigue carryover.
//
// Spoons should not behave like a fully reset daily wallet.
// If the player ends the day depleted, the next morning starts with fewer
// available spoons. If the player keeps some capacity, fatigue can go down.

const MAX_FATIGUE = 6;
const MIN_MORNING_SPOONS = 1;

export function ensureFatigueState(state) {
  if (!state.resources) {
    state.resources = {};
  }

  if (!state.resources.fatigue || typeof state.resources.fatigue !== "object") {
    state.resources.fatigue = {
      current: 0,
      max: MAX_FATIGUE,
      lastChange: 0,
      lastReason: "init"
    };
  }

  state.resources.fatigue.max = MAX_FATIGUE;
  state.resources.fatigue.current = clamp(state.resources.fatigue.current, 0, MAX_FATIGUE);

  if (typeof state.resources.fatigue.lastChange !== "number") {
    state.resources.fatigue.lastChange = 0;
  }

  if (!state.resources.fatigue.lastReason) {
    state.resources.fatigue.lastReason = "init";
  }

  return state.resources.fatigue;
}

export function addFatigueDebt(state, missingSpoons) {
  const fatigue = ensureFatigueState(state);
  const debt = Math.max(0, Math.ceil(Number(missingSpoons) || 0));

  if (debt <= 0) {
    return 0;
  }

  fatigue.current = clamp(fatigue.current + debt, 0, fatigue.max);
  fatigue.lastChange = debt;
  fatigue.lastReason = "forced-choice";

  return debt;
}

export function updateFatigueAfterDay(state) {
  const fatigue = ensureFatigueState(state);
  const spoons = state.resources.spoons;

  const current = Number(spoons.current) || 0;
  const max = Number(spoons.max) || 10;

  let change = 0;
  let reason = "steady";

  if (current <= 0) {
    change = 2;
    reason = "ended-empty";
  } else if (current <= Math.ceil(max * 0.25)) {
    change = 1;
    reason = "ended-low";
  } else if (current >= Math.ceil(max * 0.5)) {
    change = -1;
    reason = "ended-with-reserve";
  }

  fatigue.current = clamp(fatigue.current + change, 0, fatigue.max);
  fatigue.lastChange = change;
  fatigue.lastReason = reason;

  return change;
}

export function applyMorningSpoonsFromFatigue(state) {
  const fatigue = ensureFatigueState(state);
  const spoons = state.resources.spoons;

  const max = Number(spoons.max) || 10;
  const available = Math.max(MIN_MORNING_SPOONS, max - fatigue.current);

  spoons.current = clamp(available, MIN_MORNING_SPOONS, max);

  return spoons.current;
}

export function getFatigueLabel(state) {
  const fatigue = ensureFatigueState(state);

  if (fatigue.current <= 0) {
    return "Brak przeciążenia";
  }

  if (fatigue.current <= 2) {
    return "Lekkie przeciążenie";
  }

  if (fatigue.current <= 4) {
    return "Narastające przeciążenie";
  }

  return "Wysokie przeciążenie";
}

export function getFatigueDescription(state) {
  const fatigue = ensureFatigueState(state);

  if (fatigue.current <= 0) {
    return "Jutro zaczynasz z pełną pojemnością.";
  }

  return `Jutro poranek zacznie się z mniejszą liczbą spoons: −${fatigue.current}.`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}
'''

write(Path("js/systems/fatigueSystem.js"), fatigue_system)

# ---------------------------------------------------------------------------
# 2. Patch dayCycle.js
# ---------------------------------------------------------------------------

def patch_day_cycle(text):
    if "fatigueSystem.js" not in text:
        # Put fatigue import after other system imports.
        text = re.sub(
            r'(import\s+\{[^;]*\}\s+from\s+"\.\/spoonsSystem\.js";\n)',
            r'\1import { ensureFatigueState, updateFatigueAfterDay, applyMorningSpoonsFromFatigue } from "./fatigueSystem.js";\n',
            text,
            count=1
        )

    if "fatigue:" not in text:
        # Add fatigue state to new games.
        text = re.sub(
            r'(resources:\s*\{\s*\n\s*spoons:\s*\{\s*current:\s*startingSpoons,\s*max:\s*startingSpoons\s*\}\s*\n\s*\})',
            'resources: {\n      spoons: { current: startingSpoons, max: startingSpoons },\n      fatigue: { current: 0, max: 6, lastChange: 0, lastReason: "new-game" }\n    }',
            text,
            count=1
        )

    # Ensure old saves get migrated whenever the current event is read.
    if "ensureFatigueState(state);" not in text:
        text = text.replace(
            "export function getCurrentEvent() {\n  const state = getState();",
            "export function getCurrentEvent() {\n  const state = getState();\n  ensureFatigueState(state);"
        )

    # Replace advanceToNextDay with fatigue-aware version.
    replacement = r'''export function advanceToNextDay() {
  const state = getState();

  ensureFatigueState(state);
  updateFatigueAfterDay(state);

  state.day += 1;
  state.phase = "morning";
  state.currentEventId = null;

  applyMorningSpoonsFromFatigue(state);

  return state;
}'''

    text, count = re.subn(
        r'export function advanceToNextDay\(\)\s*\{[\s\S]*?\n\}',
        replacement,
        text,
        count=1
    )

    if count == 0:
        print("BLAD: nie znalazlem funkcji advanceToNextDay() w js/systems/dayCycle.js")
        sys.exit(1)

    return text

patch_file(Path("js/systems/dayCycle.js"), patch_day_cycle)

# ---------------------------------------------------------------------------
# 3. Patch eventSystem.js
# ---------------------------------------------------------------------------

def patch_event_system(text):
    if "fatigueSystem.js" not in text:
        text = re.sub(
            r'(import\s+\{[^;]*modifySpoons[^;]*\}\s+from\s+"\.\/spoonsSystem\.js";\n)',
            r'\1import { addFatigueDebt, ensureFatigueState } from "./fatigueSystem.js";\n',
            text,
            count=1
        )

    if "currentSpoonsBeforeChoice" not in text:
        text = text.replace(
            "  const partnerId = state.partner.id;\n\n  modifySpoons(state, -choice.spoonsCost);",
            "  const partnerId = state.partner.id;\n\n  ensureFatigueState(state);\n  const currentSpoonsBeforeChoice = state.resources.spoons.current;\n  const missingSpoons = Math.max(0, choice.spoonsCost - currentSpoonsBeforeChoice);\n\n  modifySpoons(state, -choice.spoonsCost);\n  const fatigueDebt = addFatigueDebt(state, missingSpoons);"
        )

    if "fatigueChange" not in text:
        text = text.replace(
            "    frustrationChange: choice.frustrationChange\n  };",
            "    frustrationChange: choice.frustrationChange,\n    fatigueChange: fatigueDebt\n  };"
        )

    if "fatigueDebt" not in text:
        print("BLAD: nie udalo sie dodac fatigue debt do eventSystem.js")
        sys.exit(1)

    return text

patch_file(Path("js/systems/eventSystem.js"), patch_event_system)

# ---------------------------------------------------------------------------
# 4. Patch gameScreen.js to show fatigue on the morning screen
# ---------------------------------------------------------------------------

def patch_game_screen(text):
    if "renderFatigueSummary" not in text:
        text = text.replace(
            "  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));",
            "  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));\n  wrapper.appendChild(renderFatigueSummary(state));"
        )

        helper = r'''

function renderFatigueSummary(state) {
  const fatigue = state.resources && state.resources.fatigue
    ? state.resources.fatigue
    : { current: 0, max: 6, lastChange: 0, lastReason: "init" };

  const current = Number(fatigue.current) || 0;
  const max = Number(fatigue.max) || 6;

  const summary = document.createElement("p");
  summary.className = "fatigue-summary";

  if (current <= 0) {
    summary.textContent = "Przeciążenie: 0/6 — zaczynasz dzień z pełną pojemnością.";
    return summary;
  }

  summary.textContent = `Przeciążenie: ${current}/${max} — dzisiejszy poranek zaczyna się z mniejszą liczbą spoons.`;
  return summary;
}
'''
        # Insert before renderSpoonsMeter if possible.
        text = text.replace("\nfunction renderSpoonsMeter(spoons) {", helper + "\nfunction renderSpoonsMeter(spoons) {")

    return text

patch_file(Path("js/ui/screens/gameScreen.js"), patch_game_screen)

# ---------------------------------------------------------------------------
# 5. Patch reflectionScreen.js to mention fatigue consequence, if present
# ---------------------------------------------------------------------------

def patch_reflection_screen(text):
    if "Przeciążenie" not in text and "fatigueChange" not in text:
        text = text.replace(
            '  list.appendChild(buildConsequenceItem("Frustracja", consequences.frustrationChange));',
            '  list.appendChild(buildConsequenceItem("Frustracja", consequences.frustrationChange));\n\n  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {\n    list.appendChild(buildConsequenceItem("Przeciążenie", consequences.fatigueChange));\n  }'
        )

    if "Ta decyzja zwiększyła przeciążenie" not in text:
        text = text.replace(
            "  if (consequences.spoonsChange < 0) {\n    sentences.push(\"Koszt tej decyzji poczujesz jeszcze dziś.\");\n  }",
            "  if (consequences.spoonsChange < 0) {\n    sentences.push(\"Koszt tej decyzji poczujesz jeszcze dziś.\");\n  }\n\n  if (consequences.fatigueChange > 0) {\n    sentences.push(\"Ta decyzja zwiększyła przeciążenie, które przejdzie na kolejny dzień.\");\n  }"
        )

    return text

reflection_path = ROOT / "js/ui/screens/reflectionScreen.js"
if reflection_path.exists():
    patch_file(Path("js/ui/screens/reflectionScreen.js"), patch_reflection_screen)
else:
    print("UWAGA: brak reflectionScreen.js — pomijam UI konsekwencji fatigue.")

# ---------------------------------------------------------------------------
# 6. Patch CSS
# ---------------------------------------------------------------------------

style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

style = re.sub(
    r"/\* HOTFIX v0\.8\.1 fatigue carryover \*/[\s\S]*?/\* END HOTFIX v0\.8\.1 fatigue carryover \*/",
    "",
    style
)

style += r'''

/* HOTFIX v0.8.1 fatigue carryover */
.fatigue-summary {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
  margin: calc(-1 * var(--space-sm)) 0 var(--space-md) 0;
}
/* END HOTFIX v0.8.1 fatigue carryover */
'''

style_path.write_text(style, encoding="utf-8", newline="\n")
print("OK -> css/style.css")

# ---------------------------------------------------------------------------
# 7. Cache bust index.html only
# ---------------------------------------------------------------------------

index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=081"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# ---------------------------------------------------------------------------
# 8. Verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

checks = {
    "js/systems/fatigueSystem.js": ["applyMorningSpoonsFromFatigue", "updateFatigueAfterDay", "addFatigueDebt"],
    "js/systems/dayCycle.js": ["applyMorningSpoonsFromFatigue(state)", "updateFatigueAfterDay(state)", "fatigueSystem.js"],
    "js/systems/eventSystem.js": ["addFatigueDebt(state, missingSpoons)", "fatigueChange"],
    "js/ui/screens/gameScreen.js": ["renderFatigueSummary", "Przeciążenie"],
}

for rel, tokens in checks.items():
    text = (ROOT / rel).read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            print(f"BLAD: {rel} nie zawiera {token}")
            sys.exit(1)

print("OK: fatigue carryover dodany.")
print("OK: next day nie resetuje juz zawsze do pelnych spoons.")
print("OK: forced choice tworzy fatigue debt.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=081")
print("4. Ctrl+F5")
print("5. Nowa gra")
print("")
print("Test manualny:")
print("- zagraj 2-3 dni i wybieraj drogie opcje")
print("- na poranku powinno pojawic sie: Przeciazenie X/6")
print("- Dostepne spoons na evencie powinny spadac ponizej max")
