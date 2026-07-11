#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_hotfix_v0_17_2_restore_non_game_scroll.py

Hotfix dla Out of Spoons v0.17.1.

Problem:
v0.17.1 wymusił overflow:hidden globalnie na body/#app, przez co ekrany
nie-gameplayowe, szczególnie kreator postaci, nie mogą się przewijać.

Naprawa:
- przywraca scroll dla zwykłych ekranów,
- zostawia pełnoekranowy, niescrollujący layout tylko wtedy, gdy #app
  zawiera .vn-screen,
- podbija wersję do v0.17.2 i cache do ?v=172.
"""

import sys
from pathlib import Path

DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"

CSS_BLOCK = r"""
/* CLEAN HOTFIX v0.17.2 restore non-game scroll START */
/*
  v0.17.1 accidentally made the whole app non-scrollable.
  Character creator and menus need normal page scrolling.
  Only gameplay screens (.vn-screen) should behave like fixed full-screen boards.
*/

html,
body {
  height: auto !important;
  min-height: 100% !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

#app {
  height: auto !important;
  min-height: 100vh !important;
  overflow: visible !important;
  padding: 16px !important;
  box-sizing: border-box !important;
}

/* Fullscreen lock only for VN gameplay screens. Firefox/Chrome support :has(). */
#app:has(.vn-screen) {
  width: 100vw !important;
  height: 100vh !important;
  min-height: 100vh !important;
  margin: 0 !important;
  padding: 10px !important;
  overflow: hidden !important;
}

/* Keep VN board inside the viewport even though body scroll is restored globally. */
#app:has(.vn-screen) .vn-screen {
  height: calc(100vh - 20px) !important;
  max-height: calc(100vh - 20px) !important;
}

/* Non-game screens must remain usable. */
.screen:not(.vn-screen),
.character-creator-screen,
.main-menu-screen,
.settings-screen {
  max-height: none !important;
  overflow: visible !important;
}

/* Make forms usable if previous global rules touched them. */
.character-creator-screen input,
.character-creator-screen button,
.character-creator-screen label {
  position: relative !important;
}

/* CLEAN HOTFIX v0.17.2 restore non-game scroll END */
"""

def read_text(path):
    if not path.exists():
        raise FileNotFoundError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding="utf-8")

def write_text(path, text):
    path.write_text(text, encoding="utf-8")

def append_css(path):
    text = read_text(path)
    marker = "CLEAN HOTFIX v0.17.2 restore non-game scroll START"
    if marker in text:
        print("[pominieto] CSS hotfix v0.17.2 już obecny")
        return
    if not text.endswith("\n"):
        text += "\n"
    text += "\n" + CSS_BLOCK + "\n"
    write_text(path, text)
    print("[ok] Dodano CSS hotfix v0.17.2")

def replace_once_or_skip(path, old, new, label):
    text = read_text(path)
    if new in text:
        print(f"[pominieto] {label} już zastosowane")
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: oczekiwano 1 wystąpienia dla {label}, znaleziono {count}")
    write_text(path, text.replace(old, new, 1))
    print(f"[ok] {label}")

def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_PROJECT_ROOT)

    if not root.exists():
        raise RuntimeError(f"Nie znaleziono katalogu projektu: {root}")

    css = root / "css" / "style.css"
    version = root / "js" / "data" / "versionData.js"
    index = root / "index.html"

    append_css(css)

    replace_once_or_skip(
        version,
        'export const GAME_VERSION = "v0.17.1";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17.1";',
        'export const GAME_VERSION = "v0.17.2";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17.2";',
        "versionData v0.17.1 -> v0.17.2"
    )

    replace_once_or_skip(
        index,
        './js/main.js?v=171',
        './js/main.js?v=172',
        "cache bust ?v=171 -> ?v=172"
    )

    print("\nGotowe. Restart serwera + Ctrl+F5.")
    print("Kreator postaci powinien znowu przewijać się normalnie.")

if __name__ == "__main__":
    main()
