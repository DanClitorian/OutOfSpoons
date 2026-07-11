#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_hotfix_v0_17_1_force_mockup_layout.py

Hotfix dla Out of Spoons v0.17.

Problem:
v0.17 technicznie podpina assety, ale layout w przeglądarce zwija scenę
do małego pionowego okienka i nadal wygląda jak webowy panel. Ten hotfix
dodaje na końcu css/style.css mocny blok override, który wymusza:
- pełnoekranową planszę,
- top HUD u góry,
- kartę gracza po lewej,
- dużą scenę po prawej,
- narrative strip pod sceną,
- karty akcji na dole,
- brak body scrolla.

Nie rusza mechaniki gry.
"""

import sys
from pathlib import Path

DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"

CSS_BLOCK = r"""
/* CLEAN HOTFIX v0.17.1 force mockup layout START */
/*
  This block intentionally overrides previous v0.16/v0.17 layout rules.
  The first asset-based updater wired the images correctly, but old/global
  layout rules still collapsed the scene into a tiny vertical strip.
*/

html,
body {
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  margin: 0 !important;
  overflow: hidden !important;
  background:
    radial-gradient(circle at 50% 20%, rgba(245, 240, 230, 0.95), rgba(222, 212, 194, 0.95)) !important;
}

#app {
  width: 100vw !important;
  height: 100vh !important;
  min-height: 100vh !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 10px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  display: block !important;
}

/* Main parchment board */
.vn-screen {
  width: min(1360px, calc(100vw - 20px)) !important;
  height: calc(100vh - 20px) !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 auto !important;
  padding: 16px 20px 18px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  display: grid !important;
  grid-template-columns: clamp(210px, 19vw, 270px) minmax(0, 1fr) !important;
  grid-template-rows: 54px minmax(0, 1fr) clamp(150px, 23vh, 210px) !important;
  grid-template-areas:
    "topbar topbar"
    "side stage"
    "actions actions" !important;
  gap: 14px 18px !important;

  border: 1px solid rgba(74, 69, 60, 0.22) !important;
  border-radius: 18px !important;
  background:
    radial-gradient(circle at 92% 88%, rgba(214, 166, 105, 0.16), transparent 22%),
    linear-gradient(135deg, rgba(255,255,255,0.55), rgba(237,229,215,0.94)),
    #f5f0e6 !important;
  box-shadow:
    0 18px 50px rgba(74, 69, 60, 0.18),
    inset 0 0 0 1px rgba(255,255,255,0.45) !important;
}

.vn-topbar {
  grid-area: topbar !important;
  min-height: 0 !important;
  height: 100% !important;
  width: 100% !important;
  box-sizing: border-box !important;

  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 18px !important;

  padding: 0 18px !important;
  border: 1px solid rgba(74, 69, 60, 0.20) !important;
  border-radius: 10px !important;
  background: rgba(237, 229, 215, 0.82) !important;
  color: #4A453C !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-weight: 700 !important;
  letter-spacing: 0.01em !important;
}

.vn-topbar-daylabel {
  font-size: clamp(15px, 1.4vw, 20px) !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}

.vn-topbar-stats {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  white-space: nowrap !important;
}

.vn-topbar-stat {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: clamp(14px, 1.25vw, 18px) !important;
  color: #8C5F2F !important;
}

.vn-main {
  display: contents !important;
}

/* Left player card */
.vn-side {
  grid-area: side !important;
  min-width: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  box-sizing: border-box !important;

  display: flex !important;
  align-items: flex-start !important;
  justify-content: center !important;
  overflow: hidden !important;
  padding-top: 8px !important;
}

.vn-player-card {
  width: min(100%, 245px) !important;
  min-width: 0 !important;
  height: auto !important;
  max-height: 100% !important;
  min-height: 330px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  padding: 22px 18px 18px !important;
  border-radius: 16px !important;
  border: 2px solid rgba(93, 123, 144, 0.78) !important;
  background:
    linear-gradient(rgba(245, 240, 230, 0.88), rgba(237, 229, 215, 0.93)),
    url("../assets/ui/player-card-frame.png") center / cover no-repeat,
    #EDE5D7 !important;
  box-shadow:
    0 12px 22px rgba(74, 69, 60, 0.22),
    inset 0 0 0 1px rgba(255,255,255,0.45) !important;
  transform: rotate(-1.1deg) !important;
}

.vn-player-card-inner {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

.vn-player-badge,
.vn-player-name,
.vn-player-meta,
.vn-player-status {
  color: #4A453C !important;
  text-align: center !important;
}

.vn-player-badge {
  margin: 0 0 8px !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
  color: #8C7B6D !important;
}

.vn-player-name {
  margin: 0 0 8px !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: clamp(18px, 1.8vw, 25px) !important;
  font-weight: 800 !important;
}

.vn-player-meta {
  margin: 0 0 16px !important;
  font-size: 12px !important;
  color: #8C7B6D !important;
}

.vn-player-stat {
  display: block !important;
  margin: 13px 0 !important;
}

.vn-player-stat-label {
  display: flex !important;
  justify-content: space-between !important;
  gap: 8px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  color: #4A453C !important;
}

.vn-player-stat-value {
  color: #8C5F2F !important;
}

.vn-player-bar {
  height: 9px !important;
  margin-top: 6px !important;
  border-radius: 999px !important;
  background: rgba(74, 69, 60, 0.22) !important;
  overflow: hidden !important;
}

.vn-player-bar-fill {
  height: 100% !important;
  border-radius: 999px !important;
}

.vn-player-bar-fill--spoons {
  background: #8EA7C2 !important;
}

.vn-player-bar-fill--trust {
  background: #D6A669 !important;
}

.vn-player-status {
  margin: 14px 0 0 !important;
  font-size: 12px !important;
  line-height: 1.35 !important;
  color: #5e554b !important;
}

/* Stage: large illustration + narrative strip */
.vn-stage {
  grid-area: stage !important;
  min-width: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  display: grid !important;
  grid-template-rows: minmax(0, 1fr) auto !important;
  gap: 10px !important;
  align-items: stretch !important;
}

.vn-scene-panel {
  width: 100% !important;
  height: 100% !important;
  min-height: 260px !important;
  max-height: none !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  position: relative !important;
  overflow: hidden !important;

  border: 2px solid rgba(93, 123, 144, 0.68) !important;
  border-radius: 16px !important;
  background-size: cover !important;
  background-position: center center !important;
  background-repeat: no-repeat !important;
  box-shadow:
    0 12px 26px rgba(74, 69, 60, 0.20),
    inset 0 0 0 1px rgba(255,255,255,0.3) !important;
}

.vn-scene-panel::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  background:
    linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(74,69,60,0.04)),
    radial-gradient(circle at 50% 100%, rgba(245,240,230,0.18), transparent 40%) !important;
}

.vn-scene-title-tab {
  position: absolute !important;
  top: 10px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  z-index: 2 !important;

  max-width: min(80%, 520px) !important;
  padding: 8px 24px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(74, 69, 60, 0.25) !important;
  background:
    linear-gradient(180deg, #9B6846, #6F442E) !important;
  color: #F5F0E6 !important;
  box-shadow:
    0 7px 13px rgba(74, 69, 60, 0.25),
    inset 0 0 0 1px rgba(255,255,255,0.18) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: clamp(18px, 2vw, 30px) !important;
  font-weight: 800 !important;
  text-align: center !important;
  text-transform: uppercase !important;
  letter-spacing: 0.035em !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.vn-narrative-strip {
  width: min(92%, 820px) !important;
  max-height: 112px !important;
  margin: -22px auto 0 !important;
  z-index: 3 !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px !important;

  padding: 14px 22px !important;
  border-radius: 13px !important;
  border: 1px solid rgba(74, 69, 60, 0.18) !important;
  background:
    linear-gradient(180deg, rgba(250, 246, 235, 0.96), rgba(231, 220, 200, 0.98)) !important;
  box-shadow:
    0 8px 18px rgba(74, 69, 60, 0.18),
    inset 0 0 0 1px rgba(255,255,255,0.52) !important;
  color: #4A453C !important;
  font-family: Georgia, "Times New Roman", serif !important;
}

.vn-narrative-text,
.vn-narrative-strip > p {
  margin: 0 !important;
  max-width: 100% !important;
  font-size: clamp(14px, 1.35vw, 19px) !important;
  line-height: 1.28 !important;
  text-align: center !important;
  color: #4A453C !important;

  display: -webkit-box !important;
  -webkit-line-clamp: 3 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

.vn-compact-card {
  max-height: 80px !important;
  overflow: auto !important;
  padding: 7px 9px !important;
  border-radius: 9px !important;
  background: rgba(245, 240, 230, 0.78) !important;
  border: 1px solid rgba(74, 69, 60, 0.13) !important;
  font-size: 11px !important;
  line-height: 1.25 !important;
}

/* Bottom action area */
.vn-actions {
  grid-area: actions !important;
  min-width: 0 !important;
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  padding: 4px 18px 2px !important;
}

.vn-action-grid,
.vn-action-stack,
.choices,
.vn-consequence-grid {
  width: 100% !important;
  max-width: 1000px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

.vn-action-grid {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 14px !important;
  align-items: stretch !important;
}

.vn-action-stack {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 14px !important;
}

.choices {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)) !important;
  gap: 14px !important;
  align-items: stretch !important;
}

/* Tactile cards */
.vn-action-card,
.choice-button,
.vn-choice-button,
.agenda-choice-button,
.evening-option-button {
  min-width: 0 !important;
  min-height: 116px !important;
  height: auto !important;
  box-sizing: border-box !important;

  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 7px !important;

  padding: 14px 16px !important;
  border: 3px solid #5D7B90 !important;
  border-radius: 14px !important;
  background:
    linear-gradient(180deg, rgba(250,246,235,0.98), rgba(231,220,200,0.96)) !important;
  color: #4A453C !important;
  box-shadow:
    0 8px 0 rgba(54, 74, 88, 0.58),
    0 14px 24px rgba(74, 69, 60, 0.18),
    inset 0 0 0 1px rgba(255,255,255,0.55) !important;

  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  text-align: center !important;
  cursor: pointer !important;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    border-color 120ms ease !important;
}

.vn-action-card:hover,
.choice-button:hover,
.vn-choice-button:hover,
.agenda-choice-button:hover,
.evening-option-button:hover {
  transform: translateY(-3px) !important;
  border-color: #D6A669 !important;
  box-shadow:
    0 10px 0 rgba(54, 74, 88, 0.52),
    0 18px 28px rgba(74, 69, 60, 0.22),
    inset 0 0 0 1px rgba(255,255,255,0.62) !important;
}

.vn-action-card:disabled,
.choice-button:disabled,
.agenda-choice-button:disabled,
.evening-option-button:disabled,
.vn-action-card--completed,
.agenda-choice-button--completed {
  cursor: default !important;
  opacity: 0.55 !important;
  filter: grayscale(0.45) !important;
  transform: none !important;
}

.primary-button.vn-choice-button {
  width: min(520px, 90%) !important;
  min-height: 76px !important;
  border-radius: 18px !important;
  background:
    linear-gradient(180deg, #9B6846, #6F442E) !important;
  color: #F5F0E6 !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: clamp(18px, 1.8vw, 26px) !important;
  font-weight: 800 !important;
  box-shadow:
    0 8px 0 rgba(74, 45, 31, 0.8),
    0 18px 28px rgba(74, 69, 60, 0.24) !important;
}

.choice-label,
.agenda-choice-label,
.evening-option-label {
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: clamp(15px, 1.35vw, 20px) !important;
  font-weight: 800 !important;
  color: #4A453C !important;
  text-transform: uppercase !important;
  letter-spacing: 0.025em !important;
}

.choice-cost,
.agenda-choice-card-meta,
.evening-option-effects,
.agenda-choice-description,
.choice-unavailable-note {
  font-size: clamp(11px, 1vw, 13px) !important;
  line-height: 1.25 !important;
  color: #6A5B4F !important;
}

/* Consequences */
.vn-consequence-grid {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.vn-consequence-card {
  min-height: 120px !important;
  padding: 14px 16px !important;
  border-radius: 14px !important;
  border: 3px solid #5D7B90 !important;
  box-shadow:
    0 8px 0 rgba(54, 74, 88, 0.58),
    0 14px 24px rgba(74, 69, 60, 0.18) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  gap: 8px !important;
}

.vn-consequence-card--positive {
  background: linear-gradient(180deg, rgba(214, 230, 205, 0.98), rgba(175, 205, 165, 0.98)) !important;
}

.vn-consequence-card--negative {
  background: linear-gradient(180deg, rgba(226, 191, 181, 0.98), rgba(194, 126, 113, 0.98)) !important;
}

.vn-consequence-card--neutral {
  background: linear-gradient(180deg, rgba(231, 220, 200, 0.98), rgba(206, 195, 179, 0.98)) !important;
}

.vn-consequence-label {
  font-family: Georgia, "Times New Roman", serif !important;
  font-weight: 800 !important;
  font-size: clamp(14px, 1.25vw, 18px) !important;
}

.vn-consequence-value {
  font-size: clamp(22px, 2.4vw, 34px) !important;
  font-weight: 900 !important;
}

/* Evening atmosphere */
.vn-screen--evening {
  background:
    radial-gradient(circle at 82% 18%, rgba(214, 166, 105, 0.18), transparent 24%),
    linear-gradient(135deg, rgba(58,63,82,0.92), rgba(46,49,64,0.98)) !important;
}

.vn-screen--evening .vn-topbar,
.vn-screen--evening .vn-narrative-strip {
  background: rgba(58, 63, 82, 0.78) !important;
  color: #F1EBDD !important;
  border-color: rgba(241, 235, 221, 0.22) !important;
}

.vn-screen--evening .vn-narrative-text,
.vn-screen--evening .vn-narrative-strip > p {
  color: #F1EBDD !important;
}

/* Preserve version badge but keep it subtle */
.version-badge {
  position: fixed !important;
  right: 14px !important;
  bottom: 10px !important;
  z-index: 50 !important;
  opacity: 0.65 !important;
  font-size: 11px !important;
}

/* Laptop safeguards */
@media (max-height: 790px) {
  .vn-screen {
    padding: 10px 14px 12px !important;
    grid-template-rows: 48px minmax(0, 1fr) 145px !important;
    gap: 10px 14px !important;
  }

  .vn-scene-panel {
    min-height: 220px !important;
  }

  .vn-narrative-strip {
    max-height: 86px !important;
    padding: 10px 16px !important;
  }

  .vn-action-card,
  .choice-button,
  .vn-choice-button,
  .agenda-choice-button,
  .evening-option-button {
    min-height: 102px !important;
    padding: 10px 12px !important;
    gap: 5px !important;
  }

  .vn-player-card {
    min-height: 285px !important;
    padding: 16px 14px !important;
  }
}

@media (max-width: 900px) {
  .vn-screen {
    grid-template-columns: 1fr !important;
    grid-template-rows: 48px minmax(0, 1fr) 170px !important;
    grid-template-areas:
      "topbar"
      "stage"
      "actions" !important;
  }

  .vn-side {
    display: none !important;
  }

  .vn-action-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
/* CLEAN HOTFIX v0.17.1 force mockup layout END */
"""

def read_text(path):
    if not path.exists():
        raise FileNotFoundError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding="utf-8")

def write_text(path, text):
    path.write_text(text, encoding="utf-8")

def replace_once(path, old, new, label):
    text = read_text(path)
    if new in text:
        print(f"[pominieto] {label} już zastosowane")
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: oczekiwano 1 wystąpienia dla {label}, znaleziono {count}")
    write_text(path, text.replace(old, new, 1))
    print(f"[ok] {label}")

def append_css(path):
    text = read_text(path)
    marker = "CLEAN HOTFIX v0.17.1 force mockup layout START"
    if marker in text:
        print("[pominieto] CSS hotfix v0.17.1 już obecny")
        return
    if not text.endswith("\n"):
        text += "\n"
    text += "\n" + CSS_BLOCK + "\n"
    write_text(path, text)
    print("[ok] Dodano CSS hotfix v0.17.1")

def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_PROJECT_ROOT)

    if not root.exists():
        raise RuntimeError(f"Nie znaleziono katalogu projektu: {root}")

    css = root / "css" / "style.css"
    version = root / "js" / "data" / "versionData.js"
    index = root / "index.html"

    append_css(css)

    replace_once(
        version,
        'export const GAME_VERSION = "v0.17";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17";',
        'export const GAME_VERSION = "v0.17.1";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17.1";',
        "versionData v0.17 -> v0.17.1"
    )

    replace_once(
        index,
        './js/main.js?v=170',
        './js/main.js?v=171',
        "cache bust ?v=170 -> ?v=171"
    )

    print("\nGotowe. Uruchom serwer ponownie i zrób Ctrl+F5.")
    print("Testuj od Nowa gra, żeby ominąć stary zapis UI/stanu.")

if __name__ == "__main__":
    main()
