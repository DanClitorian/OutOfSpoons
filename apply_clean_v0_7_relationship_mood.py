# apply_clean_v0_7_relationship_mood.py
#
# Clean v0.7 updater for Out of Spoons.
#
# Adds descriptive relationship mood under relationship bars.
#
# Does not restore morning messages.
# Does not touch partnerData.js, partnerSystem.js, eventData.js,
# eventSystem.js, dayCycle.js, saveManager.js, uiManager.js, main.js.
#
# It only overwrites:
# - js/ui/screens/gameScreen.js
# - css/style.css
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_clean_v0_7_relationship_mood.py

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

# Safety check: current project should already be v0.6-ish.
game_path = require(Path("js/ui/screens/gameScreen.js"))
game_before = game_path.read_text(encoding="utf-8")

if "relationship-meter" not in game_before:
    print("BLAD: gameScreen.js nie wyglada na wersje v0.6 z paskami relacji.")
    print("Uruchom najpierw czysty updater v0.6.")
    sys.exit(1)

game_screen = r'''// gameScreen.js
//
// Morning screen.
// Shows player state, partner card, relationship bars and relationship mood.
// The daily event starts only after clicking the main button.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

export function renderGameScreen(container) {
  const state = getState();
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const marker = document.createElement("p");
  marker.className = "debug-version-marker";
  marker.textContent = "UI v0.7";
  wrapper.appendChild(marker);

  const header = document.createElement("h2");
  header.textContent = `Dzie\u0144 ${state.day} \u2014 ${playerName}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));

  if (state.player) {
    const statusSentence = document.createElement("p");
    statusSentence.className = "status-sentence";
    statusSentence.textContent = buildStatusSentence(state.player);
    wrapper.appendChild(statusSentence);
  }

  if (state.partner) {
    const npc = state.npcs ? state.npcs[state.partner.id] : undefined;
    wrapper.appendChild(renderPartnerCard(state.partner, npc));
  }

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Przejd\u017a do wydarzenia dnia";
  continueButton.addEventListener("click", () => {
    goToEvent();
    showScreen("event");
  });
  wrapper.appendChild(continueButton);

  container.appendChild(wrapper);
}

function renderSpoonsMeter(spoons) {
  const meter = document.createElement("div");
  meter.className = "spoons-meter";

  const label = document.createElement("span");
  label.className = "spoons-label";
  label.textContent = `Spoons: ${spoons.current}/${spoons.max}`;
  meter.appendChild(label);

  const row = document.createElement("div");
  row.className = "spoons-row";

  for (let i = 0; i < spoons.max; i++) {
    const spoon = document.createElement("span");
    spoon.className = i < spoons.current ? "spoon full" : "spoon empty";
    row.appendChild(spoon);
  }

  meter.appendChild(row);
  return meter;
}

function renderPartnerCard(partner, npc) {
  const card = document.createElement("div");
  card.className = "partner-card";

  const name = document.createElement("p");
  name.className = "partner-name";
  name.textContent = partner.name;
  card.appendChild(name);

  const relationshipLabel = document.createElement("p");
  relationshipLabel.className = "partner-relationship-label";
  relationshipLabel.textContent = partner.relationshipLabel;
  card.appendChild(relationshipLabel);

  const summary = document.createElement("p");
  summary.className = "partner-relationship-summary";
  summary.textContent = partner.relationshipSummary;
  card.appendChild(summary);

  const communicationStyle = document.createElement("p");
  communicationStyle.className = "partner-communication-style";
  communicationStyle.textContent = `Styl komunikacji: ${partner.communicationStyle}`;
  card.appendChild(communicationStyle);

  card.appendChild(renderRelationshipState(npc));

  return card;
}

function renderRelationshipState(npc) {
  const section = document.createElement("div");
  section.className = "relationship-state";

  const heading = document.createElement("p");
  heading.className = "relationship-state-heading";
  heading.textContent = "Stan relacji";
  section.appendChild(heading);

  if (!npc) {
    const fallback = document.createElement("p");
    fallback.className = "relationship-state-empty";
    fallback.textContent = "Brak danych";
    section.appendChild(fallback);
    return section;
  }

  section.appendChild(renderRelationshipMeter("Zaufanie", npc.trust, "trust"));
  section.appendChild(renderRelationshipMeter("Frustracja", npc.frustration, "frustration"));
  section.appendChild(renderRelationshipMood(npc));

  return section;
}

function renderRelationshipMeter(label, value, modifier) {
  const safeValue = clampToPercentage(Number(value) || 0);

  const meter = document.createElement("div");
  meter.className = "relationship-meter";

  const labelEl = document.createElement("span");
  labelEl.className = "relationship-meter-label";
  labelEl.textContent = label;
  meter.appendChild(labelEl);

  const track = document.createElement("div");
  track.className = "relationship-meter-track";

  const fill = document.createElement("div");
  fill.className = `relationship-meter-fill relationship-meter-fill--${modifier}`;
  fill.style.width = `${safeValue}%`;
  track.appendChild(fill);
  meter.appendChild(track);

  const valueEl = document.createElement("span");
  valueEl.className = "relationship-meter-value";
  valueEl.textContent = `${safeValue}/100`;
  meter.appendChild(valueEl);

  return meter;
}

function renderRelationshipMood(npc) {
  const mood = buildRelationshipMood(npc);

  const moodSection = document.createElement("div");
  moodSection.className = "relationship-mood";

  const label = document.createElement("p");
  label.className = "relationship-mood-label";
  label.textContent = `Stan emocjonalny relacji: ${mood.label}`;
  moodSection.appendChild(label);

  const description = document.createElement("p");
  description.className = "relationship-mood-description";
  description.textContent = mood.description;
  moodSection.appendChild(description);

  return moodSection;
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

write(Path("js/ui/screens/gameScreen.js"), game_screen)

# Patch CSS without restoring removed message-related CSS.
style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

# Remove old unused message rules/comments if they still exist.
style = re.sub(r"\n?\.npc-message\s*\{[^}]*\}\s*", "\n", style, flags=re.MULTILINE)
style = re.sub(r"\n?\.partner-card\s+\.npc-message\s*\{[^}]*\}\s*", "\n", style, flags=re.MULTILINE)
style = re.sub(
    r"/\* v0\.5\.2:[\s\S]*?\.partner-communication-style\s*\{[\s\S]*?\}\s*",
    "",
    style
)

# Remove older clean v0.6/v0.7 blocks if present.
style = re.sub(
    r"/\* CLEAN v0\.6 relationship state \*/[\s\S]*?/\* END CLEAN v0\.6 relationship state \*/",
    "",
    style
)
style = re.sub(
    r"/\* CLEAN v0\.7 relationship mood \*/[\s\S]*?/\* END CLEAN v0\.7 relationship mood \*/",
    "",
    style
)

style += r'''

/* CLEAN v0.7 relationship state and mood */
.partner-communication-style {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
  margin: 0;
}

.relationship-state {
  margin-top: var(--space-md);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-line);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.relationship-state-heading {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 2px 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.relationship-state-empty {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
  margin: 0;
}

.relationship-meter {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.relationship-meter-label {
  flex: 0 0 auto;
  width: 5.5rem;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.relationship-meter-track {
  flex: 1 1 auto;
  height: 6px;
  background-color: var(--color-line);
  border-radius: 3px;
  overflow: hidden;
}

.relationship-meter-fill {
  height: 100%;
  background-color: var(--color-ink);
}

.relationship-meter-fill--trust {
  background-color: var(--color-sage);
}

.relationship-meter-fill--frustration {
  background-color: var(--color-rose);
}

.relationship-meter-value {
  flex: 0 0 auto;
  width: 3.2rem;
  text-align: right;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-ink);
}

.relationship-mood {
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px dotted var(--color-line);
}

.relationship-mood-label {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-ink);
  margin: 0 0 2px 0;
}

.relationship-mood-description {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-style: italic;
  margin: 0;
}

.debug-version-marker {
  color: var(--color-muted);
  font-size: 0.75rem;
  text-align: right;
  margin: 0 0 var(--space-sm) 0;
  opacity: 0.65;
}
/* END CLEAN v0.7 relationship mood */
'''

style_path.write_text(style, encoding="utf-8", newline="\n")
print("OK -> css/style.css")

# Cache bust only in index.html.
index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=070"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# Verification.
print("")
print("Weryfikacja:")

game_check = (ROOT / "js/ui/screens/gameScreen.js").read_text(encoding="utf-8")
style_check = (ROOT / "css/style.css").read_text(encoding="utf-8")

for bad in ["morningMessage", "npc-message", "pisze:"]:
    if bad in game_check:
        print(f"BLAD: gameScreen.js zawiera stary token: {bad}")
        sys.exit(1)

for token in [
    "buildRelationshipMood",
    "relationship-mood",
    "relationship-mood-label",
    "relationship-mood-description",
    "UI v0.7"
]:
    if token not in game_check and token not in style_check:
        print(f"BLAD: brak {token}")
        sys.exit(1)

print("OK: gameScreen czysty, bez stalej wiadomosci partnera.")
print("OK: opisowy stan relacji dodany.")
print("OK: CSS ma style relationship mood.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=070")
print("4. Ctrl+F5")
print("5. Nowa gra")
