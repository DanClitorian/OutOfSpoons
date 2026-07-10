# apply_force_v0_5_7_restore_ui_manager.py
#
# Naprawa po błędzie "Nowa gra nic nie robi".
#
# Cofamy ryzykowny cache-bust wewnątrz importów ES modules.
# Zostawiamy tylko cache-bust na index.html -> main.js?v=057.
#
# Uruchom:
#   cd C:\OutOfSpoons
#   py .\apply_force_v0_5_7_restore_ui_manager.py

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

def write(rel, content):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

ui_manager = r'''// uiManager.js
//
// Centralny router ekranów.
// Restore-fix v0.5.7:
// - bez query-stringów w importach modułów,
// - pełna rejestracja ekranów,
// - aliasy dla nazw używanych w różnych wersjach projektu.

import { renderMainMenu } from "./screens/mainMenuScreen.js";
import { renderCharacterCreatorScreen } from "./screens/characterCreatorScreen.js";
import { renderGameScreen } from "./screens/gameScreen.js";
import { renderEventScreen } from "./screens/eventScreen.js";
import { renderReflectionScreen } from "./screens/reflectionScreen.js";

const app = document.getElementById("app");

const screens = {
  mainMenu: renderMainMenu,
  menu: renderMainMenu,

  characterCreator: renderCharacterCreatorScreen,
  "character-creator": renderCharacterCreatorScreen,

  game: renderGameScreen,
  morning: renderGameScreen,

  event: renderEventScreen,

  reflection: renderReflectionScreen
};

export function showScreen(screenName, data = null) {
  if (!app) {
    throw new Error("Nie znaleziono elementu #app w index.html.");
  }

  const render = screens[screenName];

  if (!render) {
    console.error("Nieznany ekran:", screenName, "Dostępne ekrany:", Object.keys(screens));
    app.innerHTML = "";
    const error = document.createElement("div");
    error.className = "screen";
    error.innerHTML = `
      <h2>Błąd ekranu</h2>
      <p>Nieznany ekran: ${screenName}</p>
      <button class="primary-button" id="back-to-menu">Wróć do menu</button>
    `;
    app.appendChild(error);

    const button = document.getElementById("back-to-menu");
    if (button) {
      button.addEventListener("click", () => showScreen("mainMenu"));
    }

    return;
  }

  app.innerHTML = "";
  render(app, data);
}
'''

game_screen = r'''// gameScreen.js
//
// Ekran poranka. Pokazuje stabilny stan gracza i partnera.
// Prawdziwe wydarzenie dnia pojawia się dopiero po kliknięciu przycisku.

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
  marker.textContent = "UI v0.5.7";
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
// Ekran wydarzenia dnia.
// Placeholder {partnerName} jest podmieniany w tytule, opisie i przyciskach.

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

write(Path("js/ui/uiManager.js"), ui_manager)
write(Path("js/ui/screens/gameScreen.js"), game_screen)
write(Path("js/ui/screens/eventScreen.js"), event_screen)

# Patch main.js import to no query-string.
main_path = require(Path("js/main.js"))
main = main_path.read_text(encoding="utf-8")
main = re.sub(
    r'from\s+["\'](?:\\\.)?\.\/ui\/uiManager\.js(?:\?v=[^"\']+)?["\']',
    'from "./ui/uiManager.js"',
    main
)
main = main.replace('from "\\./ui/uiManager.js?v=055"', 'from "./ui/uiManager.js"')
main = main.replace('from "\\./ui/uiManager.js?v=056"', 'from "./ui/uiManager.js"')
main = main.replace('from "\\./ui/uiManager.js"', 'from "./ui/uiManager.js"')
main_path.write_text(main, encoding="utf-8", newline="\n")
print("OK -> js/main.js")

# Patch possible query imports in screens.
for rel in [
    Path("js/ui/screens/mainMenuScreen.js"),
    Path("js/ui/screens/characterCreatorScreen.js"),
    Path("js/ui/screens/reflectionScreen.js"),
    Path("js/ui/screens/gameScreen_v055.js"),
    Path("js/ui/screens/eventScreen_v055.js"),
]:
    path = ROOT / rel
    if path.exists():
        text = path.read_text(encoding="utf-8")
        text = text.replace('../uiManager.js?v=055', '../uiManager.js')
        text = text.replace("../uiManager.js?v=055", "../uiManager.js")
        text = text.replace('../uiManager.js?v=056', '../uiManager.js')
        text = text.replace("../uiManager.js?v=056", "../uiManager.js")
        text = text.replace('\\../uiManager.js?v=055', '../uiManager.js')
        text = text.replace('\\../uiManager.js?v=056', '../uiManager.js')
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"OK -> {rel}")

# index.html cache-bust only on main.js.
index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=057"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# Styles.
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

main_check = main_path.read_text(encoding="utf-8")
ui_check = (ROOT / "js/ui/uiManager.js").read_text(encoding="utf-8")
game_check = (ROOT / "js/ui/screens/gameScreen.js").read_text(encoding="utf-8")
event_check = (ROOT / "js/ui/screens/eventScreen.js").read_text(encoding="utf-8")

if "?v=" in main_check:
    print("BLAD: main.js nadal ma query-string w imporcie.")
    sys.exit(1)

if "characterCreator" not in ui_check:
    print("BLAD: uiManager.js nie ma characterCreator.")
    sys.exit(1)

if "morningMessage" in game_check or "npc-message" in game_check:
    print("BLAD: gameScreen.js nadal zawiera morningMessage/npc-message.")
    sys.exit(1)

if r"text.replace(/\{partnerName\}/g, partnerName)" not in event_check:
    print("BLAD: eventScreen.js ma zly regex placeholdera.")
    sys.exit(1)

print("OK: uiManager zarejestrowal kreator postaci.")
print("OK: importy sa spojne.")
print("OK: gameScreen bez morning message.")
print("OK: eventScreen podmienia placeholdery.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. cd C:\\OutOfSpoons")
print("3. py -m http.server 8000")
print("4. otworz http://localhost:8000/?v=057")
print("5. Ctrl+F5")
print("6. kliknij Nowa gra")
