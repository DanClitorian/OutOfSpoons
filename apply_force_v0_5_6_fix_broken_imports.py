# apply_force_v0_5_6_fix_broken_imports.py
#
# Naprawia błąd po v0.5.5: kliknięcie "Nowa gra" nic nie robi.
# Przyczyna: cache-buster mógł zostać wstawiony do importu jako "\./..."
# albo moduły importują uiManager pod niespójną ścieżką.
#
# Uruchom:
#   cd C:\OutOfSpoons
#   py .\apply_force_v0_5_6_fix_broken_imports.py

from pathlib import Path
import re
import sys

ROOT = Path.cwd()

def require(rel):
    path = ROOT / rel
    if not path.exists():
        print(f"BLAD: nie znaleziono {rel}")
        sys.exit(1)
    return path

def replace_in_file(rel, replacements):
    path = require(rel)
    text = path.read_text(encoding="utf-8")
    original = text

    for old, new in replacements:
        text = text.replace(old, new)

    path.write_text(text, encoding="utf-8", newline="\n")

    if text != original:
        print(f"OK -> {rel} poprawiony")
    else:
        print(f"OK -> {rel} bez zmian")

# 1. Napraw main.js: usuń potencjalny zły backslash w imporcie uiManager.
main_path = require(Path("js/main.js"))
main = main_path.read_text(encoding="utf-8")

main = main.replace('from "\\./ui/uiManager.js?v=055"', 'from "./ui/uiManager.js?v=056"')
main = main.replace("from '\\./ui/uiManager.js?v=055'", "from './ui/uiManager.js?v=056'")
main = main.replace('from "\\./ui/uiManager.js"', 'from "./ui/uiManager.js?v=056"')
main = main.replace("from '\\./ui/uiManager.js'", "from './ui/uiManager.js?v=056'")

main = main.replace('from "./ui/uiManager.js?v=055"', 'from "./ui/uiManager.js?v=056"')
main = main.replace("from './ui/uiManager.js?v=055'", "from './ui/uiManager.js?v=056'")
main = main.replace('from "./ui/uiManager.js"', 'from "./ui/uiManager.js?v=056"')
main = main.replace("from './ui/uiManager.js'", "from './ui/uiManager.js?v=056'")

main_path.write_text(main, encoding="utf-8", newline="\n")
print("OK -> js/main.js")

# 2. Napraw uiManager: ma importować nowe pliki UI v055.
ui_path = require(Path("js/ui/uiManager.js"))
ui = ui_path.read_text(encoding="utf-8")

ui = ui.replace("./screens/gameScreen.js", "./screens/gameScreen_v055.js")
ui = ui.replace('./screens/gameScreen.js', './screens/gameScreen_v055.js')
ui = ui.replace("./screens/eventScreen.js", "./screens/eventScreen_v055.js")
ui = ui.replace('./screens/eventScreen.js', './screens/eventScreen_v055.js')

ui_path.write_text(ui, encoding="utf-8", newline="\n")
print("OK -> js/ui/uiManager.js")

# 3. Napraw nowe screeny: import uiManager musi mieć ten sam cache-buster co main,
# bez backslasha.
for rel in [Path("js/ui/screens/gameScreen_v055.js"), Path("js/ui/screens/eventScreen_v055.js")]:
    if (ROOT / rel).exists():
        p = require(rel)
        text = p.read_text(encoding="utf-8")
        text = text.replace('from "../uiManager.js?v=055"', 'from "../uiManager.js?v=056"')
        text = text.replace("from '../uiManager.js?v=055'", "from '../uiManager.js?v=056'")
        text = text.replace('from "../uiManager.js"', 'from "../uiManager.js?v=056"')
        text = text.replace("from '../uiManager.js'", "from '../uiManager.js?v=056'")
        text = text.replace('from "\\../uiManager.js?v=055"', 'from "../uiManager.js?v=056"')
        text = text.replace("from '\\../uiManager.js?v=055'", "from '../uiManager.js?v=056'")
        p.write_text(text, encoding="utf-8", newline="\n")
        print(f"OK -> {rel}")

# 4. index.html: wymuś nową wersję main.js.
index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")

index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=056"',
    index
)

index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# 5. Minimalna weryfikacja.
main_check = main_path.read_text(encoding="utf-8")
ui_check = ui_path.read_text(encoding="utf-8")

print("")
print("Weryfikacja:")

if "\\./ui/uiManager" in main_check:
    print("BLAD: main.js nadal zawiera zly import z backslashem.")
    sys.exit(1)

if "uiManager.js?v=056" not in main_check:
    print("BLAD: main.js nie importuje uiManager.js?v=056.")
    sys.exit(1)

if "gameScreen_v055.js" not in ui_check:
    print("BLAD: uiManager.js nie importuje gameScreen_v055.js.")
    sys.exit(1)

print("OK: importy naprawione.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. cd C:\\OutOfSpoons")
print("3. py -m http.server 8000")
print("4. otworz http://localhost:8000/?v=056")
print("5. Ctrl+F5")
print("6. sprawdz czy widzisz UI v0.5.5 i czy Nowa gra dziala")
