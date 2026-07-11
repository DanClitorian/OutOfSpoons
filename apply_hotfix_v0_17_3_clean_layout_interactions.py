#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_hotfix_v0_17_3_clean_layout_interactions.py

Hotfix dla Out of Spoons v0.17.2.

Naprawia:
- kreator postaci / menu wraca do wąskiego, przewijalnego layoutu,
- usuwa scroll-boxy z paska narracji w gameplay UI,
- narrative strip nie nachodzi na karty i nie blokuje kliknięć,
- dolny panel akcji dostaje pewny z-index i pointer-events,
- reflection screen ma kompaktowy układ consequence cards + CTA.

Nie rusza mechaniki gry.
"""

import sys
from pathlib import Path

DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"

CSS_BLOCK = r"""
/* CLEAN HOTFIX v0.17.3 clean layout interactions START */
/*
  v0.17.1/0.17.2 fixed the broad VN direction, but left three issues:
  1) non-game screens became too wide,
  2) old content was squeezed into narrative strip as scroll-boxes,
  3) narrative/action layers could overlap and block clicks.

  This block is intentionally later in CSS and overrides previous rules.
*/

/* --------------------------------------------------------------------
   1. Non-game screens: restore old narrow app layout
   -------------------------------------------------------------------- */

#app:not(:has(.vn-screen)) {
  width: 100% !important;
  max-width: 560px !important;
  min-height: auto !important;
  height: auto !important;
  margin: 0 auto !important;
  padding: 24px 16px 96px !important;
  box-sizing: border-box !important;
  overflow: visible !important;
  display: block !important;
}

#app:not(:has(.vn-screen)) .screen {
  width: 100% !important;
  max-width: 560px !important;
  margin: 0 auto !important;
  box-sizing: border-box !important;
  overflow: visible !important;
}

#app:not(:has(.vn-screen)) .character-creator-screen,
#app:not(:has(.vn-screen)) .main-menu-screen {
  max-width: 560px !important;
}

/* Inputs/check rows should not stretch to the whole viewport anymore. */
#app:not(:has(.vn-screen)) input[type="text"],
#app:not(:has(.vn-screen)) input:not([type]),
#app:not(:has(.vn-screen)) .trait-option,
#app:not(:has(.vn-screen)) label {
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* --------------------------------------------------------------------
   2. Gameplay board sizing: keep it game-like but safer
   -------------------------------------------------------------------- */

#app:has(.vn-screen) {
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 10px !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

#app:has(.vn-screen) .vn-screen {
  width: min(1360px, calc(100vw - 20px)) !important;
  height: calc(100vh - 20px) !important;
  max-height: calc(100vh - 20px) !important;
  margin: 0 auto !important;
  overflow: hidden !important;

  grid-template-columns: clamp(210px, 19vw, 270px) minmax(0, 1fr) !important;
  grid-template-rows: 52px minmax(0, 1fr) clamp(170px, 25vh, 220px) !important;
  grid-template-areas:
    "topbar topbar"
    "side stage"
    "actions actions" !important;
}

/* --------------------------------------------------------------------
   3. Stage: scene + narrative strip, no overlap with actions
   -------------------------------------------------------------------- */

.vn-stage {
  position: relative !important;
  z-index: 1 !important;
  grid-template-rows: minmax(0, 1fr) minmax(58px, auto) !important;
  gap: 8px !important;
  overflow: hidden !important;
}

.vn-scene-panel {
  min-height: 0 !important;
  height: 100% !important;
  z-index: 1 !important;
}

/* Remove the previous "floating over the scene" negative margin.
   It looked nice once, but it caused overlap and click problems. */
.vn-narrative-strip {
  position: relative !important;
  z-index: 2 !important;
  width: min(88%, 820px) !important;
  max-height: 88px !important;
  margin: 0 auto !important;
  overflow: hidden !important;
  pointer-events: none !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* Main narration only. Old sections inside narrative strip caused ugly
   horizontal scroll boxes and clipped partner/agenda cards. Hide them. */
.vn-narrative-strip .vn-compact-card {
  display: none !important;
}

.vn-narrative-text,
.vn-narrative-strip > p {
  max-width: 100% !important;
  -webkit-line-clamp: 3 !important;
  overflow: hidden !important;
}

/* --------------------------------------------------------------------
   4. Actions: always clickable, above decorative strips
   -------------------------------------------------------------------- */

.vn-actions {
  position: relative !important;
  z-index: 10 !important;
  pointer-events: auto !important;
  overflow: visible !important;
  padding: 4px 18px 8px !important;
}

.vn-actions *,
.vn-action-grid *,
.vn-action-stack *,
.choices *,
.evening-options * {
  pointer-events: auto !important;
}

.vn-action-grid,
.vn-action-stack,
.choices,
.evening-options,
.vn-consequence-grid {
  position: relative !important;
  z-index: 11 !important;
}

/* Event/agenda/evening cards should fit the bottom row. */
.vn-action-card,
.choice-button,
.vn-choice-button,
.agenda-choice-button,
.evening-option-button {
  min-height: 98px !important;
  max-height: 156px !important;
  overflow: hidden !important;
  padding: 11px 14px !important;
  gap: 5px !important;
}

/* For buttons with lots of description, clamp text instead of overflowing. */
.choice-cost,
.choice-unavailable-note,
.agenda-choice-description,
.agenda-choice-card-meta,
.agenda-choice-hint,
.evening-option-description,
.evening-option-effects {
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

/* --------------------------------------------------------------------
   5. Reflection: compact consequences + visible CTA
   -------------------------------------------------------------------- */

.vn-screen--reflection .vn-action-stack {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(190px, 280px) !important;
  gap: 14px !important;
  align-items: center !important;
  max-width: 1040px !important;
}

.vn-screen--reflection .reflection-impact-panel {
  height: 100% !important;
  max-height: 160px !important;
  min-width: 0 !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 8px 10px !important;
  box-sizing: border-box !important;
  background: transparent !important;
  border: 0 !important;
}

.vn-screen--reflection .reflection-impact-title {
  display: none !important;
}

.vn-screen--reflection .vn-consequence-grid {
  height: 100% !important;
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 10px !important;
  margin: 0 !important;
}

.vn-screen--reflection .vn-consequence-card {
  min-height: 92px !important;
  max-height: 128px !important;
  padding: 10px !important;
}

.vn-screen--reflection .consequences-interpretation,
.vn-screen--reflection .spoons-summary {
  display: none !important;
}

.vn-screen--reflection .reflection-day-progress {
  position: absolute !important;
  right: 10px !important;
  bottom: 4px !important;
  margin: 0 !important;
  font-size: 11px !important;
}

.vn-screen--reflection .primary-button.vn-choice-button {
  width: 100% !important;
  min-height: 82px !important;
  max-height: 120px !important;
  align-self: center !important;
}

/* --------------------------------------------------------------------
   6. Morning: hide old partner/agenda blocks in narrative strip completely
   -------------------------------------------------------------------- */

.vn-screen--morning .vn-narrative-strip {
  max-height: 82px !important;
}

.vn-screen--morning .vn-narrative-strip .partner-card,
.vn-screen--morning .vn-narrative-strip .daily-agenda,
.vn-screen--morning .vn-narrative-strip .morning-events,
.vn-screen--morning .vn-narrative-strip .previous-evening-summary,
.vn-screen--morning .vn-narrative-strip .persistent-spoons-note {
  display: none !important;
}

/* --------------------------------------------------------------------
   7. Laptop safeguards
   -------------------------------------------------------------------- */

@media (max-height: 790px) {
  #app:has(.vn-screen) .vn-screen {
    grid-template-rows: 48px minmax(0, 1fr) 165px !important;
    padding: 9px 13px 11px !important;
    gap: 9px 13px !important;
  }

  .vn-player-card {
    min-height: 270px !important;
  }

  .vn-scene-title-tab {
    font-size: clamp(16px, 1.6vw, 24px) !important;
    padding: 6px 18px !important;
  }

  .vn-narrative-strip {
    max-height: 70px !important;
    padding: 9px 14px !important;
  }

  .vn-action-card,
  .choice-button,
  .vn-choice-button,
  .agenda-choice-button,
  .evening-option-button {
    min-height: 86px !important;
    max-height: 132px !important;
    padding: 8px 10px !important;
  }

  .vn-screen--reflection .reflection-impact-panel {
    max-height: 136px !important;
  }

  .vn-screen--reflection .vn-consequence-card {
    min-height: 80px !important;
    max-height: 110px !important;
  }
}

/* CLEAN HOTFIX v0.17.3 clean layout interactions END */
"""

def read_text(path):
    if not path.exists():
        raise FileNotFoundError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding="utf-8")

def write_text(path, text):
    path.write_text(text, encoding="utf-8")

def append_css(path):
    text = read_text(path)
    marker = "CLEAN HOTFIX v0.17.3 clean layout interactions START"
    if marker in text:
        print("[pominieto] CSS hotfix v0.17.3 już obecny")
        return
    if not text.endswith("\n"):
        text += "\n"
    text += "\n" + CSS_BLOCK + "\n"
    write_text(path, text)
    print("[ok] Dodano CSS hotfix v0.17.3")

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
        'export const GAME_VERSION = "v0.17.2";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17.2";',
        'export const GAME_VERSION = "v0.17.3";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17.3";',
        "versionData v0.17.2 -> v0.17.3"
    )

    replace_once_or_skip(
        index,
        './js/main.js?v=172',
        './js/main.js?v=173',
        "cache bust ?v=172 -> ?v=173"
    )

    print("\nGotowe. Restart serwera + Ctrl+F5.")
    print("Sprawdź: kreator postaci, poranek, agenda, event, reflection.")

if __name__ == "__main__":
    main()
