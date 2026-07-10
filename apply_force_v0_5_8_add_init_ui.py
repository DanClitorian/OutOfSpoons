# apply_force_v0_5_8_add_init_ui.py
#
# Naprawia błąd:
# Uncaught SyntaxError: uiManager.js doesn't provide an export named: 'initUI'
#
# Uruchom:
#   cd C:\OutOfSpoons
#   py .\apply_force_v0_5_8_add_init_ui.py

from pathlib import Path
import sys

ROOT = Path.cwd()

ui_path = ROOT / "js" / "ui" / "uiManager.js"

if not ui_path.exists():
    print("BLAD: nie znaleziono js/ui/uiManager.js")
    print("Uruchom skrypt z folderu C:\\OutOfSpoons.")
    sys.exit(1)

content = r'''// uiManager.js
//
// Centralny router ekranów.
// Restore-fix v0.5.8:
// - eksportuje initUI(), którego oczekuje main.js,
// - eksportuje showScreen(),
// - rejestruje wszystkie ekrany,
// - bez query-stringów w importach modułów.

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

export function initUI() {
  showScreen("mainMenu");
}

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

    app.appendChild(error);
    return;
  }

  app.innerHTML = "";
  render(app, data);
}
'''

ui_path.write_text(content, encoding="utf-8", newline="\n")
print("OK -> js/ui/uiManager.js")

main_path = ROOT / "js" / "main.js"
if main_path.exists():
    main = main_path.read_text(encoding="utf-8")
    print("")
    print("main.js:")
    if "initUI" in main:
        print("OK: main.js oczekuje initUI.")
    else:
        print("UWAGA: main.js nie zawiera initUI, ale to nie szkodzi.")

print("")
print("Weryfikacja:")
check = ui_path.read_text(encoding="utf-8")
if "export function initUI" not in check:
    print("BLAD: initUI nie zostalo dodane.")
    sys.exit(1)

if "export function showScreen" not in check:
    print("BLAD: showScreen nie istnieje.")
    sys.exit(1)

print("OK: uiManager eksportuje initUI i showScreen.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=058")
print("4. Ctrl+F5")
