# apply_force_v0_5_9_nuke_morning_messages.py
#
# Usuwa morningMessage jako mechanike/dane z aktywnej gry.
#
# Naprawia sytuacje, w ktorej wiadomosc typu:
#   "Ola pisze: ..."
# nadal pojawia sie kazdego dnia.
#
# Robi:
# 1. partnerData.js: morningMessageTemplates = []
# 2. partnerSystem.js: partner NIE dostaje pola morningMessage
# 3. gameScreen.js: karta partnera NIE ma zadnego renderowania wiadomosci
# 4. index.html: main.js?v=059, zeby wymusic nowy start modulu
#
# Uruchom:
#   cd C:\OutOfSpoons
#   py .\apply_force_v0_5_9_nuke_morning_messages.py

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

# 1. partnerData.js: wyzeruj morningMessageTemplates.
partner_data_path = require(Path("js/data/partnerData.js"))
partner_data = partner_data_path.read_text(encoding="utf-8")

partner_data = re.sub(
    r"export const morningMessageTemplates\s*=\s*\[[\s\S]*?\];",
    "export const morningMessageTemplates = [];",
    partner_data
)

partner_data_path.write_text(partner_data, encoding="utf-8", newline="\n")
print("OK -> js/data/partnerData.js")

# 2. partnerSystem.js: usun import morningMessageTemplates, const morningMessage i pole morningMessage.
partner_system_path = require(Path("js/systems/partnerSystem.js"))
partner_system = partner_system_path.read_text(encoding="utf-8")

partner_system = partner_system.replace("  morningMessageTemplates\n", "")
partner_system = partner_system.replace("  morningMessageTemplates,\n", "")
partner_system = partner_system.replace(",\n  morningMessageTemplates", "")
partner_system = partner_system.replace(", morningMessageTemplates", "")

partner_system = re.sub(
    r"\n\s*const morningMessage\s*=\s*pickRandom\(morningMessageTemplates\)\.replace\(\" \{name\}\", nameEntry\.name\);\n",
    "\n",
    partner_system
)

partner_system = re.sub(
    r"\n\s*const morningMessage\s*=\s*pickRandom\(morningMessageTemplates\)\.replace\(\" \{name\}\", name\);\n",
    "\n",
    partner_system
)

partner_system = re.sub(
    r"\n\s*const morningMessage\s*=\s*pickRandom\(morningMessageTemplates\)\.replace\(\"{name}\", nameEntry\.name\);\n",
    "\n",
    partner_system
)

partner_system = re.sub(
    r"\n\s*const morningMessage\s*=\s*pickRandom\(morningMessageTemplates\)\.replace\(\"{name}\", name\);\n",
    "\n",
    partner_system
)

partner_system = partner_system.replace(",\n    morningMessage", "")
partner_system = partner_system.replace("\n    morningMessage,", "")
partner_system = partner_system.replace("\n    morningMessage", "")

partner_system_path.write_text(partner_system, encoding="utf-8", newline="\n")
print("OK -> js/systems/partnerSystem.js")

# 3. gameScreen.js: pelny, czysty ekran poranka bez wiadomosci.
game_screen = r'''// gameScreen.js
//
// Ekran poranka. Pokazuje stabilny stan gracza i partnera.
// Nie pokazuje zadnej codziennej wiadomosci partnera.
// Wydarzenie dnia zaczyna sie dopiero po kliknieciu przycisku.

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
  marker.textContent = "UI v0.5.9";
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

write(Path("js/ui/screens/gameScreen.js"), game_screen)

# 4. index.html: cache bust main.
index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=059"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# 5. style marker if needed.
style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

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

# 6. Weryfikacja aktywnych plikow.
print("")
print("Weryfikacja:")

active_files = [
    Path("js/ui/screens/gameScreen.js"),
    Path("js/systems/partnerSystem.js"),
    Path("js/data/partnerData.js"),
]

for rel in active_files:
    text = (ROOT / rel).read_text(encoding="utf-8")
    if rel.name == "gameScreen.js":
        if "morningMessage" in text or "npc-message" in text or "pisze:" in text:
            print(f"BLAD: {rel} nadal zawiera wiadomosc.")
            sys.exit(1)
    if rel.name == "partnerSystem.js":
        if "morningMessage" in text:
            print(f"BLAD: {rel} nadal tworzy morningMessage.")
            sys.exit(1)
    if rel.name == "partnerData.js":
        if "pisze:" in text:
            print(f"BLAD: {rel} nadal zawiera teksty wiadomosci.")
            sys.exit(1)

print("OK: aktywny gameScreen nie renderuje wiadomosci.")
print("OK: partnerSystem nie tworzy morningMessage.")
print("OK: partnerData nie zawiera wiadomosci typu 'pisze'.")
print("")
print("Teraz koniecznie:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=059")
print("4. Ctrl+F5")
print("5. kliknij Nowa gra")
print("6. na poranku musi byc UI v0.5.9")
