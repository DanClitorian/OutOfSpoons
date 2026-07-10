# apply_hotfix_v0_9_1_fix_ui_manager_syntax.py
#
# Fixes:
#   Uncaught SyntaxError: missing } after property list uiManager.js
#
# Cause:
# v0.9 patch inserted the evening screen into the screens object incorrectly.
#
# This script overwrites ONLY:
# - js/ui/uiManager.js
# - index.html cache-bust
#
# It keeps:
# - initUI
# - showScreen
# - all screen aliases used by previous versions
# - evening screen registration
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_hotfix_v0_9_1_fix_ui_manager_syntax.py

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

# Safety checks.
require(Path("js/ui/screens/mainMenuScreen.js"))
require(Path("js/ui/screens/characterCreatorScreen.js"))
require(Path("js/ui/screens/gameScreen.js"))
require(Path("js/ui/screens/eventScreen.js"))
require(Path("js/ui/screens/reflectionScreen.js"))
require(Path("js/ui/screens/eveningScreen.js"))

ui_manager = r'''// uiManager.js
//
// Centralny router ekranów.
// Hotfix v0.9.1:
// - naprawia składnię obiektu screens,
// - rejestruje ekran evening,
// - zachowuje initUI i showScreen,
// - wspiera stare aliasy nazw ekranów.

import { renderMainMenu } from "./screens/mainMenuScreen.js";
import { renderCharacterCreatorScreen } from "./screens/characterCreatorScreen.js";
import { renderGameScreen } from "./screens/gameScreen.js";
import { renderEventScreen } from "./screens/eventScreen.js";
import { renderReflectionScreen } from "./screens/reflectionScreen.js";
import { renderEveningScreen } from "./screens/eveningScreen.js";

let appContainer = null;

const screens = {
  mainMenu: renderMainMenu,
  menu: renderMainMenu,

  characterCreator: renderCharacterCreatorScreen,
  "character-creator": renderCharacterCreatorScreen,

  game: renderGameScreen,
  morning: renderGameScreen,

  event: renderEventScreen,
  reflection: renderReflectionScreen,
  evening: renderEveningScreen
};

export function initUI(rootElementId = "app") {
  appContainer = document.getElementById(rootElementId);

  if (!appContainer) {
    console.error(`Nie znaleziono elementu #${rootElementId}.`);
    return;
  }
}

export function showScreen(screenName, data = null) {
  if (!appContainer) {
    appContainer = document.getElementById("app");
  }

  if (!appContainer) {
    console.error("UI Manager nie został zainicjalizowany i nie znaleziono #app.");
    return;
  }

  const render = screens[screenName];

  if (!render) {
    console.error("Nieznany ekran:", screenName, "Dostępne ekrany:", Object.keys(screens));

    appContainer.innerHTML = "";

    const error = document.createElement("div");
    error.className = "screen";

    const title = document.createElement("h2");
    title.textContent = "Błąd ekranu";
    error.appendChild(title);

    const text = document.createElement("p");
    text.textContent = `Nieznany ekran: ${screenName}`;
    error.appendChild(text);

    const button = document.createElement("button");
    button.className = "primary-button";
    button.textContent = "Wróć do menu";
    button.addEventListener("click", () => showScreen("mainMenu"));
    error.appendChild(button);

    appContainer.appendChild(error);
    return;
  }

  appContainer.innerHTML = "";
  render(appContainer, data);
}
'''

write(Path("js/ui/uiManager.js"), ui_manager)

# Cache bust index.html only.
index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=091"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# Verification.
print("")
print("Weryfikacja:")

check = (ROOT / "js/ui/uiManager.js").read_text(encoding="utf-8")

required = [
    "renderEveningScreen",
    "evening: renderEveningScreen",
    "export function initUI",
    "export function showScreen",
    "characterCreator: renderCharacterCreatorScreen",
    "morning: renderGameScreen"
]

for token in required:
    if token not in check:
        print(f"BLAD: uiManager.js nie zawiera {token}")
        sys.exit(1)

# Very simple structural check for the screens object.
if "reflection: renderReflectionScreen,\n  evening: renderEveningScreen" not in check:
    print("BLAD: screens object nie ma poprawnego przecinka przed evening.")
    sys.exit(1)

print("OK: uiManager.js ma poprawny screens object.")
print("OK: evening screen jest zarejestrowany.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=091")
print("4. Ctrl+F5")
print("5. test: event -> refleksja -> Zakończ dzień -> Wieczór")
