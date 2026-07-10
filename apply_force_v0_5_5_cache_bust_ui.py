# apply_force_v0_5_5_cache_bust_ui.py
#
# Force-fix v0.5.5 dla Out of Spoons.
#
# Problem:
# Aktywne pliki js/ui/screens nie renderuja juz morningMessage,
# ale przegladarka nadal pokazuje stary ekran. To wskazuje na cache
# modulu ES albo import starej sciezki.
#
# Naprawa:
# 1. Tworzy nowe pliki:
#    - js/ui/screens/gameScreen_v055.js
#    - js/ui/screens/eventScreen_v055.js
# 2. Patchuje js/ui/uiManager.js, zeby importowal nowe pliki.
# 3. Patchuje js/main.js, zeby import uiManager mial cache-buster ?v=055.
# 4. Patchuje index.html, zeby script src do main.js mial ?v=055.
#
# Uruchom:
#   cd C:\OutOfSpoons
#   py .\apply_force_v0_5_5_cache_bust_ui.py

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

game_screen = r'''// gameScreen_v055.js
//
// Cache-busted morning screen.
// This file intentionally has a new filename so the browser cannot reuse
// an older cached gameScreen.js module.

import { showScreen } from "../uiManager.js?v=055";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

export function renderGameScreen(container) {
  const state = getState();
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const versionMarker = document.createElement("p");
  versionMarker.className = "debug-version-marker";
  versionMarker.textContent = "UI v0.5.5";
  wrapper.appendChild(versionMarker);

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

event_screen = r'''// eventScreen_v055.js
//
// Cache-busted daily event screen.
// Replaces placeholders in title, description and choice labels.

import { showScreen } from "../uiManager.js?v=055";
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

write(Path("js/ui/screens/gameScreen_v055.js"), game_screen)
write(Path("js/ui/screens/eventScreen_v055.js"), event_screen)

# Patch uiManager imports
ui_path = require(Path("js/ui/uiManager.js"))
ui = ui_path.read_text(encoding="utf-8")

ui = ui.replace('./screens/gameScreen.js', './screens/gameScreen_v055.js')
ui = ui.replace("./screens/gameScreen.js", "./screens/gameScreen_v055.js")
ui = ui.replace('./screens/eventScreen.js', './screens/eventScreen_v055.js')
ui = ui.replace("./screens/eventScreen.js", "./screens/eventScreen_v055.js")

ui_path.write_text(ui, encoding="utf-8", newline="\n")
print("OK -> js/ui/uiManager.js")

# Patch main.js import of uiManager with cache buster
main_path = require(Path("js/main.js"))
main = main_path.read_text(encoding="utf-8")

main = re.sub(r'(["\'])\.\/ui\/uiManager\.js(?:\?v=[^"\']+)?\1', r'"\./ui/uiManager.js?v=055"', main)

main_path.write_text(main, encoding="utf-8", newline="\n")
print("OK -> js/main.js")

# Patch index.html script src to main.js?v=055
index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")

index = re.sub(r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1', 'src="./js/main.js?v=055"', index)

index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# Ensure debug marker style
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

if ".debug-version-marker" not in style:
    style += r'''

.debug-version-marker {
  color: var(--color-muted);
  font-size: 0.75rem;
  text-align: right;
  margin: 0 0 var(--space-sm) 0;
  opacity: 0.65;
}
'''

style_path.write_text(style, encoding="utf-8", newline="\n")
print("OK -> css/style.css")

print("")
print("Weryfikacja:")
fresh_game = (ROOT / "js/ui/screens/gameScreen_v055.js").read_text(encoding="utf-8")
fresh_event = (ROOT / "js/ui/screens/eventScreen_v055.js").read_text(encoding="utf-8")
ui_check = ui_path.read_text(encoding="utf-8")
index_check = index_path.read_text(encoding="utf-8")

if "morningMessage" in fresh_game or "npc-message" in fresh_game:
    print("BLAD: nowy gameScreen_v055 nadal zawiera morningMessage/npc-message.")
    sys.exit(1)

if "gameScreen_v055.js" not in ui_check or "eventScreen_v055.js" not in ui_check:
    print("BLAD: uiManager.js nie importuje nowych plikow.")
    sys.exit(1)

if "main.js?v=055" not in index_check:
    print("UWAGA: index.html moze nie miec cache bustera main.js?v=055.")
else:
    print("OK: index.html laduje main.js?v=055.")

if r"text.replace(/\{partnerName\}/g, partnerName)" not in fresh_event:
    print("BLAD: eventScreen_v055 ma zly regex placeholdera.")
    sys.exit(1)

print("OK: UI uzywa nowych nazw plikow.")
print("OK: gameScreen_v055 nie renderuje morning message.")
print("OK: eventScreen_v055 podmienia placeholdery.")
print("")
print("Teraz koniecznie:")
print("1. zatrzymaj serwer Ctrl+C")
print("2. uruchom: py -m http.server 8000")
print("3. wejdz na: http://localhost:8000/?v=055")
print("4. Ctrl+F5")
print("5. Nowa gra")
