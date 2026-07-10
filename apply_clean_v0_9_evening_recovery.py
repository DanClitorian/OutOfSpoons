# apply_clean_v0_9_evening_recovery.py
#
# Clean v0.9 updater for Out of Spoons.
#
# Adds evening recovery screen:
#   morning -> event -> reflection -> evening -> next morning
#
# This version does NOT overwrite gameScreen.js, eventScreen.js, dayCycle.js,
# main.js, partnerData.js, partnerSystem.js, eventData.js, eventSystem.js,
# morningEventData.js, morningEventSystem.js.
#
# It patches uiManager in place, replaces reflectionScreen with a clean version,
# adds evening data/system/screen files, and appends CSS.
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_clean_v0_9_evening_recovery.py

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

def patch(rel, fn):
    path = require(rel)
    old = path.read_text(encoding="utf-8")
    new = fn(old)
    path.write_text(new, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

# ---------------------------------------------------------------------------
# 1. eveningRecoveryData.js
# ---------------------------------------------------------------------------

evening_data = r'''// eveningRecoveryData.js
//
// v0.9: evening recovery options.
// The player chooses one way to end the day before the next morning starts.

export const eveningRecoveryOptions = [
  {
    id: "sleep-early",
    label: "Położyć się wcześniej",
    description: "Nie rozwiązuje wszystkiego, ale przynajmniej przestajesz dziś dokładać kolejne warstwy zmęczenia.",
    effects: {
      spoonsChange: 3,
      trustChange: 0,
      frustrationChange: -1
    }
  },
  {
    id: "mindless-scroll",
    label: "Scrollować, żeby nie myśleć",
    description: "Daje chwilowe odcięcie. Nie daje prawdziwej regeneracji.",
    effects: {
      spoonsChange: 1,
      trustChange: 0,
      frustrationChange: 1
    }
  },
  {
    id: "short-message",
    label: "Napisać krótką wiadomość do {partnerName}",
    description: "Nie masz siły na wielką rozmowę, ale możesz zostawić jasny sygnał obecności.",
    effects: {
      spoonsChange: -1,
      trustChange: 2,
      frustrationChange: -1
    }
  },
  {
    id: "pretend-fine",
    label: "Udawać, że wszystko jest okej",
    description: "Na zewnątrz nic się nie dzieje. W środku wszystko zostaje bez opieki.",
    effects: {
      spoonsChange: 0,
      trustChange: -1,
      frustrationChange: 2
    }
  },
  {
    id: "small-ritual",
    label: "Zrobić mały rytuał domknięcia dnia",
    description: "Herbata, prysznic, zapisanie jednej myśli. Małe rzeczy nie są małe, kiedy ledwo trzymasz strukturę.",
    effects: {
      spoonsChange: 2,
      trustChange: 0,
      frustrationChange: 0
    }
  }
];
'''

write(Path("js/data/eveningRecoveryData.js"), evening_data)

# ---------------------------------------------------------------------------
# 2. eveningRecoverySystem.js
# ---------------------------------------------------------------------------

evening_system = r'''// eveningRecoverySystem.js
//
// v0.9: applies one evening recovery choice before the next day starts.
// This system mutates the existing game state in place.
// It does not create a new save version.

import { eveningRecoveryOptions } from "../data/eveningRecoveryData.js";

export function getEveningRecoveryOptions(state) {
  return eveningRecoveryOptions;
}

export function applyEveningRecovery(optionId, state) {
  const option = eveningRecoveryOptions.find((item) => item.id === optionId);

  if (!option) {
    throw new Error(`Nieznana opcja wieczoru: ${optionId}`);
  }

  const resolvedOption = resolveOption(option, state);
  const effects = resolvedOption.effects;

  applySpoonsChange(state, effects.spoonsChange);
  applyRelationshipChange(state, effects.trustChange, effects.frustrationChange);

  state.lastEveningRecovery = {
    optionId: resolvedOption.id,
    label: resolvedOption.label,
    description: resolvedOption.description,
    effects: { ...effects },
    day: state.day
  };

  return resolvedOption;
}

function resolveOption(option, state) {
  return {
    ...option,
    label: replacePlaceholders(option.label, state),
    description: replacePlaceholders(option.description, state),
    effects: { ...option.effects }
  };
}

function applySpoonsChange(state, delta) {
  if (!state.resources || !state.resources.spoons) {
    return;
  }

  const spoons = state.resources.spoons;
  const max = Number(spoons.max) || 10;
  const current = Number(spoons.current) || 0;

  spoons.current = clamp(current + delta, 0, max);
}

function applyRelationshipChange(state, trustChange, frustrationChange) {
  if (!state.partner || !state.npcs) {
    return;
  }

  const npc = state.npcs[state.partner.id];

  if (!npc) {
    return;
  }

  if (typeof npc.trust === "number") {
    npc.trust = clamp(npc.trust + trustChange, 0, 100);
  }

  if (typeof npc.frustration === "number") {
    npc.frustration = clamp(npc.frustration + frustrationChange, 0, 100);
  }
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}
'''

write(Path("js/systems/eveningRecoverySystem.js"), evening_system)

# ---------------------------------------------------------------------------
# 3. eveningScreen.js
# ---------------------------------------------------------------------------

evening_screen = r'''// eveningScreen.js
//
// v0.9: evening recovery screen.
// Flow:
//   morning -> event -> reflection -> evening -> next morning

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery
} from "../../systems/eveningRecoverySystem.js";

export function renderEveningScreen(container) {
  const state = getState();

  const wrapper = document.createElement("div");
  wrapper.className = "screen evening-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczór";
  wrapper.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "evening-intro";
  intro.textContent = "Dzień już się wydarzył. Teraz zostaje pytanie, co robisz z resztką siebie.";
  wrapper.appendChild(intro);

  const resourceSummary = document.createElement("p");
  resourceSummary.className = "evening-resource-summary";
  resourceSummary.textContent = `Spoons: ${state.resources.spoons.current}/${state.resources.spoons.max}`;
  wrapper.appendChild(resourceSummary);

  const options = document.createElement("div");
  options.className = "evening-options";

  getEveningRecoveryOptions(state).forEach((option) => {
    options.appendChild(renderEveningOptionButton(option, state));
  });

  wrapper.appendChild(options);
  container.appendChild(wrapper);
}

function renderEveningOptionButton(option, state) {
  const button = document.createElement("button");
  button.className = "evening-option-button";

  const label = document.createElement("span");
  label.className = "evening-option-label";
  label.textContent = replacePlaceholders(option.label, state);
  button.appendChild(label);

  const description = document.createElement("span");
  description.className = "evening-option-description";
  description.textContent = replacePlaceholders(option.description, state);
  button.appendChild(description);

  const effects = document.createElement("span");
  effects.className = "evening-option-effects";
  effects.textContent = formatEffects(option.effects);
  button.appendChild(effects);

  button.addEventListener("click", () => {
    const currentState = getState();

    applyEveningRecovery(option.id, currentState);
    advanceToNextDay();
    saveGame(currentState);

    showScreen("game");
  });

  return button;
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatEffects(effects) {
  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSigned(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSigned(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSigned(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
'''

write(Path("js/ui/screens/eveningScreen.js"), evening_screen)

# ---------------------------------------------------------------------------
# 4. reflectionScreen.js clean overwrite, preserving fatigueChange if it exists
# ---------------------------------------------------------------------------

reflection_screen = r'''// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const wrapper = document.createElement("div");
  wrapper.className = "screen reflection-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczorna refleksja";
  wrapper.appendChild(title);

  const result = document.createElement("p");
  result.className = "reflection-text";
  result.textContent = resultText;
  wrapper.appendChild(result);

  if (consequences) {
    wrapper.appendChild(renderConsequences(consequences));
  }

  const summary = document.createElement("p");
  summary.className = "spoons-summary";
  summary.textContent = `Zostało Ci ${state.resources.spoons.current} z ${state.resources.spoons.max} spoons na dziś.`;
  wrapper.appendChild(summary);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button";
  endDayButton.textContent = "Zakończ dzień";
  endDayButton.addEventListener("click", () => {
    state.phase = "evening";
    showScreen("evening");
  });
  wrapper.appendChild(endDayButton);

  container.appendChild(wrapper);
}

function renderConsequences(consequences) {
  const section = document.createElement("div");
  section.className = "consequences";

  const heading = document.createElement("p");
  heading.className = "consequences-heading";
  heading.textContent = "Konsekwencje:";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "consequences-list";

  list.appendChild(buildConsequenceItem("Spoons", consequences.spoonsChange));
  list.appendChild(buildConsequenceItem("Zaufanie", consequences.trustChange));
  list.appendChild(buildConsequenceItem("Frustracja", consequences.frustrationChange));

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    list.appendChild(buildConsequenceItem("Przeciążenie", consequences.fatigueChange));
  }

  section.appendChild(list);

  const interpretation = buildInterpretation(consequences);
  if (interpretation) {
    const interpretationText = document.createElement("p");
    interpretationText.className = "consequences-interpretation";
    interpretationText.textContent = interpretation;
    section.appendChild(interpretationText);
  }

  return section;
}

function buildConsequenceItem(label, value) {
  const item = document.createElement("li");
  item.className = "consequences-item";

  const labelSpan = document.createElement("span");
  labelSpan.className = "consequences-label";
  labelSpan.textContent = `${label}:`;
  item.appendChild(labelSpan);

  const valueSpan = document.createElement("span");
  valueSpan.className = "consequences-value";
  valueSpan.textContent = formatSignedNumber(value);
  item.appendChild(valueSpan);

  return item;
}

function buildInterpretation(consequences) {
  const sentences = [];

  if (consequences.trustChange > 0) {
    sentences.push("Ta decyzja trochę wzmocniła poczucie bezpieczeństwa w relacji.");
  } else if (consequences.trustChange < 0) {
    sentences.push("Ta decyzja mogła zostawić w relacji trochę niepewności.");
  }

  if (consequences.frustrationChange > 0) {
    sentences.push("Frustracja partnera wzrosła.");
  } else if (consequences.frustrationChange < 0) {
    sentences.push("Napięcie trochę opadło.");
  }

  if (consequences.spoonsChange < 0) {
    sentences.push("Koszt tej decyzji poczujesz jeszcze dziś.");
  }

  if (consequences.fatigueChange > 0) {
    sentences.push("Ta decyzja zwiększyła przeciążenie, które przejdzie na kolejny dzień.");
  }

  if (sentences.length === 0) {
    return null;
  }

  return sentences.join(" ");
}

function formatSignedNumber(value) {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "0";
}
'''

write(Path("js/ui/screens/reflectionScreen.js"), reflection_screen)

# ---------------------------------------------------------------------------
# 5. Patch uiManager.js in place
# ---------------------------------------------------------------------------

def patch_ui_manager(text):
    if "renderEveningScreen" not in text:
        # Add import after reflection import if possible.
        text = re.sub(
            r'(import\s+\{\s*renderReflectionScreen\s*\}\s+from\s+"\.\/screens\/reflectionScreen\.js";\s*)',
            r'\1\nimport { renderEveningScreen } from "./screens/eveningScreen.js";',
            text,
            count=1
        )

        if "renderEveningScreen" not in text:
            # Fallback: add after last import.
            imports = list(re.finditer(r'^import .+;\s*$', text, flags=re.MULTILINE))
            if imports:
                i = imports[-1].end()
                text = text[:i] + '\nimport { renderEveningScreen } from "./screens/eveningScreen.js";' + text[i:]
            else:
                text = 'import { renderEveningScreen } from "./screens/eveningScreen.js";\n' + text

    if "evening: renderEveningScreen" not in text:
        # Add after reflection entry.
        text = re.sub(
            r'(reflection\s*:\s*renderReflectionScreen\s*,?)',
            r'\1\n  evening: renderEveningScreen,',
            text,
            count=1
        )

        if "evening: renderEveningScreen" not in text:
            print("BLAD: nie udalo sie dodac evening do obiektu screens w uiManager.js")
            sys.exit(1)

    return text

patch(Path("js/ui/uiManager.js"), patch_ui_manager)

# ---------------------------------------------------------------------------
# 6. Patch CSS in place
# ---------------------------------------------------------------------------

def patch_css(text):
    # Keep CSS clean from old message artifacts if present.
    text = re.sub(r"\n?\.npc-message\s*\{[^}]*\}\s*", "\n", text, flags=re.MULTILINE)
    text = re.sub(r"\n?\.partner-card\s+\.npc-message\s*\{[^}]*\}\s*", "\n", text, flags=re.MULTILINE)

    text = re.sub(
        r"/\* CLEAN v0\.9 evening recovery \*/[\s\S]*?/\* END CLEAN v0\.9 evening recovery \*/",
        "",
        text
    )

    text += r'''

/* CLEAN v0.9 evening recovery */
.evening-intro {
  color: var(--color-muted);
  font-style: italic;
  margin: 0 0 var(--space-md) 0;
}

.evening-resource-summary {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin: 0 0 var(--space-lg) 0;
}

.evening-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.evening-option-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  padding: 0.9rem 1rem;
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  color: var(--color-ink);
}

.evening-option-button:hover {
  border-color: var(--color-ink);
  background-color: var(--color-panel);
}

.evening-option-label {
  font-weight: 600;
}

.evening-option-description {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
}

.evening-option-effects {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-family: var(--font-display);
  font-weight: 600;
}
/* END CLEAN v0.9 evening recovery */
'''

    return text

patch(Path("css/style.css"), patch_css)

# ---------------------------------------------------------------------------
# 7. Cache bust index.html only
# ---------------------------------------------------------------------------

def patch_index(text):
    return re.sub(
        r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
        'src="./js/main.js?v=090"',
        text
    )

patch(Path("index.html"), patch_index)

# ---------------------------------------------------------------------------
# 8. Verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

checks = {
    "js/data/eveningRecoveryData.js": ["eveningRecoveryOptions", "sleep-early", "short-message"],
    "js/systems/eveningRecoverySystem.js": ["applyEveningRecovery", "lastEveningRecovery"],
    "js/ui/screens/eveningScreen.js": ["renderEveningScreen", "advanceToNextDay()", "saveGame(currentState)", "showScreen(\"game\")"],
    "js/ui/screens/reflectionScreen.js": ["showScreen(\"evening\")", "Zakończ dzień"],
    "js/ui/uiManager.js": ["renderEveningScreen", "evening: renderEveningScreen"],
    "css/style.css": [".evening-option-button", ".evening-option-effects"],
}

for rel, tokens in checks.items():
    content = (ROOT / rel).read_text(encoding="utf-8")
    for token in tokens:
        if token not in content:
            print(f"BLAD: {rel} nie zawiera {token}")
            sys.exit(1)

style_check = (ROOT / "css/style.css").read_text(encoding="utf-8")
if ".npc-message" in style_check:
    print("UWAGA: style.css nadal zawiera .npc-message. To nie blokuje gry, ale warto potem wyczyścić.")

print("OK: ekran wieczoru dodany.")
print("OK: reflection prowadzi do evening, nie do kolejnego dnia.")
print("OK: advanceToNextDay jest wywoływane dopiero po wyborze opcji wieczornej.")
print("OK: uiManager rejestruje ekran evening.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=090")
print("4. Ctrl+F5")
print("5. Nowa gra albo Kontynuuj")
print("")
print("Test:")
print("- event -> refleksja -> przycisk Zakończ dzień")
print("- powinien pojawić się ekran Wieczór")
print("- wybierz opcję")
print("- dopiero wtedy powinien zacząć się kolejny poranek")
