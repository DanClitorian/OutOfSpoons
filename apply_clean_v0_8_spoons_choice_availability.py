# apply_clean_v0_8_spoons_choice_availability.py
#
# Clean v0.8 updater for Out of Spoons.
#
# Adds choice availability based on current spoons:
# - shows "Dostepne spoons: X/Y" on event screen
# - disables choices the player cannot afford
# - if all choices are too expensive, keeps the cheapest choice clickable
#   as "ostatnia dostepna opcja"
#
# Does not touch:
# - gameScreen.js
# - partnerData.js
# - partnerSystem.js
# - eventData.js
# - eventSystem.js
# - dayCycle.js
# - saveManager.js
# - uiManager.js
# - main.js
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_clean_v0_8_spoons_choice_availability.py

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
    path = require(rel)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

event_path = require(Path("js/ui/screens/eventScreen.js"))
event_before = event_path.read_text(encoding="utf-8")

if "getCurrentEvent" not in event_before:
    print("BLAD: eventScreen.js nie wyglada na wersje v0.4+.")
    print("Brak getCurrentEvent.")
    sys.exit(1)

event_screen = r'''// eventScreen.js
//
// Daily event screen.
// v0.8:
// - shows current spoons before choices,
// - disables choices that cost more spoons than the player has,
// - if every choice is too expensive, keeps the cheapest one clickable
//   as the final available option,
// - replaces {partnerName} in title, description and choice labels.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const maxSpoons = state.resources.spoons.max;

  const wrapper = document.createElement("div");
  wrapper.className = "screen event-screen";

  wrapper.appendChild(renderResourceSummary(currentSpoons, maxSpoons));

  const title = document.createElement("h2");
  title.textContent = replacePlaceholders(event.title, state);
  wrapper.appendChild(title);

  const description = document.createElement("p");
  description.textContent = replacePlaceholders(event.description, state);
  wrapper.appendChild(description);

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  event.choices.forEach((choice) => {
    const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
    choicesList.appendChild(renderChoiceButton(choice, state, currentSpoons, isForced));
  });

  wrapper.appendChild(choicesList);
  container.appendChild(wrapper);
}

function renderResourceSummary(currentSpoons, maxSpoons) {
  const summary = document.createElement("p");
  summary.className = "event-resource-summary";
  summary.textContent = `Dost\u0119pne spoons: ${currentSpoons}/${maxSpoons}`;
  return summary;
}

function getCheapestChoice(choices) {
  return choices.reduce((cheapest, choice) =>
    choice.spoonsCost < cheapest.spoonsCost ? choice : cheapest
  );
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function renderChoiceButton(choice, state, currentSpoons, isForced) {
  const button = document.createElement("button");
  const canAfford = choice.spoonsCost <= currentSpoons;
  const isDisabled = !canAfford && !isForced;

  button.className = buildChoiceButtonClass(isDisabled, isForced);

  const label = document.createElement("span");
  label.className = "choice-label";
  label.textContent = replacePlaceholders(choice.label, state);
  button.appendChild(label);

  const cost = renderChoiceCost(choice, currentSpoons, isDisabled, isForced);
  if (cost) {
    button.appendChild(cost);
  }

  button.disabled = isDisabled;

  if (!isDisabled) {
    button.addEventListener("click", () => {
      resolveEvent(choice.id);
      showScreen("reflection");
    });
  }

  return button;
}

function buildChoiceButtonClass(isDisabled, isForced) {
  const classes = ["choice-button"];

  if (isDisabled) {
    classes.push("choice-button--disabled");
  }

  if (isForced) {
    classes.push("choice-button--forced");
  }

  return classes.join(" ");
}

function renderChoiceCost(choice, currentSpoons, isDisabled, isForced) {
  if (choice.spoonsCost <= 0) {
    return null;
  }

  const cost = document.createElement("span");
  cost.className = "choice-cost";
  cost.textContent = `\u2212 ${choice.spoonsCost} spoons`;

  if (isDisabled) {
    const missing = Math.max(0, choice.spoonsCost - currentSpoons);
    cost.appendChild(renderChoiceNote(` · brakuje ${missing} spoons`));
  } else if (isForced) {
    cost.appendChild(renderChoiceNote(" · ostatnia dost\u0119pna opcja"));
  }

  return cost;
}

function renderChoiceNote(text) {
  const note = document.createElement("span");
  note.className = "choice-unavailable-note";
  note.textContent = text;
  return note;
}
'''

write(Path("js/ui/screens/eventScreen.js"), event_screen)

style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

# Keep CSS clean from old unused message UI.
style = re.sub(r"\n?\.npc-message\s*\{[^}]*\}\s*", "\n", style, flags=re.MULTILINE)
style = re.sub(r"\n?\.partner-card\s+\.npc-message\s*\{[^}]*\}\s*", "\n", style, flags=re.MULTILINE)

# Remove earlier clean v0.8 block, then append current one.
style = re.sub(
    r"/\* CLEAN v0\.8 spoons choice availability \*/[\s\S]*?/\* END CLEAN v0\.8 spoons choice availability \*/",
    "",
    style
)

style += r'''

/* CLEAN v0.8 spoons choice availability */
.event-resource-summary {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin: 0 0 var(--space-md) 0;
}

.choice-button--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.choice-button--disabled:hover {
  border-color: var(--color-line);
  background-color: var(--color-paper);
}

.choice-button--forced {
  border-color: var(--color-muted);
  border-style: dashed;
}

.choice-unavailable-note {
  color: var(--color-muted);
  font-weight: 400;
  font-style: italic;
}
/* END CLEAN v0.8 spoons choice availability */
'''

style_path.write_text(style, encoding="utf-8", newline="\n")
print("OK -> css/style.css")

index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=080"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

print("")
print("Weryfikacja:")

event_check = (ROOT / "js/ui/screens/eventScreen.js").read_text(encoding="utf-8")
style_check = (ROOT / "css/style.css").read_text(encoding="utf-8")

required_event_tokens = [
    "event-resource-summary",
    "choice-button--disabled",
    "choice-button--forced",
    "choice-unavailable-note",
    "getCheapestChoice",
    "replacePlaceholders(choice.label, state)"
]

for token in required_event_tokens:
    if token not in event_check:
        print(f"BLAD: eventScreen.js nie zawiera {token}")
        sys.exit(1)

required_style_tokens = [
    ".event-resource-summary",
    ".choice-button--disabled",
    ".choice-button--forced",
    ".choice-unavailable-note"
]

for token in required_style_tokens:
    if token not in style_check:
        print(f"BLAD: style.css nie zawiera {token}")
        sys.exit(1)

if "morningMessage" in event_check or "pisze:" in event_check:
    print("BLAD: eventScreen.js zawiera stary tekst wiadomosci.")
    sys.exit(1)

print("OK: eventScreen kontroluje dostepnosc wyborow po spoons.")
print("OK: placeholdery w labelkach wyborow sa podmieniane.")
print("OK: style v0.8 dodane bez cofania porzadkow.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=080")
print("4. Ctrl+F5")
print("5. Nowa gra")
