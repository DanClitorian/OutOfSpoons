#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_hotfix_v0_17_4_layout_stabilization.py

Out of Spoons v0.17.4 — Layout Stabilization Pass.

Cel:
- ustabilizować gameplay layout po v0.17.3,
- dodać sidebar: karta postaci + karta relacji,
- usunąć overlap między sceną/narracją/akcjami,
- powiększyć i wyczyścić opisy dnia,
- wieczór: karty w siatce 2x2 zamiast pionowego stosu,
- kreator/menu zostają klasyczne, wąskie i scrollowalne.

Nie rusza mechaniki gry.
"""

import sys
from pathlib import Path

DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"

CSS_BLOCK = r"""
/* CLEAN HOTFIX v0.17.4 layout stabilization START */
/*
  Proper layout stabilization after asset-based v0.17.
  This pass treats gameplay UI as a fixed game board with:
  - top HUD,
  - left sidebar stack: player card + relationship card,
  - large stage,
  - readable narrative strip,
  - separate bottom action panel.
*/

/* Non-game screens stay old-school and usable. */
#app:not(:has(.vn-screen)) {
  width: 100% !important;
  max-width: 620px !important;
  min-height: auto !important;
  height: auto !important;
  margin: 0 auto !important;
  padding: 24px 16px 96px !important;
  overflow: visible !important;
  box-sizing: border-box !important;
}

#app:not(:has(.vn-screen)) .screen,
#app:not(:has(.vn-screen)) .character-creator-screen,
#app:not(:has(.vn-screen)) .main-menu-screen {
  width: 100% !important;
  max-width: 620px !important;
  margin: 0 auto !important;
  overflow: visible !important;
  box-sizing: border-box !important;
}

/* Gameplay app shell */
#app:has(.vn-screen) {
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 8px !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

/* Board */
#app:has(.vn-screen) .vn-screen {
  width: min(1480px, calc(100vw - 16px)) !important;
  height: calc(100vh - 16px) !important;
  max-height: calc(100vh - 16px) !important;
  margin: 0 auto !important;
  padding: 12px 14px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  display: grid !important;
  grid-template-columns: clamp(220px, 18vw, 285px) minmax(0, 1fr) !important;
  grid-template-rows: 50px minmax(0, 1fr) clamp(160px, 23vh, 215px) !important;
  grid-template-areas:
    "topbar topbar"
    "side stage"
    "actions actions" !important;
  column-gap: 18px !important;
  row-gap: 10px !important;
}

/* Topbar */
.vn-topbar {
  grid-area: topbar !important;
  position: relative !important;
  z-index: 20 !important;
  height: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

/* Main uses display: contents, sidebar and stage become grid items. */
.vn-main {
  display: contents !important;
}

/* Sidebar: card stack */
.vn-side {
  grid-area: side !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;

  display: flex !important;
  align-items: stretch !important;
  justify-content: flex-start !important;
  padding: 4px 0 0 !important;
}

.vn-sidebar-stack {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  display: grid !important;
  grid-template-rows: minmax(230px, 1fr) minmax(128px, 0.58fr) !important;
  gap: 10px !important;
}

/* Player card — less oversized, more useful. */
.vn-player-card {
  width: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 16px 15px !important;
  box-sizing: border-box !important;
  transform: rotate(-0.6deg) !important;
}

.vn-player-card-inner {
  height: 100% !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
}

.vn-player-badge {
  margin: 0 0 6px !important;
}

.vn-player-name {
  margin: 0 0 8px !important;
  font-size: clamp(22px, 2vw, 30px) !important;
  line-height: 1.15 !important;
}

.vn-player-meta {
  margin: 0 0 12px !important;
}

.vn-player-stat {
  margin: 10px 0 !important;
}

.vn-player-status {
  margin-top: 12px !important;
  font-size: 12px !important;
  line-height: 1.32 !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 4 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

/* Relationship card */
.vn-relationship-card {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  padding: 12px 14px !important;
  border-radius: 16px !important;
  border: 2px solid rgba(214, 166, 105, 0.72) !important;
  background:
    linear-gradient(180deg, rgba(250,246,235,0.94), rgba(231,220,200,0.92)) !important;
  box-shadow:
    0 9px 20px rgba(74, 69, 60, 0.14),
    inset 0 0 0 1px rgba(255,255,255,0.42) !important;
}

.vn-relationship-heading {
  margin: 0 0 5px !important;
  font-size: 10px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.095em !important;
  color: #8C7B6D !important;
  text-align: center !important;
}

.vn-relationship-name {
  margin: 0 0 3px !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: clamp(16px, 1.5vw, 22px) !important;
  font-weight: 800 !important;
  color: #4A453C !important;
  text-align: center !important;
  line-height: 1.15 !important;
}

.vn-relationship-label {
  margin: 0 0 8px !important;
  font-size: 11px !important;
  color: #8C7B6D !important;
  text-align: center !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 1 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

.vn-relationship-meter {
  margin: 7px 0 !important;
}

.vn-relationship-meter-label {
  display: flex !important;
  justify-content: space-between !important;
  gap: 8px !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  color: #4A453C !important;
}

.vn-relationship-bar {
  height: 7px !important;
  margin-top: 4px !important;
  border-radius: 999px !important;
  background: rgba(74, 69, 60, 0.18) !important;
  overflow: hidden !important;
}

.vn-relationship-bar-fill {
  height: 100% !important;
  border-radius: 999px !important;
}

.vn-relationship-bar-fill--trust {
  background: #D6A669 !important;
}

.vn-relationship-bar-fill--frustration {
  background: #B86B5F !important;
}

.vn-relationship-mood {
  margin: 7px 0 0 !important;
  padding: 5px 7px !important;
  border-radius: 999px !important;
  background: rgba(93, 123, 144, 0.14) !important;
  color: #4A453C !important;
  text-align: center !important;
  font-size: 11px !important;
  font-weight: 700 !important;
}

/* Stage */
.vn-stage {
  grid-area: stage !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;

  display: grid !important;
  grid-template-rows: minmax(0, 1fr) clamp(84px, 13vh, 132px) !important;
  gap: 9px !important;
}

.vn-scene-panel {
  min-height: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background-size: cover !important;
  background-position: center center !important;
}

/* Bigger, more readable day/event description */
.vn-narrative-strip {
  width: min(92%, 940px) !important;
  height: 100% !important;
  max-height: none !important;
  margin: 0 auto !important;
  padding: 14px 24px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  pointer-events: none !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.vn-narrative-strip .vn-compact-card {
  display: none !important;
}

.vn-narrative-text,
.vn-narrative-strip > p {
  margin: 0 !important;
  max-width: 880px !important;
  color: #3F382F !important;
  font-family: Georgia, "Times New Roman", serif !important;
  font-size: clamp(19px, 1.8vw, 28px) !important;
  line-height: 1.24 !important;
  font-weight: 500 !important;
  text-align: center !important;

  display: -webkit-box !important;
  -webkit-line-clamp: 3 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

/* Actions panel: separate, always clickable */
.vn-actions {
  grid-area: actions !important;
  position: relative !important;
  z-index: 30 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  padding: 8px 28px 6px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  pointer-events: auto !important;
  border-top: 1px solid rgba(74, 69, 60, 0.15) !important;
}

.vn-action-grid,
.vn-action-stack,
.choices,
.evening-options,
.vn-consequence-grid {
  width: min(100%, 1040px) !important;
  max-width: 1040px !important;
  min-height: 0 !important;
  position: relative !important;
  z-index: 31 !important;
  pointer-events: auto !important;
}

.vn-action-grid,
.choices {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 14px !important;
  align-items: stretch !important;
}

/* Single-button screens */
.vn-action-stack {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 14px !important;
}

/* Evening must use 2x2 grid, not a vertical stack. */
.vn-screen--evening .vn-action-stack,
.vn-screen--evening .evening-options {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(260px, 1fr)) !important;
  gap: 12px 14px !important;
  width: min(100%, 940px) !important;
  max-width: 940px !important;
}

/* Reflection: consequence cards + button, compact and stable */
.vn-screen--reflection .vn-action-stack {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(210px, 300px) !important;
  gap: 14px !important;
  align-items: center !important;
}

.vn-screen--reflection .reflection-impact-panel {
  width: 100% !important;
  height: 100% !important;
  max-height: none !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: transparent !important;
  border: 0 !important;
}

.vn-screen--reflection .vn-consequence-grid {
  width: 100% !important;
  height: 100% !important;
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 10px !important;
}

.vn-screen--reflection .primary-button.vn-choice-button {
  width: 100% !important;
  min-height: 96px !important;
  max-height: 140px !important;
}

/* Tactile action cards */
.vn-action-card,
.choice-button,
.vn-choice-button,
.agenda-choice-button,
.evening-option-button {
  min-height: 118px !important;
  max-height: none !important;
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  pointer-events: auto !important;

  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  align-items: center !important;
  gap: 7px !important;
}

.vn-screen--evening .evening-option-button {
  min-height: 84px !important;
  max-height: 98px !important;
  padding: 9px 12px !important;
  gap: 4px !important;
}

.choice-label,
.agenda-choice-label,
.evening-option-label {
  font-size: clamp(15px, 1.25vw, 20px) !important;
  line-height: 1.08 !important;
}

.choice-cost,
.choice-unavailable-note,
.agenda-choice-description,
.agenda-choice-card-meta,
.agenda-choice-hint,
.evening-option-description,
.evening-option-effects {
  max-width: 100% !important;
  font-size: clamp(11px, 0.95vw, 13px) !important;
  line-height: 1.2 !important;

  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

.primary-button.vn-choice-button {
  height: auto !important;
  min-height: 82px !important;
  max-height: 120px !important;
}

/* Evening title/narrative readable against dark board */
.vn-screen--evening .vn-narrative-text,
.vn-screen--evening .vn-narrative-strip > p {
  color: #F1EBDD !important;
}

/* Version badge remains unobtrusive */
.version-badge {
  opacity: 0.55 !important;
  pointer-events: none !important;
}

/* Laptop 768px high — priority: all actions visible, no board scroll */
@media (max-height: 790px) {
  #app:has(.vn-screen) .vn-screen {
    grid-template-rows: 46px minmax(0, 1fr) 162px !important;
    padding: 8px 11px !important;
    row-gap: 8px !important;
  }

  .vn-sidebar-stack {
    grid-template-rows: minmax(190px, 1fr) minmax(112px, 0.48fr) !important;
    gap: 8px !important;
  }

  .vn-player-card {
    padding: 12px 13px !important;
  }

  .vn-player-name {
    font-size: clamp(18px, 1.7vw, 25px) !important;
  }

  .vn-player-status {
    -webkit-line-clamp: 3 !important;
  }

  .vn-relationship-card {
    padding: 9px 11px !important;
  }

  .vn-relationship-name {
    font-size: clamp(14px, 1.3vw, 18px) !important;
  }

  .vn-stage {
    grid-template-rows: minmax(0, 1fr) 76px !important;
  }

  .vn-narrative-strip {
    padding: 10px 18px !important;
  }

  .vn-narrative-text,
  .vn-narrative-strip > p {
    font-size: clamp(16px, 1.55vw, 22px) !important;
    -webkit-line-clamp: 2 !important;
  }

  .vn-actions {
    padding: 6px 20px 4px !important;
  }

  .vn-action-card,
  .choice-button,
  .vn-choice-button,
  .agenda-choice-button,
  .evening-option-button {
    min-height: 94px !important;
    padding: 8px 10px !important;
    gap: 4px !important;
  }

  .vn-screen--evening .evening-option-button {
    min-height: 70px !important;
    max-height: 76px !important;
  }

  .vn-screen--evening .vn-action-stack,
  .vn-screen--evening .evening-options {
    grid-template-columns: repeat(2, minmax(230px, 1fr)) !important;
    gap: 8px 10px !important;
  }

  .vn-screen--reflection .vn-consequence-card {
    min-height: 78px !important;
  }
}

@media (max-width: 980px) {
  #app:has(.vn-screen) .vn-screen {
    grid-template-columns: 1fr !important;
    grid-template-rows: 46px minmax(0, 1fr) 180px !important;
    grid-template-areas:
      "topbar"
      "stage"
      "actions" !important;
  }

  .vn-side {
    display: none !important;
  }

  .vn-action-grid,
  .choices {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
/* CLEAN HOTFIX v0.17.4 layout stabilization END */
"""

VN_LAYOUT_PATCH_OLD = r"""  card.appendChild(inner);

  return card;
}

function buildPlayerStat(label, valueText, percentValue, modifier) {"""

VN_LAYOUT_PATCH_NEW = r"""  card.appendChild(inner);

  return buildSidebarStack(state, card);
}

function buildSidebarStack(state, playerCard) {
  const stack = document.createElement("div");
  stack.className = "vn-sidebar-stack";
  stack.appendChild(playerCard);

  const relationshipCard = buildRelationshipCard(state);
  if (relationshipCard) {
    stack.appendChild(relationshipCard);
  }

  return stack;
}

function buildRelationshipCard(state) {
  const npc = getPartnerNpc(state);
  const partner = state && state.partner ? state.partner : null;

  if (!npc || !partner) {
    return null;
  }

  const card = document.createElement("div");
  card.className = "vn-relationship-card";

  const heading = document.createElement("p");
  heading.className = "vn-relationship-heading";
  heading.textContent = "Relacja";
  card.appendChild(heading);

  const name = document.createElement("p");
  name.className = "vn-relationship-name";
  name.textContent = partner.name;
  card.appendChild(name);

  const label = document.createElement("p");
  label.className = "vn-relationship-label";
  label.textContent = partner.relationshipLabel || "Osoba partnerska";
  card.appendChild(label);

  card.appendChild(buildRelationshipMiniMeter("🤝 Zaufanie", npc.trust, "trust"));
  card.appendChild(buildRelationshipMiniMeter("🌡️ Frustracja", npc.frustration, "frustration"));

  const mood = document.createElement("p");
  mood.className = "vn-relationship-mood";
  mood.textContent = buildRelationshipMoodLabel(npc);
  card.appendChild(mood);

  return card;
}

function buildRelationshipMiniMeter(label, value, modifier) {
  const safeValue = clampPercent(value);

  const meter = document.createElement("div");
  meter.className = "vn-relationship-meter";

  const labelRow = document.createElement("div");
  labelRow.className = "vn-relationship-meter-label";

  const labelText = document.createElement("span");
  labelText.textContent = label;
  labelRow.appendChild(labelText);

  const valueText = document.createElement("span");
  valueText.textContent = `${safeValue}/100`;
  labelRow.appendChild(valueText);

  meter.appendChild(labelRow);

  const bar = document.createElement("div");
  bar.className = "vn-relationship-bar";

  const fill = document.createElement("div");
  fill.className = `vn-relationship-bar-fill vn-relationship-bar-fill--${modifier}`;
  fill.style.width = `${safeValue}%`;
  bar.appendChild(fill);

  meter.appendChild(bar);

  return meter;
}

function buildRelationshipMoodLabel(npc) {
  const trust = clampPercent(npc.trust);
  const frustration = clampPercent(npc.frustration);

  if (trust >= 70 && frustration <= 25) {
    return "Bezpiecznie";
  }

  if (trust >= 50 && frustration <= 45) {
    return "Stabilnie";
  }

  if (frustration >= 70 && trust >= 40) {
    return "Napięcie";
  }

  if (trust < 35 && frustration >= 55) {
    return "Krucho";
  }

  if (trust < 35) {
    return "Niepewnie";
  }

  if (frustration >= 55) {
    return "Przeciążenie";
  }

  return "Niejasno";
}

function buildPlayerStat(label, valueText, percentValue, modifier) {"""

def read_text(path):
    if not path.exists():
        raise FileNotFoundError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding="utf-8")

def write_text(path, text):
    path.write_text(text, encoding="utf-8")

def append_css(path):
    text = read_text(path)
    marker = "CLEAN HOTFIX v0.17.4 layout stabilization START"
    if marker in text:
        print("[pominieto] CSS hotfix v0.17.4 już obecny")
        return
    if not text.endswith("\n"):
        text += "\n"
    text += "\n" + CSS_BLOCK + "\n"
    write_text(path, text)
    print("[ok] Dodano CSS hotfix v0.17.4")

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
    vn_layout = root / "js" / "ui" / "vnLayout.js"

    replace_once_or_skip(
        vn_layout,
        VN_LAYOUT_PATCH_OLD,
        VN_LAYOUT_PATCH_NEW,
        "vnLayout sidebar stack + relationship card"
    )

    append_css(css)

    replace_once_or_skip(
        version,
        'export const GAME_VERSION = "v0.17.3";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17.3";',
        'export const GAME_VERSION = "v0.17.4";\nexport const GAME_VERSION_LABEL = "Out of Spoons v0.17.4";',
        "versionData v0.17.3 -> v0.17.4"
    )

    replace_once_or_skip(
        index,
        './js/main.js?v=173',
        './js/main.js?v=174',
        "cache bust ?v=173 -> ?v=174"
    )

    print("\nGotowe. Restart serwera + Ctrl+F5.")
    print("Test: kreator, poranek, agenda, event, reflection, evening.")

if __name__ == "__main__":
    main()
