
# apply_force_v0_5_4_encoding_and_placeholder_fix.py
#
# Force-fix v0.5.4 dla Out of Spoons.
#
# Naprawia:
# 1. gameScreen.js bez renderowania morning message.
# 2. eventScreen.js z poprawna podmiana {partnerName} w tytule, opisie i przyciskach.
# 3. Teksty UI zapisane jako Unicode escape sequences, zeby uniknac krzakow.
#
# Uruchom:
#     cd C:\OutOfSpoons
#     py .\apply_force_v0_5_4_encoding_and_placeholder_fix.py

from pathlib import Path
import sys

ROOT = Path.cwd()

def require(relative_path):
    path = ROOT / relative_path
    if not path.exists():
        print(f"BLAD: nie znaleziono {relative_path}")
        print("Uruchom skrypt z folderu C:\\OutOfSpoons.")
        sys.exit(1)
    return path

def write(relative_path, content):
    path = require(relative_path)
    path.write_text(content, encoding="utf-8", newline="\n")
    print(f"OK -> {relative_path}")

game_screen = r'''// gameScreen.js
//
// Morning screen. Shows stable player/partner state.
// Daily event starts only after clicking the main button.

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
    wrapper.appendChild(renderPartnerCard(state.partner));
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
'''

event_screen = r'''// eventScreen.js
//
// Daily event screen.
// Replaces placeholders in title, description and choice labels.

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
  return text.replace(/\{partnerName\}/g, partnerName);
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
    cost.textContent = `\u2212 ${choice.spoonsCost} spoons`;
    button.appendChild(cost);
  }

  button.addEventListener("click", () => {
    resolveEvent(choice.id);
    showScreen("reflection");
  });

  return button;
}
'''

write(Path("js/ui/screens/gameScreen.js"), game_screen)
write(Path("js/ui/screens/eventScreen.js"), event_screen)

style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")
if ".partner-communication-style" not in style:
    style += r'''

.partner-communication-style {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
  margin: 0;
}
'''
    style_path.write_text(style, encoding="utf-8", newline="\n")
    print("OK -> css/style.css")
else:
    print("OK -> css/style.css")

game_text = require(Path("js/ui/screens/gameScreen.js")).read_text(encoding="utf-8")
event_text = require(Path("js/ui/screens/eventScreen.js")).read_text(encoding="utf-8")

print("")
print("Weryfikacja:")
if "morningMessage" in game_text or "npc-message" in game_text:
    print("BLAD: gameScreen.js nadal zawiera stary kod/tekst.")
    sys.exit(1)

if r"text.replace(/\{partnerName\}/g, partnerName)" not in event_text:
    print("BLAD: eventScreen.js ma zly regex placeholdera.")
    sys.exit(1)

print("OK: gameScreen nie zawiera morningMessage ani npc-message.")
print("OK: eventScreen ma poprawny regex placeholdera.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. w przegladarce Ctrl+F5")
print("4. najlepiej Nowa gra")
