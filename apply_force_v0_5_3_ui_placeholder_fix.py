r"""
apply_force_v0_5_3_ui_placeholder_fix.py

Force-fix v0.5.3 dla Out of Spoons.

Naprawia:
1. Morning message dalej widoczny na ekranie poranka.
2. Placeholder {partnerName} widoczny na przycisku wyboru.

Uruchom:
    cd C:\OutOfSpoons
    python apply_force_v0_5_3_ui_placeholder_fix.py

albo:
    py apply_force_v0_5_3_ui_placeholder_fix.py
"""

from pathlib import Path
import sys

ROOT = Path.cwd()

def require(path: str) -> Path:
    p = ROOT / path
    if not p.exists():
        print(f"BŁĄD: nie znaleziono {path}")
        print("Uruchom ten skrypt z folderu C:\\OutOfSpoons.")
        sys.exit(1)
    return p

def write(path: str, content: str):
    p = require(path)
    p.write_text(content, encoding="utf-8", newline="\n")
    print(f"OK -> {path}")

game_screen = """// gameScreen.js
//
// Ekran poranka: pokazuje aktualny dzień, imię gracza, stan spoons,
// zdanie statusu zależne od cech oraz kartę partnera.
// Prawdziwe wydarzenie dnia pojawia się dopiero po kliknięciu przycisku.
//
// Force-fix v0.5.3:
// - karta partnera NIE renderuje partner.morningMessage,
// - przycisk jasno prowadzi do wydarzenia dnia,
// - karta pokazuje stabilne informacje o partnerze, nie codzienną akcję.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

export function renderGameScreen(container) {
  const state = getState();
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const header = document.createElement("h2");
  header.textContent = `Dzień ${state.day} — ${playerName}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));

  if (state.player) {
    const statusSentence = document.createElement("p");
    statusSentence.className = "status-sentence";
    statusSentence.textContent = buildStatusSentence(state.player);
    wrapper.appendChild(statusSentence);
  }

  if (state.partner) {
    wrapper.appendChild(renderPartnerCard(state.partner));
  }

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Przejdź do wydarzenia dnia";
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

function renderPartnerCard(partner) {
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

  return card;
}
"""

event_screen = """// eventScreen.js
//
// Ekran wydarzenia decyzyjnego.
// Force-fix v0.5.3:
// - placeholder {partnerName} jest podmieniany w tytule, opisie
//   oraz labelkach przycisków wyboru.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();

  const wrapper = document.createElement("div");
  wrapper.className = "screen event-screen";

  const title = document.createElement("h2");
  title.textContent = replacePlaceholders(event.title, state);
  wrapper.appendChild(title);

  const description = document.createElement("p");
  description.textContent = replacePlaceholders(event.description, state);
  wrapper.appendChild(description);

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  event.choices.forEach((choice) => {
    choicesList.appendChild(renderChoiceButton(choice, state));
  });

  wrapper.appendChild(choicesList);
  container.appendChild(wrapper);
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\\{partnerName\\}/g, partnerName);
}

function renderChoiceButton(choice, state) {
  const button = document.createElement("button");
  button.className = "choice-button";

  const label = document.createElement("span");
  label.className = "choice-label";
  label.textContent = replacePlaceholders(choice.label, state);
  button.appendChild(label);

  if (choice.spoonsCost > 0) {
    const cost = document.createElement("span");
    cost.className = "choice-cost";
    cost.textContent = `− ${choice.spoonsCost} spoons`;
    button.appendChild(cost);
  }

  button.addEventListener("click", () => {
    resolveEvent(choice.id);
    showScreen("reflection");
  });

  return button;
}
"""

write("js/ui/screens/gameScreen.js", game_screen)
write("js/ui/screens/eventScreen.js", event_screen)

style_path = require("css/style.css")
style = style_path.read_text(encoding="utf-8")
if ".partner-communication-style" not in style:
    style += """

/* Force-fix v0.5.3 */
.partner-communication-style {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
  margin: 0;
}
"""
    style_path.write_text(style, encoding="utf-8", newline="\n")
    print("OK -> css/style.css")
else:
    print("OK -> css/style.css już zawiera .partner-communication-style")

game_text = require("js/ui/screens/gameScreen.js").read_text(encoding="utf-8")
event_text = require("js/ui/screens/eventScreen.js").read_text(encoding="utf-8")

print("")
print("Weryfikacja:")
if "partner.morningMessage" in game_text or "npc-message" in game_text:
    print("BŁĄD: gameScreen.js nadal zawiera morningMessage albo npc-message.")
    sys.exit(1)

if "replacePlaceholders(choice.label, state)" not in event_text:
    print("BŁĄD: eventScreen.js nie podmienia placeholderów w labelkach.")
    sys.exit(1)

print("OK: karta partnera nie renderuje morningMessage.")
print("OK: placeholder {partnerName} jest podmieniany w labelkach przycisków.")
print("")
print("Zatrzymaj serwer Ctrl+C, uruchom go ponownie i zrób Ctrl+F5.")
