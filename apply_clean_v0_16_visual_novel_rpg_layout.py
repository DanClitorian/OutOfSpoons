#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_16_visual_novel_rpg_layout.py

Updater dla Out of Spoons: v0.15 -> v0.16 (Visual Novel RPG Layout Redesign).

To jest pelny redesign layoutu 5 glownych ekranow gameplayowych
(poranek, agenda, event, refleksja, wieczor) na wspolny "shell" visual
novel: gorny pasek fazy, boczna karta gracza, centralna scena z duzym
symbolem, panel akcji na dole. Zadna mechanika gry sie nie zmienia -
to wylacznie przebudowa UI.

Co robi:
  - dodaje nowy plik js/ui/vnLayout.js (wspolny helper layoutu VN),
  - PODMIENIA CALA ZAWARTOSC 5 plikow ekranow gameplayowych:
      js/ui/screens/gameScreen.js
      js/ui/screens/agendaScreen.js
      js/ui/screens/eventScreen.js
      js/ui/screens/reflectionScreen.js
      js/ui/screens/eveningScreen.js
    (pelna podmiana pliku, nie male patche - bo to pelny redesign
    struktury, nie punktowa zmiana),
  - WAZNA ZMIANA: eventScreen.js NIE pokazuje juz dokladnych liczb
    kosztu/efektu przed wyborem (np. "-3 spoons") - zamiast tego
    pokazuje jakosciowe poziomy (Koszt: niskie/srednie/wysokie,
    Niepewnosc: niska/srednia/wysoka). Dokladne liczby nadal pokazuja
    sie PO decyzji na ekranie refleksji, teraz jako duze kafle,
  - patchuje css/style.css: maly patch .choice-button (wyglad przycisku
    dialogowego) + duzy dopisany blok CLEAN v0.16 (vn-screen, karta
    gracza, scena, panel akcji, konsekwencje, brak scrolla na typowym
    laptopie, rozne odcienie faz dnia),
  - podbija wersje w js/data/versionData.js do v0.16,
  - podbija cache-bust w index.html do ?v=160.

Nie zmienia saveVersion. Nie zmienia zadnej mechaniki gry (eventow,
kosztow, konsekwencji, losowania, dzialania agendy/wieczoru/weekly
summary) - to wylacznie UI. Global HUD (gameHud.js) i uiManager.js NIE
sa zmieniane - nowy layout dziala razem z istniejacym globalnym HUD-em.

Skrypt jest idempotentny: mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane, a nie duplikowane/nadpisywane ponownie.

WAZNE dla pelnych podmian plikow: poniewaz ekrany sa PODMIENIANE W
CALOSCI (nie male fragmenty), ten updater wymaga, zeby zawartosc
plikow w repo dokladnie odpowiadala stanowi z v0.15 (tak jak zostal
sprawdzony na GitHubie przed przygotowaniem tego updatera). Jesli
plik lokalnie rozni sie choc odrobine (np. reczna edycja, ktora nie
trafila jeszcze na GitHub), updater PRZERWIE dzialanie z jasnym
komunikatem zamiast zgadywac lub nadpisywac cos po cichu.

Uzycie:
    python apply_clean_v0_16_visual_novel_rpg_layout.py

Domyslnie oczekuje repo w C:\\OutOfSpoons. Mozna podac inna sciezke
jako pierwszy argument linii polecen.
"""

import sys
from pathlib import Path


DEFAULT_PROJECT_ROOT = r"C:\OutOfSpoons"


class UpdaterError(Exception):
    """Podnoszony, gdy sanity check nie przechodzi - lepiej przerwac,
    niz zepsuc plik nieprecyzyjnym patchem."""
    pass


def read_text(path: Path, encoding: str = "utf-8") -> str:
    if not path.exists():
        raise UpdaterError(f"Nie znaleziono pliku: {path}")
    return path.read_text(encoding=encoding)


def write_text(path: Path, content: str, encoding: str = "utf-8") -> None:
    path.write_text(content, encoding=encoding)


def apply_patches(path: Path, patches, encoding: str = "utf-8") -> None:
    """
    patches: lista krotek (old_str, new_str, label).
    Kazdy patch jest aplikowany do zawartosci pliku w pamieci, w kolejnosci,
    a caly plik jest zapisywany raz na koncu (jesli cokolwiek sie zmienilo).

    Idempotentnosc: jesli new_str jest juz w pliku, patch jest pomijany.
    Bezpieczenstwo: jesli old_str nie wystepuje dokladnie raz, przerywamy
    z jasnym komunikatem zamiast zgadywac.
    """
    content = read_text(path, encoding=encoding)
    changed = False

    for old_str, new_str, label in patches:
        if new_str in content:
            print(f"  [pominieto] {label} (juz zastosowano)")
            continue

        count = content.count(old_str)
        if count == 0:
            raise UpdaterError(
                f"{path}\n"
                f"  Nie znaleziono oczekiwanego fragmentu dla patcha: '{label}'.\n"
                f"  Plik mogl sie zmienic od czasu przygotowania tego updatera.\n"
                f"  Nie aplikuje zadnych zmian do tego pliku - napraw recznie albo zglos rozbieznosc."
            )
        if count > 1:
            raise UpdaterError(
                f"{path}\n"
                f"  Fragment dla patcha '{label}' wystepuje {count} razy (oczekiwano dokladnie 1).\n"
                f"  Nie moge bezpiecznie zpatchowac tego pliku automatycznie."
            )

        content = content.replace(old_str, new_str, 1)
        changed = True
        print(f"  [ok] {label}")

    if changed:
        write_text(path, content, encoding=encoding)
    else:
        print(f"  (brak zmian w {path.name} - wszystko juz zastosowane)")


def replace_whole_file(path: Path, old_content: str, new_content: str, label: str) -> None:
    """
    Uzywane dla ekranow, ktore v0.16 podmienia w calosci (pelny redesign
    struktury, nie punktowa zmiana). Bezpieczne/idempotentne:
      - jesli plik juz ma dokladnie new_content -> pomija,
      - jesli plik ma dokladnie old_content (stan v0.15) -> podmienia,
      - w kazdym innym przypadku -> przerywa z jasnym bledem, zamiast
        zgadywac lub nadpisywac nieznana zawartosc.
    """
    current = read_text(path)

    if current == new_content:
        print(f"  [pominieto] {label} (juz zastosowano)")
        return

    if current != old_content:
        raise UpdaterError(
            f"{path}\n"
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.15 (oczekiwanemu\n"
            f"  przed patchem), ani stanowi v0.16 (oczekiwanemu po patchu).\n"
            f"  Plik mogl zostac recznie zmieniony od czasu przygotowania\n"
            f"  tego updatera. Nie nadpisuje go automatycznie - sprawdz\n"
            f"  recznie roznice (np. przez git diff) przed ponowna proba."
        )

    write_text(path, new_content)
    print(f"  [ok] {label} (plik podmieniony w calosci)")


def create_new_file_if_needed(path: Path, content: str, marker: str, label: str) -> None:
    """
    Tworzy nowy plik. Jesli plik juz istnieje i zawiera nasz marker
    (czyli poprzednie uruchomienie tego samego skryptu), pomija zapis.
    Jesli plik istnieje i NIE zawiera markera, przerywa - nie chcemy
    nadpisywac czegos, czego nie rozpoznajemy.
    """
    if path.exists():
        existing = read_text(path)
        if marker in existing:
            print(f"  [pominieto] {label} (plik juz istnieje z oczekiwana zawartoscia)")
            return
        raise UpdaterError(
            f"{path}\n"
            f"  Plik juz istnieje, ale nie zawiera oczekiwanego markera v0.16.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie, czy to nie jest\n"
            f"  inny plik o tej samej nazwie."
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    write_text(path, content)
    print(f"  [ok] {label} (nowy plik utworzony)")


def append_css_block_if_needed(path: Path, block: str, marker: str, label: str) -> None:
    content = read_text(path)
    if marker in content:
        print(f"  [pominieto] {label} (blok CSS juz obecny)")
        return

    if not content.endswith("\n"):
        content += "\n"
    content += "\n" + block
    write_text(path, content)
    print(f"  [ok] {label}")


# ---------------------------------------------------------------------------
# Zawartosc nowego pliku: js/ui/vnLayout.js
# ---------------------------------------------------------------------------

VN_LAYOUT_JS = r"""// vnLayout.js
//
// v0.16: Visual Novel RPG Layout Redesign.
//
// Wspólny "shell" layoutu dla ekranów gameplayowych (poranek, agenda,
// event, refleksja, wieczór), żeby nie kopiować tej samej struktury
// (górny pasek / karta gracza / scena / panel akcji) w pięciu różnych
// plikach ekranów. Każdy ekran buduje własną zawartość (scenę, kartę
// gracza, panel akcji) i składa ją w jedną całość przez createVnShell().
//
// Ten moduł NIE zawiera żadnej logiki gry — tylko buduje DOM. Nie wie
// nic o spoons, eventach, agendzie itd. poza tym, co dostanie w opcjach.

/**
 * Buduje pełną strukturę ekranu visual novel:
 *
 * <div class="vn-screen vn-screen--{screenClass}">
 *   <div class="vn-topline">{phaseLabel}</div>
 *   <div class="vn-main">
 *     <aside class="vn-side">{side}</aside>
 *     <section class="vn-stage">{scene}</section>
 *   </div>
 *   <section class="vn-actions">{actions}</section>
 * </div>
 *
 * @param {object} options
 * @param {string} options.screenClass - np. "morning", "agenda", "event",
 *   "reflection", "evening" (dołączany jako "vn-screen--{screenClass}")
 * @param {string} [options.phaseLabel] - krótka etykieta pokazywana w
 *   górnym pasku (np. "Poranek", "Wydarzenie 2/3 — Relacja")
 * @param {HTMLElement} [options.scene] - zawartość centralnej sceny
 * @param {HTMLElement} [options.side] - zawartość bocznego panelu (karta gracza)
 * @param {HTMLElement} [options.actions] - zawartość dolnego panelu akcji
 */
export function createVnShell(options) {
  const { screenClass, phaseLabel, scene, side, actions } = options || {};

  const shell = document.createElement("div");
  shell.className = `vn-screen vn-screen--${screenClass || "default"}`;

  if (phaseLabel) {
    const topline = document.createElement("div");
    topline.className = "vn-topline";
    topline.textContent = phaseLabel;
    shell.appendChild(topline);
  }

  const main = document.createElement("div");
  main.className = "vn-main";

  if (side) {
    const sideEl = document.createElement("aside");
    sideEl.className = "vn-side";
    sideEl.appendChild(side);
    main.appendChild(sideEl);
  }

  const stage = document.createElement("section");
  stage.className = "vn-stage";
  if (scene) {
    stage.appendChild(scene);
  }
  main.appendChild(stage);

  shell.appendChild(main);

  if (actions) {
    const actionsSection = document.createElement("section");
    actionsSection.className = "vn-actions";
    actionsSection.appendChild(actions);
    shell.appendChild(actionsSection);
  }

  return shell;
}

/**
 * Buduje kartę centralnej sceny: duży symbol/emoji + tytuł + tekst,
 * z opcjonalnymi dodatkowymi kompaktowymi kartami (np. previous evening
 * summary, morning events) dołączanymi pod tekstem sceny.
 *
 * @param {object} options
 * @param {string} [options.symbol] - duży symbol/emoji sceny
 * @param {string} [options.symbolModifier] - modyfikator klasy, np. "morning"
 * @param {string} [options.title] - tytuł sceny
 * @param {string|HTMLElement} [options.text] - tekst albo gotowy element
 * @param {Array<HTMLElement|null>} [options.extra] - dodatkowe kompaktowe
 *   karty doklejane pod tekstem sceny (np. istniejące sekcje z v0.10-v0.15,
 *   przeniesione tu bez przepisywania ich wewnętrznej logiki)
 */
export function createScenePanel(options) {
  const { symbol, symbolModifier, title, text, extra } = options || {};

  const card = document.createElement("div");
  card.className = "vn-scene-card";

  if (symbol) {
    const symbolEl = document.createElement("div");
    symbolEl.className = `vn-scene-symbol vn-scene-symbol--${symbolModifier || "default"}`;
    symbolEl.textContent = symbol;
    symbolEl.setAttribute("aria-hidden", "true");
    card.appendChild(symbolEl);
  }

  if (title) {
    const titleEl = document.createElement("h2");
    titleEl.className = "vn-scene-title";
    titleEl.textContent = title;
    card.appendChild(titleEl);
  }

  if (text) {
    const textEl = document.createElement("div");
    textEl.className = "vn-scene-text";

    if (typeof text === "string") {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      textEl.appendChild(paragraph);
    } else {
      textEl.appendChild(text);
    }

    card.appendChild(textEl);
  }

  if (Array.isArray(extra)) {
    extra.forEach((element) => {
      if (element) {
        const compact = document.createElement("div");
        compact.className = "vn-compact-card";
        compact.appendChild(element);
        card.appendChild(compact);
      }
    });
  }

  return card;
}

/**
 * Buduje symboliczną kartę gracza: imię, mały tekst fazy, spoons,
 * zaufanie. Celowo pokazuje tylko priorytetowe dane (spoons + zaufanie)
 * — reszta (frustracja, pełny opis relacji) zostaje w globalnym HUD-zie
 * (gameHud.js) i w istniejącej karcie partnera, żeby ta karta nie
 * dublowała tych samych informacji i nie zajmowała za dużo miejsca.
 *
 * @param {object} state - aktualny stan gry (getState())
 * @param {string} [phaseText] - mały tekst, np. "Dzień 4 · Poranek"
 */
export function createPlayerCard(state, phaseText) {
  const card = document.createElement("div");
  card.className = "vn-player-card";

  const name = document.createElement("p");
  name.className = "vn-player-name";
  name.textContent = state && state.player ? state.player.name : "Ty";
  card.appendChild(name);

  if (phaseText) {
    const meta = document.createElement("p");
    meta.className = "vn-player-meta";
    meta.textContent = phaseText;
    card.appendChild(meta);
  }

  const spoons = state && state.resources ? state.resources.spoons : null;
  if (spoons) {
    card.appendChild(
      buildPlayerStat("🥄 Spoons", `${spoons.current}/${spoons.max}`, percent(spoons.current, spoons.max), "spoons")
    );
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    card.appendChild(
      buildPlayerStat("🤝 Zaufanie", `${clampPercent(npc.trust)}`, clampPercent(npc.trust), "trust")
    );
  }

  return card;
}

function buildPlayerStat(label, valueText, percentValue, modifier) {
  const stat = document.createElement("div");
  stat.className = "vn-player-stat";

  const labelEl = document.createElement("span");
  labelEl.className = "vn-player-stat-label";
  labelEl.textContent = label;
  stat.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "vn-player-stat-value";
  valueEl.textContent = valueText;
  stat.appendChild(valueEl);

  const bar = document.createElement("div");
  bar.className = "vn-player-bar";

  const fill = document.createElement("div");
  fill.className = `vn-player-bar-fill vn-player-bar-fill--${modifier}`;
  fill.style.width = `${percentValue}%`;
  bar.appendChild(fill);

  stat.appendChild(bar);

  return stat;
}

function getPartnerNpc(state) {
  if (!state || !state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

function percent(current, max) {
  if (!max) {
    return 0;
  }

  return clampPercent((current / max) * 100);
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

/**
 * Opakowuje przekazane elementy (przyciski, karty wyboru) we wspólny
 * kontener panelu akcji na dole ekranu.
 *
 * @param {Array<HTMLElement|null>} children
 */
export function createActionPanel(children) {
  const panel = document.createElement("div");
  panel.className = "vn-action-grid";

  (children || []).forEach((child) => {
    if (child) {
      panel.appendChild(child);
    }
  });

  return panel;
}

/**
 * Buduje siatkę dużych "kafli" konsekwencji (np. Spoons -2, Zaufanie +1).
 * Kafle mają dodatkową klasę modyfikatora w zależności od znaku wartości,
 * żeby dało się je pokolorować (poprawa / pogorszenie / bez zmian).
 *
 * @param {Array<{label: string, value: number}>} items
 */
export function createConsequencePanel(items) {
  const grid = document.createElement("div");
  grid.className = "vn-consequence-grid";

  (items || []).forEach((item) => {
    grid.appendChild(buildConsequenceCard(item.label, item.value));
  });

  return grid;
}

function buildConsequenceCard(label, value) {
  const direction = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

  const card = document.createElement("div");
  card.className = `vn-consequence-card vn-consequence-card--${direction}`;

  const labelEl = document.createElement("span");
  labelEl.className = "vn-consequence-label";
  labelEl.textContent = label;
  card.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "vn-consequence-value";
  valueEl.textContent = formatSigned(value);
  card.appendChild(valueEl);

  return card;
}

function formatSigned(value) {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "0";
}
"""

VN_LAYOUT_MARKER = "v0.16: Visual Novel RPG Layout Redesign"


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED i PO dla 5 podmienianych ekranow
# ---------------------------------------------------------------------------

GAME_SCREEN_OLD = r"""// gameScreen.js
//
// Morning screen.
// Shows persistent spoons, morning events, player status, partner card,
// relationship bars and relationship mood.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

import { ensureDailyAgenda, getAgendaSlotLabel } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
export function renderGameScreen(container) {
  const state = getState();
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const header = document.createElement("h2");
  header.textContent = `Dzie\u0144 ${state.day} \u2014 ${playerName}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));
  wrapper.appendChild(renderPersistentSpoonsNote());

  const previousEveningSummary = renderPreviousEveningSummary(state);
  if (previousEveningSummary) {
    wrapper.appendChild(previousEveningSummary);
  }

  const morningEvents = renderMorningEvents(state);
  if (morningEvents) {
    wrapper.appendChild(morningEvents);
  }

  wrapper.appendChild(renderDailyAgendaSection(state));

  if (state.player) {
    const statusSentence = document.createElement("p");
    statusSentence.className = "status-sentence";
    statusSentence.textContent = buildStatusSentence(state.player);
    wrapper.appendChild(statusSentence);
  }

  if (state.partner) {
    const npc = state.npcs ? state.npcs[state.partner.id] : undefined;
    wrapper.appendChild(renderPartnerCard(state.partner, npc));
  }

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Wybierz, czym zajmiesz się teraz";
  continueButton.addEventListener("click", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
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

function renderPersistentSpoonsNote() {
  const note = document.createElement("p");
  note.className = "persistent-spoons-note";
  note.textContent = "Spoons nie odnawiają się automatycznie. To, co zostaje po dniu, przechodzi na kolejny poranek.";
  return note;
}

// CLEAN v0.10 previous evening summary helpers START
function renderPreviousEveningSummary(state) {
  const recovery = state.lastEveningRecovery;

  if (!recovery || recovery.day !== state.day - 1) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "previous-evening-summary";

  const heading = document.createElement("p");
  heading.className = "previous-evening-heading";
  heading.textContent = "Wczoraj wieczorem";
  section.appendChild(heading);

  const label = document.createElement("p");
  label.className = "previous-evening-label";
  label.textContent = replacePartnerPlaceholder(recovery.label, state);
  section.appendChild(label);

  const description = document.createElement("p");
  description.className = "previous-evening-description";
  description.textContent = replacePartnerPlaceholder(recovery.description, state);
  section.appendChild(description);

  const effects = document.createElement("p");
  effects.className = "previous-evening-effects";
  effects.textContent = formatPreviousEveningEffects(recovery.effects);
  section.appendChild(effects);

  return section;
}

function formatPreviousEveningEffects(effects) {
  if (!effects) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSignedForPreviousEvening(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSignedForPreviousEvening(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSignedForPreviousEvening(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function replacePartnerPlaceholder(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatSignedForPreviousEvening(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
// CLEAN v0.10 previous evening summary helpers END

function renderMorningEvents(state) {
  const morning = state.todayMorningEvents;

  if (!morning || !Array.isArray(morning.events) || morning.events.length === 0) {
    return null;
  }

  if (morning.day !== state.day) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "morning-events";

  const heading = document.createElement("p");
  heading.className = "morning-events-heading";
  heading.textContent = "Poranek";
  section.appendChild(heading);

  morning.events.forEach((event) => {
    section.appendChild(renderMorningEvent(event));
  });

  if (typeof morning.netSpoonsChange === "number" && morning.netSpoonsChange !== 0) {
    const net = document.createElement("p");
    net.className = "morning-events-net";
    net.textContent = `Bilans poranka: ${formatSigned(morning.netSpoonsChange)} spoons`;
    section.appendChild(net);
  }

  return section;
}

function renderMorningEvent(event) {
  const item = document.createElement("div");
  item.className = `morning-event morning-event--${event.type}`;

  const title = document.createElement("p");
  title.className = "morning-event-title";
  title.textContent = event.title;
  item.appendChild(title);

  const description = document.createElement("p");
  description.className = "morning-event-description";
  description.textContent = event.description;
  item.appendChild(description);

  const effects = buildMorningEventEffects(event);
  if (effects.length > 0) {
    const effectLine = document.createElement("p");
    effectLine.className = "morning-event-effects";
    effectLine.textContent = effects.join(" · ");
    item.appendChild(effectLine);
  }

  return item;
}

function buildMorningEventEffects(event) {
  const effects = [];

  if (typeof event.actualSpoonsChange === "number" && event.actualSpoonsChange !== 0) {
    effects.push(`Spoons ${formatSigned(event.actualSpoonsChange)}`);
  }

  if (typeof event.trustChange === "number" && event.trustChange !== 0) {
    effects.push(`Zaufanie ${formatSigned(event.trustChange)}`);
  }

  if (typeof event.frustrationChange === "number" && event.frustrationChange !== 0) {
    effects.push(`Frustracja ${formatSigned(event.frustrationChange)}`);
  }

  return effects;
}

// CLEAN v0.13 daily agenda helpers START
function renderDailyAgendaSection(state) {
  const agenda = ensureDailyAgenda(state);

  const section = document.createElement("div");
  section.className = "daily-agenda";

  const heading = document.createElement("p");
  heading.className = "daily-agenda-heading";
  heading.textContent = "Agenda dnia";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "daily-agenda-list";

  agenda.slots.forEach((item, index) => {
    list.appendChild(renderDailyAgendaItem(item, index, agenda.currentIndex, agenda.slots.length));
  });

  section.appendChild(list);
  return section;
}

function renderDailyAgendaItem(item, index, currentIndex, totalSlots) {
  const listItem = document.createElement("li");
  const classes = ["daily-agenda-item"];

  if (item.completed) {
    classes.push("daily-agenda-item--completed");
  } else if (index === currentIndex) {
    classes.push("daily-agenda-item--current");
  }

  listItem.className = classes.join(" ");

  const indexLabel = document.createElement("span");
  indexLabel.className = "daily-agenda-index";
  indexLabel.textContent = `[${index + 1}/${totalSlots}]`;
  listItem.appendChild(indexLabel);

  const label = document.createElement("span");
  label.className = "daily-agenda-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  listItem.appendChild(label);

  return listItem;
}
// CLEAN v0.13 daily agenda helpers END

function renderPartnerCard(partner, npc) {
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

  card.appendChild(renderRelationshipState(npc));

  return card;
}

function renderRelationshipState(npc) {
  const section = document.createElement("div");
  section.className = "relationship-state";

  const heading = document.createElement("p");
  heading.className = "relationship-state-heading";
  heading.textContent = "Stan relacji";
  section.appendChild(heading);

  if (!npc) {
    const fallback = document.createElement("p");
    fallback.className = "relationship-state-empty";
    fallback.textContent = "Brak danych";
    section.appendChild(fallback);
    return section;
  }

  section.appendChild(renderRelationshipMeter("Zaufanie", npc.trust, "trust"));
  section.appendChild(renderRelationshipMeter("Frustracja", npc.frustration, "frustration"));
  section.appendChild(renderRelationshipMood(npc));

  return section;
}

function renderRelationshipMeter(label, value, modifier) {
  const safeValue = clampToPercentage(Number(value) || 0);

  const meter = document.createElement("div");
  meter.className = "relationship-meter";

  const labelEl = document.createElement("span");
  labelEl.className = "relationship-meter-label";
  labelEl.textContent = label;
  meter.appendChild(labelEl);

  const track = document.createElement("div");
  track.className = "relationship-meter-track";

  const fill = document.createElement("div");
  fill.className = `relationship-meter-fill relationship-meter-fill--${modifier}`;
  fill.style.width = `${safeValue}%`;
  track.appendChild(fill);
  meter.appendChild(track);

  const valueEl = document.createElement("span");
  valueEl.className = "relationship-meter-value";
  valueEl.textContent = `${safeValue}/100`;
  meter.appendChild(valueEl);

  return meter;
}

function renderRelationshipMood(npc) {
  const mood = buildRelationshipMood(npc);

  const moodSection = document.createElement("div");
  moodSection.className = "relationship-mood";

  const label = document.createElement("p");
  label.className = "relationship-mood-label";
  label.textContent = `Stan emocjonalny relacji: ${mood.label}`;
  moodSection.appendChild(label);

  const description = document.createElement("p");
  description.className = "relationship-mood-description";
  description.textContent = mood.description;
  moodSection.appendChild(description);

  return moodSection;
}

function buildRelationshipMood(npc) {
  const trust = clampToPercentage(Number(npc.trust) || 0);
  const frustration = clampToPercentage(Number(npc.frustration) || 0);

  if (trust >= 70 && frustration <= 25) {
    return {
      label: "Bezpiecznie",
      description: "W tej relacji jest dużo zaufania i niewiele napięcia."
    };
  }

  if (trust >= 50 && frustration <= 45) {
    return {
      label: "Stabilnie",
      description: "Relacja trzyma się dobrze, choć nadal wymaga uważności."
    };
  }

  if (frustration >= 70 && trust >= 40) {
    return {
      label: "Napięcie",
      description: "Zaufanie jeszcze istnieje, ale napięcie zaczyna dominować."
    };
  }

  if (trust < 35 && frustration >= 55) {
    return {
      label: "Krucho",
      description: "Relacja może źle znosić kolejne uniki albo niejasne sygnały."
    };
  }

  if (trust < 35) {
    return {
      label: "Niepewnie",
      description: "W relacji brakuje poczucia bezpieczeństwa."
    };
  }

  if (frustration >= 55) {
    return {
      label: "Przeciążenie",
      description: "Nagromadzone napięcie zaczyna być trudne do ignorowania."
    };
  }

  return {
    label: "Niejasno",
    description: "Relacja jest w ruchu. Jeszcze nie wiadomo, w którą stronę pójdzie."
  };
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function clampToPercentage(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
"""

GAME_SCREEN_NEW = r"""// gameScreen.js
//
// Morning screen.
// v0.16: Visual Novel RPG Layout Redesign. Zamiast długiej pionowej
// kolumny statusów, poranek jest teraz sceną VN (symbol + krótki tekst)
// z boczną kartą gracza i jednym przyciskiem akcji. Istniejące sekcje
// (previous evening summary, morning events, agenda dnia, status
// zdania, karta partnera) NIE zostały usunięte — są teraz kompaktowymi
// kartami wewnątrz sceny (patrz vn-compact-card w CSS), żeby zmieściły
// się bez przewijania całej strony.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";
import { ensureDailyAgenda, getAgendaSlotLabel } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
import { createVnShell, createScenePanel, createPlayerCard, createActionPanel } from "../vnLayout.js";

export function renderGameScreen(container) {
  const state = getState();

  const extraCards = [
    renderPersistentSpoonsNote(),
    renderPreviousEveningSummary(state),
    renderMorningEvents(state),
    renderDailyAgendaSection(state),
    renderStatusSentenceCard(state),
    renderPartnerCardIfPresent(state)
  ];

  const scene = createScenePanel({
    symbol: "🌤️",
    symbolModifier: "morning",
    title: `Dzień ${state.day}`,
    text: "Nowy dzień. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.",
    extra: extraCards
  });

  const side = createPlayerCard(state, `Dzień ${state.day} · Poranek`);

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button vn-choice-button";
  continueButton.textContent = "Otwórz plan dnia";
  continueButton.addEventListener("click", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });

  const actions = createActionPanel([continueButton]);

  const shell = createVnShell({
    screenClass: "morning",
    phaseLabel: "Poranek",
    scene,
    side,
    actions
  });

  container.appendChild(shell);
}

function renderStatusSentenceCard(state) {
  if (!state.player) {
    return null;
  }

  const statusSentence = document.createElement("p");
  statusSentence.className = "status-sentence";
  statusSentence.textContent = buildStatusSentence(state.player);
  return statusSentence;
}

function renderPartnerCardIfPresent(state) {
  if (!state.partner) {
    return null;
  }

  const npc = state.npcs ? state.npcs[state.partner.id] : undefined;
  return renderPartnerCard(state.partner, npc);
}

function renderPersistentSpoonsNote() {
  const note = document.createElement("p");
  note.className = "persistent-spoons-note";
  note.textContent = "Spoons nie odnawiają się automatycznie. To, co zostaje po dniu, przechodzi na kolejny poranek.";
  return note;
}

// CLEAN v0.10 previous evening summary helpers START
function renderPreviousEveningSummary(state) {
  const recovery = state.lastEveningRecovery;

  if (!recovery || recovery.day !== state.day - 1) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "previous-evening-summary";

  const heading = document.createElement("p");
  heading.className = "previous-evening-heading";
  heading.textContent = "Wczoraj wieczorem";
  section.appendChild(heading);

  const label = document.createElement("p");
  label.className = "previous-evening-label";
  label.textContent = replacePartnerPlaceholder(recovery.label, state);
  section.appendChild(label);

  const description = document.createElement("p");
  description.className = "previous-evening-description";
  description.textContent = replacePartnerPlaceholder(recovery.description, state);
  section.appendChild(description);

  const effects = document.createElement("p");
  effects.className = "previous-evening-effects";
  effects.textContent = formatPreviousEveningEffects(recovery.effects);
  section.appendChild(effects);

  return section;
}

function formatPreviousEveningEffects(effects) {
  if (!effects) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSignedForPreviousEvening(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSignedForPreviousEvening(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSignedForPreviousEvening(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function replacePartnerPlaceholder(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatSignedForPreviousEvening(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
// CLEAN v0.10 previous evening summary helpers END

function renderMorningEvents(state) {
  const morning = state.todayMorningEvents;

  if (!morning || !Array.isArray(morning.events) || morning.events.length === 0) {
    return null;
  }

  if (morning.day !== state.day) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "morning-events";

  const heading = document.createElement("p");
  heading.className = "morning-events-heading";
  heading.textContent = "Poranek";
  section.appendChild(heading);

  morning.events.forEach((event) => {
    section.appendChild(renderMorningEvent(event));
  });

  if (typeof morning.netSpoonsChange === "number" && morning.netSpoonsChange !== 0) {
    const net = document.createElement("p");
    net.className = "morning-events-net";
    net.textContent = `Bilans poranka: ${formatSigned(morning.netSpoonsChange)} spoons`;
    section.appendChild(net);
  }

  return section;
}

function renderMorningEvent(event) {
  const item = document.createElement("div");
  item.className = `morning-event morning-event--${event.type}`;

  const title = document.createElement("p");
  title.className = "morning-event-title";
  title.textContent = event.title;
  item.appendChild(title);

  const description = document.createElement("p");
  description.className = "morning-event-description";
  description.textContent = event.description;
  item.appendChild(description);

  const effects = buildMorningEventEffects(event);
  if (effects.length > 0) {
    const effectLine = document.createElement("p");
    effectLine.className = "morning-event-effects";
    effectLine.textContent = effects.join(" · ");
    item.appendChild(effectLine);
  }

  return item;
}

function buildMorningEventEffects(event) {
  const effects = [];

  if (typeof event.actualSpoonsChange === "number" && event.actualSpoonsChange !== 0) {
    effects.push(`Spoons ${formatSigned(event.actualSpoonsChange)}`);
  }

  if (typeof event.trustChange === "number" && event.trustChange !== 0) {
    effects.push(`Zaufanie ${formatSigned(event.trustChange)}`);
  }

  if (typeof event.frustrationChange === "number" && event.frustrationChange !== 0) {
    effects.push(`Frustracja ${formatSigned(event.frustrationChange)}`);
  }

  return effects;
}

// CLEAN v0.13 daily agenda helpers START
function renderDailyAgendaSection(state) {
  const agenda = ensureDailyAgenda(state);

  const section = document.createElement("div");
  section.className = "daily-agenda";

  const heading = document.createElement("p");
  heading.className = "daily-agenda-heading";
  heading.textContent = "Agenda dnia";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "daily-agenda-list";

  agenda.slots.forEach((item, index) => {
    list.appendChild(renderDailyAgendaItem(item, index, agenda.currentIndex, agenda.slots.length));
  });

  section.appendChild(list);
  return section;
}

function renderDailyAgendaItem(item, index, currentIndex, totalSlots) {
  const listItem = document.createElement("li");
  const classes = ["daily-agenda-item"];

  if (item.completed) {
    classes.push("daily-agenda-item--completed");
  } else if (index === currentIndex) {
    classes.push("daily-agenda-item--current");
  }

  listItem.className = classes.join(" ");

  const indexLabel = document.createElement("span");
  indexLabel.className = "daily-agenda-index";
  indexLabel.textContent = `[${index + 1}/${totalSlots}]`;
  listItem.appendChild(indexLabel);

  const label = document.createElement("span");
  label.className = "daily-agenda-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  listItem.appendChild(label);

  return listItem;
}
// CLEAN v0.13 daily agenda helpers END

function renderPartnerCard(partner, npc) {
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

  card.appendChild(renderRelationshipState(npc));

  return card;
}

function renderRelationshipState(npc) {
  const section = document.createElement("div");
  section.className = "relationship-state";

  const heading = document.createElement("p");
  heading.className = "relationship-state-heading";
  heading.textContent = "Stan relacji";
  section.appendChild(heading);

  if (!npc) {
    const fallback = document.createElement("p");
    fallback.className = "relationship-state-empty";
    fallback.textContent = "Brak danych";
    section.appendChild(fallback);
    return section;
  }

  section.appendChild(renderRelationshipMeter("Zaufanie", npc.trust, "trust"));
  section.appendChild(renderRelationshipMeter("Frustracja", npc.frustration, "frustration"));
  section.appendChild(renderRelationshipMood(npc));

  return section;
}

function renderRelationshipMeter(label, value, modifier) {
  const safeValue = clampToPercentage(Number(value) || 0);

  const meter = document.createElement("div");
  meter.className = "relationship-meter";

  const labelEl = document.createElement("span");
  labelEl.className = "relationship-meter-label";
  labelEl.textContent = label;
  meter.appendChild(labelEl);

  const track = document.createElement("div");
  track.className = "relationship-meter-track";

  const fill = document.createElement("div");
  fill.className = `relationship-meter-fill relationship-meter-fill--${modifier}`;
  fill.style.width = `${safeValue}%`;
  track.appendChild(fill);
  meter.appendChild(track);

  const valueEl = document.createElement("span");
  valueEl.className = "relationship-meter-value";
  valueEl.textContent = `${safeValue}/100`;
  meter.appendChild(valueEl);

  return meter;
}

function renderRelationshipMood(npc) {
  const mood = buildRelationshipMood(npc);

  const moodSection = document.createElement("div");
  moodSection.className = "relationship-mood";

  const label = document.createElement("p");
  label.className = "relationship-mood-label";
  label.textContent = `Stan emocjonalny relacji: ${mood.label}`;
  moodSection.appendChild(label);

  const description = document.createElement("p");
  description.className = "relationship-mood-description";
  description.textContent = mood.description;
  moodSection.appendChild(description);

  return moodSection;
}

function buildRelationshipMood(npc) {
  const trust = clampToPercentage(Number(npc.trust) || 0);
  const frustration = clampToPercentage(Number(npc.frustration) || 0);

  if (trust >= 70 && frustration <= 25) {
    return {
      label: "Bezpiecznie",
      description: "W tej relacji jest dużo zaufania i niewiele napięcia."
    };
  }

  if (trust >= 50 && frustration <= 45) {
    return {
      label: "Stabilnie",
      description: "Relacja trzyma się dobrze, choć nadal wymaga uważności."
    };
  }

  if (frustration >= 70 && trust >= 40) {
    return {
      label: "Napięcie",
      description: "Zaufanie jeszcze istnieje, ale napięcie zaczyna dominować."
    };
  }

  if (trust < 35 && frustration >= 55) {
    return {
      label: "Krucho",
      description: "Relacja może źle znosić kolejne uniki albo niejasne sygnały."
    };
  }

  if (trust < 35) {
    return {
      label: "Niepewnie",
      description: "W relacji brakuje poczucia bezpieczeństwa."
    };
  }

  if (frustration >= 55) {
    return {
      label: "Przeciążenie",
      description: "Nagromadzone napięcie zaczyna być trudne do ignorowania."
    };
  }

  return {
    label: "Niejasno",
    description: "Relacja jest w ruchu. Jeszcze nie wiadomo, w którą stronę pójdzie."
  };
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function clampToPercentage(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
"""

AGENDA_SCREEN_OLD = r"""// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// The player chooses which remaining daily agenda slot to handle next.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureDailyAgenda,
  getAvailableAgendaItems,
  selectAgendaItem,
  getAgendaSlotLabel
} from "../../systems/dayAgendaSystem.js";

export function renderAgendaScreen(container) {
  const state = getState();
  const agenda = ensureDailyAgenda(state);
  const availableItems = getAvailableAgendaItems(state);

  if (availableItems.length === 0) {
    state.phase = "evening";
    saveGame(state);
    showScreen("evening");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "screen agenda-choice-screen";

  const title = document.createElement("h2");
  title.textContent = "Agenda dnia";
  wrapper.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "agenda-choice-intro";
  intro.textContent = "Wybierz, czym zajmiesz się teraz.";
  wrapper.appendChild(intro);

  const list = document.createElement("div");
  list.className = "agenda-choice-list";

  agenda.slots.forEach((item, index) => {
    list.appendChild(renderAgendaChoiceButton(item, index, state));
  });

  wrapper.appendChild(list);
  container.appendChild(wrapper);
}

function renderAgendaChoiceButton(item, index, state) {
  const button = document.createElement("button");
  const classes = ["agenda-choice-button"];

  if (item.completed) {
    classes.push("agenda-choice-button--completed");
  }

  button.className = classes.join(" ");
  button.disabled = item.completed;

  const header = document.createElement("span");
  header.className = "agenda-choice-header";

  const marker = document.createElement("span");
  marker.className = "agenda-choice-marker";
  marker.textContent = item.completed ? "[✓]" : "[ ]";
  header.appendChild(marker);

  const label = document.createElement("span");
  label.className = "agenda-choice-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  header.appendChild(label);

  const status = document.createElement("span");
  status.className = "agenda-choice-status";
  status.textContent = item.completed ? "ukończone" : "wybierz";
  header.appendChild(status);

  button.appendChild(header);
  button.appendChild(buildSlotMeta(item, state));

  if (!item.completed) {
    button.addEventListener("click", () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    });
  }

  return button;
}

// CLEAN v0.15 agenda choice cards START
// v0.15: RPG Gameplay Shell. Karty agendy mają teraz komunikować stawkę
// decyzji (obciążenie / ryzyko / hint), zamiast wyglądać jak lista pytań
// quizu. Te wartości są na razie czysto informacyjne — nie wpływają
// jeszcze na mechanikę wyboru ani na losowanie eventów.
function buildSlotMeta(item, state) {
  const meta = document.createElement("span");
  meta.className = "agenda-choice-card-meta";

  const risk = document.createElement("span");
  risk.className = "agenda-choice-risk";
  risk.textContent = `Ryzyko: ${buildSlotRiskLabel(item)}`;
  meta.appendChild(risk);

  const pressure = document.createElement("span");
  pressure.className = "agenda-choice-pressure";
  pressure.textContent = `Obciążenie: ${buildSlotPressure(item, state)}`;
  meta.appendChild(pressure);

  const hint = document.createElement("span");
  hint.className = "agenda-choice-hint";
  hint.textContent = buildSlotOrderHint(item, state);
  meta.appendChild(hint);

  return meta;
}

function buildSlotPressure(item, state) {
  const spoons = state.resources.spoons.current;
  let pressure = "niskie";

  if (spoons <= 3) {
    pressure = "wysokie";
  } else if (spoons <= 6) {
    pressure = "średnie";
  }

  if (item.slot === "relationship") {
    const npc = getPartnerNpc(state);
    if (npc && Number(npc.frustration) >= 60) {
      pressure = "wysokie";
    }
  }

  if (item.slot === "obligation" && spoons <= 3) {
    pressure = "wysokie";
  }

  return pressure;
}

function buildSlotRiskLabel(item) {
  if (item.slot === "relationship") {
    return "emocjonalne";
  }

  if (item.slot === "obligation") {
    return "logistyczne";
  }

  if (item.slot === "inner") {
    return "regulacyjne";
  }

  return "nieznane";
}

function buildSlotOrderHint(item, state) {
  if (item.slot === "relationship") {
    return "Rozmowa później może być trudniejsza, jeśli wcześniej spadną Ci spoons.";
  }

  if (item.slot === "obligation") {
    return "Obowiązki zrobione wcześnie zdejmują presję, ale mogą zużyć energię przed relacją.";
  }

  if (item.slot === "inner") {
    return "Zajęcie się sobą wcześniej może pomóc wejść w resztę dnia spokojniej.";
  }

  return "";
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}
// CLEAN v0.15 agenda choice cards END
"""

AGENDA_SCREEN_NEW = r"""// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.16: Visual Novel RPG Layout Redesign — agenda jest teraz planszą
// wyboru akcji (trzy duże karty) w panelu akcji wspólnego VN shellu,
// zamiast pionowej listy przycisków.
//
// The player chooses which remaining daily agenda slot to handle next.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureDailyAgenda,
  getAvailableAgendaItems,
  selectAgendaItem,
  getAgendaSlotLabel
} from "../../systems/dayAgendaSystem.js";
import { createVnShell, createScenePanel, createPlayerCard, createActionPanel } from "../vnLayout.js";

export function renderAgendaScreen(container) {
  const state = getState();
  const agenda = ensureDailyAgenda(state);
  const availableItems = getAvailableAgendaItems(state);

  if (availableItems.length === 0) {
    state.phase = "evening";
    saveGame(state);
    showScreen("evening");
    return;
  }

  const scene = createScenePanel({
    symbol: "🗒️",
    symbolModifier: "agenda",
    title: "Agenda dnia",
    text: "Wybierz, czym zajmiesz się teraz."
  });

  const side = createPlayerCard(state, `Dzień ${state.day} · Plan dnia`);

  const cards = agenda.slots.map((item, index) => renderAgendaChoiceButton(item, index, state));
  const actions = createActionPanel(cards);

  const shell = createVnShell({
    screenClass: "agenda",
    phaseLabel: "Plan dnia",
    scene,
    side,
    actions
  });

  container.appendChild(shell);
}

function renderAgendaChoiceButton(item, index, state) {
  const button = document.createElement("button");
  const classes = ["agenda-choice-button", "vn-action-card"];

  if (item.completed) {
    classes.push("agenda-choice-button--completed", "vn-action-card--completed");
  }

  button.className = classes.join(" ");
  button.disabled = item.completed;

  const header = document.createElement("span");
  header.className = "agenda-choice-header";

  const marker = document.createElement("span");
  marker.className = "agenda-choice-marker";
  marker.textContent = item.completed ? "[✓]" : "[ ]";
  header.appendChild(marker);

  const label = document.createElement("span");
  label.className = "agenda-choice-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  header.appendChild(label);

  const status = document.createElement("span");
  status.className = "agenda-choice-status";
  status.textContent = item.completed ? "ukończone" : "wybierz";
  header.appendChild(status);

  button.appendChild(header);
  button.appendChild(buildSlotMeta(item, state));

  if (!item.completed) {
    button.addEventListener("click", () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    });
  }

  return button;
}

// CLEAN v0.15 agenda choice cards START
// v0.15: RPG Gameplay Shell. Karty agendy mają teraz komunikować stawkę
// decyzji (obciążenie / ryzyko / hint), zamiast wyglądać jak lista pytań
// quizu. Te wartości są na razie czysto informacyjne — nie wpływają
// jeszcze na mechanikę wyboru ani na losowanie eventów.
function buildSlotMeta(item, state) {
  const meta = document.createElement("span");
  meta.className = "agenda-choice-card-meta vn-action-card-meta";

  const risk = document.createElement("span");
  risk.className = "agenda-choice-risk";
  risk.textContent = `Ryzyko: ${buildSlotRiskLabel(item)}`;
  meta.appendChild(risk);

  const pressure = document.createElement("span");
  pressure.className = "agenda-choice-pressure";
  pressure.textContent = `Obciążenie: ${buildSlotPressure(item, state)}`;
  meta.appendChild(pressure);

  const hint = document.createElement("span");
  hint.className = "agenda-choice-hint";
  hint.textContent = buildSlotOrderHint(item, state);
  meta.appendChild(hint);

  return meta;
}

function buildSlotPressure(item, state) {
  const spoons = state.resources.spoons.current;
  let pressure = "niskie";

  if (spoons <= 3) {
    pressure = "wysokie";
  } else if (spoons <= 6) {
    pressure = "średnie";
  }

  if (item.slot === "relationship") {
    const npc = getPartnerNpc(state);
    if (npc && Number(npc.frustration) >= 60) {
      pressure = "wysokie";
    }
  }

  if (item.slot === "obligation" && spoons <= 3) {
    pressure = "wysokie";
  }

  return pressure;
}

function buildSlotRiskLabel(item) {
  if (item.slot === "relationship") {
    return "emocjonalne";
  }

  if (item.slot === "obligation") {
    return "logistyczne";
  }

  if (item.slot === "inner") {
    return "regulacyjne";
  }

  return "nieznane";
}

function buildSlotOrderHint(item, state) {
  if (item.slot === "relationship") {
    return "Rozmowa później może być trudniejsza, jeśli wcześniej spadną Ci spoons.";
  }

  if (item.slot === "obligation") {
    return "Obowiązki zrobione wcześnie zdejmują presję, ale mogą zużyć energię przed relacją.";
  }

  if (item.slot === "inner") {
    return "Zajęcie się sobą wcześniej może pomóc wejść w resztę dnia spokojniej.";
  }

  return "";
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}
// CLEAN v0.15 agenda choice cards END
"""

EVENT_SCREEN_OLD = r"""// eventScreen.js
//
// Daily event screen.
// v0.8:
// - shows current spoons before choices,
// - disables choices that cost more spoons than the player has,
// - if every choice is too expensive, keeps the cheapest one clickable
//   as the final available option,
// - replaces {partnerName} in title, description and choice labels.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";

import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js";
export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const maxSpoons = state.resources.spoons.max;

  const wrapper = document.createElement("div");
  wrapper.className = "screen event-screen";

  wrapper.appendChild(renderEventProgress(state));

  wrapper.appendChild(renderResourceSummary(currentSpoons, maxSpoons));

  const title = document.createElement("h2");
  title.textContent = replacePlaceholders(event.title, state);
  wrapper.appendChild(title);

  const description = document.createElement("p");
  description.textContent = replacePlaceholders(event.description, state);
  wrapper.appendChild(description);

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  event.choices.forEach((choice) => {
    const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
    choicesList.appendChild(renderChoiceButton(choice, state, currentSpoons, isForced));
  });

  wrapper.appendChild(choicesList);
  container.appendChild(wrapper);
}

function renderEventProgress(state) {
  const progress = getCurrentAgendaProgress(state);

  const label = document.createElement("p");
  label.className = "event-progress";
  label.textContent = `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`;

  return label;
}

function renderResourceSummary(currentSpoons, maxSpoons) {
  const summary = document.createElement("p");
  summary.className = "event-resource-summary";
  summary.textContent = `Dost\u0119pne spoons: ${currentSpoons}/${maxSpoons}`;
  return summary;
}

function getCheapestChoice(choices) {
  return choices.reduce((cheapest, choice) =>
    choice.spoonsCost < cheapest.spoonsCost ? choice : cheapest
  );
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function renderChoiceButton(choice, state, currentSpoons, isForced) {
  const button = document.createElement("button");
  const canAfford = choice.spoonsCost <= currentSpoons;
  const isDisabled = !canAfford && !isForced;

  button.className = buildChoiceButtonClass(isDisabled, isForced);

  const label = document.createElement("span");
  label.className = "choice-label";
  label.textContent = replacePlaceholders(choice.label, state);
  button.appendChild(label);

  const cost = renderChoiceCost(choice, currentSpoons, isDisabled, isForced);
  if (cost) {
    button.appendChild(cost);
  }

  button.disabled = isDisabled;

  if (!isDisabled) {
    button.addEventListener("click", () => {
      resolveEvent(choice.id);
      showScreen("reflection");
    });
  }

  return button;
}

function buildChoiceButtonClass(isDisabled, isForced) {
  const classes = ["choice-button"];

  if (isDisabled) {
    classes.push("choice-button--disabled");
  }

  if (isForced) {
    classes.push("choice-button--forced");
  }

  return classes.join(" ");
}

function renderChoiceCost(choice, currentSpoons, isDisabled, isForced) {
  if (choice.spoonsCost <= 0) {
    return null;
  }

  const cost = document.createElement("span");
  cost.className = "choice-cost";
  cost.textContent = `\u2212 ${choice.spoonsCost} spoons`;

  if (isDisabled) {
    const missing = Math.max(0, choice.spoonsCost - currentSpoons);
    cost.appendChild(renderChoiceNote(` · brakuje ${missing} spoons`));
  } else if (isForced) {
    cost.appendChild(renderChoiceNote(" · ostatnia dost\u0119pna opcja"));
  }

  return cost;
}

function renderChoiceNote(text) {
  const note = document.createElement("span");
  note.className = "choice-unavailable-note";
  note.textContent = text;
  return note;
}
"""

EVENT_SCREEN_NEW = r"""// eventScreen.js
//
// Daily event screen.
// v0.8:
// - shows current spoons before choices,
// - disables choices that cost more spoons than the player has,
// - if every choice is too expensive, keeps the cheapest one clickable
//   as the final available option,
// - replaces {partnerName} in title, description and choice labels.
//
// v0.16: Visual Novel RPG Layout Redesign.
// - event screen jest teraz sceną VN (duży symbol + tytuł + opis) z
//   panelem decyzji na dole,
// - WAŻNA ZMIANA ZASADY: przed wyborem NIE pokazujemy już dokładnych
//   liczb (np. "− 3 spoons"). Zamiast tego pokazujemy jakościowy
//   poziom (Koszt: niskie/średnie/wysokie, Niepewność: niska/średnia/
//   wysoka). Dokładne liczby gracz widzi dopiero PO decyzji, na ekranie
//   refleksji — to się nie zmienia.
// - choice availability by spoons (blokowanie zbyt drogich wyborów,
//   forced cheapest choice) zostaje bez zmian — zmienia się tylko to,
//   co widać, nie logika dostępności.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";
import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js";
import { createVnShell, createScenePanel, createPlayerCard, createActionPanel } from "../vnLayout.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const progress = getCurrentAgendaProgress(state);

  const scene = createScenePanel({
    symbol: "💬",
    symbolModifier: "event",
    title: replacePlaceholders(event.title, state),
    text: replacePlaceholders(event.description, state)
  });

  const side = createPlayerCard(state, `Dzień ${state.day} · Wydarzenie ${progress.current}/${progress.total}`);

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  event.choices.forEach((choice) => {
    const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
    choicesList.appendChild(renderChoiceButton(choice, state, currentSpoons, isForced));
  });

  const actions = createActionPanel([choicesList]);

  const shell = createVnShell({
    screenClass: "event",
    phaseLabel: `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`,
    scene,
    side,
    actions
  });

  container.appendChild(shell);
}

function getCheapestChoice(choices) {
  return choices.reduce((cheapest, choice) =>
    choice.spoonsCost < cheapest.spoonsCost ? choice : cheapest
  );
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function renderChoiceButton(choice, state, currentSpoons, isForced) {
  const button = document.createElement("button");
  const canAfford = choice.spoonsCost <= currentSpoons;
  const isDisabled = !canAfford && !isForced;

  button.className = `${buildChoiceButtonClass(isDisabled, isForced)} vn-choice-button`;

  const label = document.createElement("span");
  label.className = "choice-label";
  label.textContent = replacePlaceholders(choice.label, state);
  button.appendChild(label);

  const cost = renderChoiceCost(choice, currentSpoons, isDisabled, isForced);
  if (cost) {
    button.appendChild(cost);
  }

  button.disabled = isDisabled;

  if (!isDisabled) {
    button.addEventListener("click", () => {
      resolveEvent(choice.id);
      showScreen("reflection");
    });
  }

  return button;
}

function buildChoiceButtonClass(isDisabled, isForced) {
  const classes = ["choice-button"];

  if (isDisabled) {
    classes.push("choice-button--disabled");
  }

  if (isForced) {
    classes.push("choice-button--forced");
  }

  return classes.join(" ");
}

function renderChoiceCost(choice, currentSpoons, isDisabled, isForced) {
  const cost = document.createElement("span");
  cost.className = "choice-cost";
  cost.textContent = `Koszt: ${buildCostTier(choice.spoonsCost)} · Niepewność: ${buildUncertaintyTier(choice)}`;

  if (isDisabled) {
    cost.appendChild(renderChoiceNote(" · niedostępne teraz"));
  } else if (isForced) {
    cost.appendChild(renderChoiceNote(" · ostatnia dost\u0119pna opcja"));
  }

  return cost;
}

// v0.16: zamiast dokładnej liczby spoons (np. "− 3 spoons"), pokazujemy
// tylko jakościowy poziom kosztu. Progi dobrane pod realny zakres
// spoonsCost w eventData.js (0-5).
function buildCostTier(spoonsCost) {
  if (spoonsCost <= 0) {
    return "brak";
  }

  if (spoonsCost <= 2) {
    return "niskie";
  }

  if (spoonsCost <= 4) {
    return "\u015brednie";
  }

  return "wysokie";
}

// v0.16: "niepewność" to jakościowa miara tego, jak mocno wybór może
// poruszyć zaufanie/frustrację — bez ujawniania kierunku ani wartości.
function buildUncertaintyTier(choice) {
  const magnitude = Math.abs(choice.trustChange || 0) + Math.abs(choice.frustrationChange || 0);

  if (magnitude <= 3) {
    return "niska";
  }

  if (magnitude <= 8) {
    return "\u015brednia";
  }

  return "wysoka";
}

function renderChoiceNote(text) {
  const note = document.createElement("span");
  note.className = "choice-unavailable-note";
  note.textContent = text;
  return note;
}
"""

REFLECTION_SCREEN_OLD = r"""// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";

import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const wrapper = document.createElement("div");
  wrapper.className = "screen reflection-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczorna refleksja";
  wrapper.appendChild(title);

  const result = document.createElement("p");
  result.className = "reflection-text";
  result.textContent = resultText;
  wrapper.appendChild(result);

  if (consequences) {
    wrapper.appendChild(renderImpactPanel(consequences, state));
  }

  const summary = document.createElement("p");
  summary.className = "spoons-summary";
  summary.textContent = `Zostało Ci ${state.resources.spoons.current} z ${state.resources.spoons.max} spoons na dziś.`;
  wrapper.appendChild(summary);

  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button";
  endDayButton.textContent = goesBackToAgenda
    ? "Wróć do agendy dnia"
    : "Zakończ dzień";

  endDayButton.addEventListener("click", () => {
    if (goesBackToAgenda) {
      saveGame(state);
      showScreen("agenda");
    } else {
      state.phase = "evening";
      saveGame(state);
      showScreen("evening");
    }
  });

  wrapper.appendChild(endDayButton);

  container.appendChild(wrapper);
}

// CLEAN v0.15 reflection impact panel START
// v0.15: RPG Gameplay Shell. Opakowuje istniejące konsekwencje w bardziej
// "gameplayowy" panel z wyraźnym nagłówkiem, żeby refleksja mocniej
// pokazywała skutek decyzji, zamiast wyglądać jak sam tekst.
function renderImpactPanel(consequences, state) {
  const panel = document.createElement("div");
  panel.className = "reflection-impact-panel";

  const title = document.createElement("p");
  title.className = "reflection-impact-title";
  title.textContent = "Skutek decyzji";
  panel.appendChild(title);

  panel.appendChild(renderConsequences(consequences));

  const dayProgress = buildDayProgressLine(state);
  if (dayProgress) {
    panel.appendChild(dayProgress);
  }

  return panel;
}

function buildDayProgressLine(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;

  const line = document.createElement("p");
  line.className = "reflection-day-progress";
  line.textContent = `Postęp dnia: ${completed}/${total}`;
  return line;
}
// CLEAN v0.15 reflection impact panel END

function renderConsequences(consequences) {
  const section = document.createElement("div");
  section.className = "consequences";

  const heading = document.createElement("p");
  heading.className = "consequences-heading";
  heading.textContent = "Konsekwencje:";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "consequences-list";

  list.appendChild(buildConsequenceItem("Spoons", consequences.spoonsChange));
  list.appendChild(buildConsequenceItem("Zaufanie", consequences.trustChange));
  list.appendChild(buildConsequenceItem("Frustracja", consequences.frustrationChange));

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    list.appendChild(buildConsequenceItem("Przeciążenie", consequences.fatigueChange));
  }

  section.appendChild(list);

  const interpretation = buildInterpretation(consequences);
  if (interpretation) {
    const interpretationText = document.createElement("p");
    interpretationText.className = "consequences-interpretation";
    interpretationText.textContent = interpretation;
    section.appendChild(interpretationText);
  }

  return section;
}

function buildConsequenceItem(label, value) {
  const item = document.createElement("li");
  item.className = "consequences-item";

  const labelSpan = document.createElement("span");
  labelSpan.className = "consequences-label";
  labelSpan.textContent = `${label}:`;
  item.appendChild(labelSpan);

  const valueSpan = document.createElement("span");
  valueSpan.className = "consequences-value";
  valueSpan.textContent = formatSignedNumber(value);
  item.appendChild(valueSpan);

  return item;
}

function buildInterpretation(consequences) {
  const sentences = [];

  if (consequences.trustChange > 0) {
    sentences.push("Ta decyzja trochę wzmocniła poczucie bezpieczeństwa w relacji.");
  } else if (consequences.trustChange < 0) {
    sentences.push("Ta decyzja mogła zostawić w relacji trochę niepewności.");
  }

  if (consequences.frustrationChange > 0) {
    sentences.push("Frustracja partnera wzrosła.");
  } else if (consequences.frustrationChange < 0) {
    sentences.push("Napięcie trochę opadło.");
  }

  if (consequences.spoonsChange < 0) {
    sentences.push("Koszt tej decyzji poczujesz jeszcze dziś.");
  }

  if (consequences.fatigueChange > 0) {
    sentences.push("Ta decyzja zwiększyła przeciążenie, które przejdzie na kolejny dzień.");
  }

  if (sentences.length === 0) {
    return null;
  }

  return sentences.join(" ");
}

function formatSignedNumber(value) {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "0";
}
"""

REFLECTION_SCREEN_NEW = r"""// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.
//
// v0.16: Visual Novel RPG Layout Redesign. To jest ekran, na którym
// gracz PIERWSZY RAZ widzi dokładne liczby dla swojej decyzji (event
// screen celowo ich już nie pokazuje — patrz eventScreen.js). Dlatego
// konsekwencje są tu teraz dużymi, wyraźnymi kaflami (vn-consequence-*),
// a nie cichą listą tekstu.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";
import {
  createVnShell,
  createScenePanel,
  createPlayerCard,
  createActionPanel,
  createConsequencePanel
} from "../vnLayout.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const sceneExtra = [];
  if (consequences) {
    sceneExtra.push(renderImpactPanel(consequences, state));
  }

  const scene = createScenePanel({
    symbol: "✍️",
    symbolModifier: "reflection",
    title: "Skutek decyzji",
    text: resultText,
    extra: sceneExtra
  });

  const side = createPlayerCard(state, `Dzień ${state.day} · Refleksja`);

  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button vn-choice-button";
  endDayButton.textContent = goesBackToAgenda
    ? "Wróć do agendy dnia"
    : "Zakończ dzień";

  endDayButton.addEventListener("click", () => {
    if (goesBackToAgenda) {
      saveGame(state);
      showScreen("agenda");
    } else {
      state.phase = "evening";
      saveGame(state);
      showScreen("evening");
    }
  });

  const actions = createActionPanel([endDayButton]);

  const shell = createVnShell({
    screenClass: "reflection",
    phaseLabel: "Refleksja",
    scene,
    side,
    actions
  });

  container.appendChild(shell);
}

// CLEAN v0.16 reflection impact panel START
// v0.16: konsekwencje jako duże kafle (vn-consequence-grid) zamiast
// cichej listy <ul>. Dane i interpretacja tekstowa są dokładnie te
// same co w v0.15 — zmienia się tylko prezentacja.
function renderImpactPanel(consequences, state) {
  const panel = document.createElement("div");
  panel.className = "reflection-impact-panel";

  const title = document.createElement("p");
  title.className = "reflection-impact-title";
  title.textContent = "Skutek decyzji";
  panel.appendChild(title);

  const items = [
    { label: "Spoons", value: consequences.spoonsChange },
    { label: "Zaufanie", value: consequences.trustChange },
    { label: "Frustracja", value: consequences.frustrationChange }
  ];

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    items.push({ label: "Przeciążenie", value: consequences.fatigueChange });
  }

  panel.appendChild(createConsequencePanel(items));

  const interpretation = buildInterpretation(consequences);
  if (interpretation) {
    const interpretationText = document.createElement("p");
    interpretationText.className = "consequences-interpretation";
    interpretationText.textContent = interpretation;
    panel.appendChild(interpretationText);
  }

  const spoonsSummary = document.createElement("p");
  spoonsSummary.className = "spoons-summary";
  spoonsSummary.textContent = `Zostało Ci ${state.resources.spoons.current} z ${state.resources.spoons.max} spoons na dziś.`;
  panel.appendChild(spoonsSummary);

  const dayProgress = buildDayProgressLine(state);
  if (dayProgress) {
    panel.appendChild(dayProgress);
  }

  return panel;
}

function buildDayProgressLine(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;

  const line = document.createElement("p");
  line.className = "reflection-day-progress";
  line.textContent = `Postęp dnia: ${completed}/${total}`;
  return line;
}
// CLEAN v0.16 reflection impact panel END

function buildInterpretation(consequences) {
  const sentences = [];

  if (consequences.trustChange > 0) {
    sentences.push("Ta decyzja trochę wzmocniła poczucie bezpieczeństwa w relacji.");
  } else if (consequences.trustChange < 0) {
    sentences.push("Ta decyzja mogła zostawić w relacji trochę niepewności.");
  }

  if (consequences.frustrationChange > 0) {
    sentences.push("Frustracja partnera wzrosła.");
  } else if (consequences.frustrationChange < 0) {
    sentences.push("Napięcie trochę opadło.");
  }

  if (consequences.spoonsChange < 0) {
    sentences.push("Koszt tej decyzji poczujesz jeszcze dziś.");
  }

  if (consequences.fatigueChange > 0) {
    sentences.push("Ta decyzja zwiększyła przeciążenie, które przejdzie na kolejny dzień.");
  }

  if (sentences.length === 0) {
    return null;
  }

  return sentences.join(" ");
}
"""

EVENING_SCREEN_OLD = r"""// eveningScreen.js
//
// v0.9: evening recovery screen.
// Flow:
//   morning -> event -> reflection -> evening -> next morning

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery
} from "../../systems/eveningRecoverySystem.js";
import { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";

export function renderEveningScreen(container) {
  const state = getState();

  const wrapper = document.createElement("div");
  wrapper.className = "screen evening-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczór";
  wrapper.appendChild(title);

  const phaseNote = document.createElement("p");
  phaseNote.className = "evening-phase-note";
  phaseNote.textContent = "Koniec dnia. To, co zostało w zasobach, przechodzi na jutro.";
  wrapper.appendChild(phaseNote);

  const intro = document.createElement("p");
  intro.className = "evening-intro";
  intro.textContent = "Dzień już się wydarzył. Teraz zostaje pytanie, co robisz z resztką siebie.";
  wrapper.appendChild(intro);

  const resourceSummary = document.createElement("p");
  resourceSummary.className = "evening-resource-summary";
  resourceSummary.textContent = `Spoons: ${state.resources.spoons.current}/${state.resources.spoons.max}`;
  wrapper.appendChild(resourceSummary);

  const options = document.createElement("div");
  options.className = "evening-options";

  getEveningRecoveryOptions(state).forEach((option) => {
    options.appendChild(renderEveningOptionButton(option, state));
  });

  wrapper.appendChild(options);
  container.appendChild(wrapper);
}

function renderEveningOptionButton(option, state) {
  const button = document.createElement("button");
  button.className = "evening-option-button";

  const label = document.createElement("span");
  label.className = "evening-option-label";
  label.textContent = replacePlaceholders(option.label, state);
  button.appendChild(label);

  const description = document.createElement("span");
  description.className = "evening-option-description";
  description.textContent = replacePlaceholders(option.description, state);
  button.appendChild(description);

  const effects = document.createElement("span");
  effects.className = "evening-option-effects";
  effects.textContent = formatEffects(option.effects);
  button.appendChild(effects);

    button.addEventListener("click", () => {
    const currentState = getState();
    const completedDay = currentState.day;

    applyEveningRecovery(option.id, currentState);
    advanceToNextDay();
    saveGame(currentState);

    if (shouldShowWeeklySummary(completedDay)) {
      showScreen("weeklySummary");
    } else {
      showScreen("game");
    }
  });

  return button;
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatEffects(effects) {
  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSigned(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSigned(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSigned(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
"""

EVENING_SCREEN_NEW = r"""// eveningScreen.js
//
// v0.9: evening recovery screen.
// Flow:
//   morning -> event -> reflection -> evening -> next morning
//
// v0.16: Visual Novel RPG Layout Redesign. Wieczór ma teraz wyraźnie
// inny, ciemniejszy nastrój (patrz body[data-game-screen="evening"] w
// CSS) i tę samą strukturę VN co reszta ekranów gameplayowych. Logika
// evening recovery i weekly summary flow są nietknięte.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery
} from "../../systems/eveningRecoverySystem.js";
import { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";
import { createVnShell, createScenePanel, createPlayerCard, createActionPanel } from "../vnLayout.js";

export function renderEveningScreen(container) {
  const state = getState();

  const resourceSummary = document.createElement("p");
  resourceSummary.className = "evening-resource-summary";
  resourceSummary.textContent = `Spoons: ${state.resources.spoons.current}/${state.resources.spoons.max}`;

  const scene = createScenePanel({
    symbol: "🌙",
    symbolModifier: "evening",
    title: "Koniec dnia",
    text: "Dzień się domyka. To, co zostało w zasobach, przechodzi na jutro. Dzień już się wydarzył — teraz zostaje pytanie, co robisz z resztką siebie.",
    extra: [resourceSummary]
  });

  const side = createPlayerCard(state, `Dzień ${state.day} · Wieczór`);

  const options = document.createElement("div");
  options.className = "evening-options";

  getEveningRecoveryOptions(state).forEach((option) => {
    options.appendChild(renderEveningOptionButton(option, state));
  });

  const actions = createActionPanel([options]);

  const shell = createVnShell({
    screenClass: "evening",
    phaseLabel: "Wieczór",
    scene,
    side,
    actions
  });

  container.appendChild(shell);
}

function renderEveningOptionButton(option, state) {
  const button = document.createElement("button");
  button.className = "evening-option-button vn-choice-button";

  const label = document.createElement("span");
  label.className = "evening-option-label";
  label.textContent = replacePlaceholders(option.label, state);
  button.appendChild(label);

  const description = document.createElement("span");
  description.className = "evening-option-description";
  description.textContent = replacePlaceholders(option.description, state);
  button.appendChild(description);

  const effects = document.createElement("span");
  effects.className = "evening-option-effects";
  effects.textContent = formatEffects(option.effects);
  button.appendChild(effects);

    button.addEventListener("click", () => {
    const currentState = getState();
    const completedDay = currentState.day;

    applyEveningRecovery(option.id, currentState);
    advanceToNextDay();
    saveGame(currentState);

    if (shouldShowWeeklySummary(completedDay)) {
      showScreen("weeklySummary");
    } else {
      showScreen("game");
    }
  });

  return button;
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatEffects(effects) {
  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSigned(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSigned(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSigned(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
"""


# ---------------------------------------------------------------------------
# Patche CSS: mala zmiana .choice-button + duzy dopisany blok v0.16
# ---------------------------------------------------------------------------

CSS_CHOICE_BUTTON_OLD = r""".choice-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  text-align: left;
  background-color: var(--color-paper);
  border-color: var(--color-line);
  color: var(--color-ink);
}

.choice-button:hover {
  border-color: var(--color-ink);
  background-color: var(--color-panel);
}"""

CSS_CHOICE_BUTTON_NEW = r""".choice-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  text-align: left;
  background-color: var(--color-paper);
  border-color: var(--color-line);
  border-left: 3px solid var(--color-line);
  border-radius: 8px;
  color: var(--color-ink);
}

.choice-button:hover {
  border-color: var(--color-ink);
  border-left-color: var(--color-sage);
  background-color: var(--color-panel);
}"""

VN_SHELL_CSS_BLOCK = r"""/* CLEAN v0.16 visual novel RPG layout */

/* --------------------------------------------------------------------
   Szerszy #app i mniejszy padding body na ekranach gameplayowych,
   żeby zmieścić dwukolumnowy layout bez wymuszania scrolla strony
   na typowym laptopie (1366x768 / 1440x900).
   -------------------------------------------------------------------- */

body[data-game-screen="game"] #app,
body[data-game-screen="morning"] #app,
body[data-game-screen="agenda"] #app,
body[data-game-screen="event"] #app,
body[data-game-screen="reflection"] #app,
body[data-game-screen="evening"] #app,
body[data-game-screen="weeklySummary"] #app {
  max-width: 860px;
}

body[data-game-screen="game"],
body[data-game-screen="morning"],
body[data-game-screen="agenda"],
body[data-game-screen="event"],
body[data-game-screen="reflection"],
body[data-game-screen="evening"],
body[data-game-screen="weeklySummary"] {
  padding-top: var(--space-md);
  padding-bottom: var(--space-md);
}

/* --------------------------------------------------------------------
   VN shell: górny pasek / boczna karta gracza / scena / panel akcji.
   max-height + overflow: hidden na zewnątrz, overflow: auto na
   panelach wewnętrznych — to daje "bez scrolla strony", nawet jeśli
   pojedyncza karta wewnątrz ma więcej treści niż się zmieści.
   -------------------------------------------------------------------- */

.vn-screen {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  background-color: var(--color-panel);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  box-shadow: 0 1px 3px rgba(43, 42, 40, 0.08);
  min-height: calc(100vh - 260px);
  max-height: calc(100vh - 220px);
  overflow: hidden;
}

.vn-topline {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-sm);
}

.vn-main {
  display: grid;
  grid-template-columns: 190px 1fr;
  gap: var(--space-md);
  flex: 1;
  min-height: 0;
}

.vn-side {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.vn-stage {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.vn-actions {
  flex-shrink: 0;
  border-top: 1px solid var(--color-line);
  padding-top: var(--space-sm);
}

@media (max-width: 760px) {
  .vn-screen {
    min-height: 0;
    max-height: none;
    overflow: visible;
  }

  .vn-main {
    grid-template-columns: 1fr;
  }

  .vn-side,
  .vn-stage {
    overflow-y: visible;
  }
}

/* --------------------------------------------------------------------
   Karta gracza (symboliczna: imię, faza, spoons, zaufanie)
   -------------------------------------------------------------------- */

.vn-player-card {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 6px;
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.vn-player-name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-ink);
}

.vn-player-meta {
  margin: 0;
  font-size: 0.7rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.vn-player-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.vn-player-stat-label {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.vn-player-stat-value {
  font-weight: 600;
  color: var(--color-ink);
  font-size: 0.85rem;
  align-self: flex-end;
}

.vn-player-bar {
  height: 6px;
  background-color: var(--color-line);
  border-radius: 3px;
  overflow: hidden;
}

.vn-player-bar-fill {
  height: 100%;
  border-radius: 3px;
}

.vn-player-bar-fill--spoons {
  background-color: var(--color-gold);
}

.vn-player-bar-fill--trust {
  background-color: var(--color-sage);
}

/* --------------------------------------------------------------------
   Scena centralna: duży symbol + tytuł + tekst + kompaktowe karty
   -------------------------------------------------------------------- */

.vn-scene-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.vn-scene-symbol {
  font-size: 2.6rem;
  line-height: 1;
  text-align: center;
  padding: var(--space-md) 0;
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 6px;
}

.vn-scene-symbol--morning {
  background-color: #EFEAE0;
}

.vn-scene-symbol--agenda {
  background-color: #EAE6DA;
}

.vn-scene-symbol--event {
  background-color: var(--color-panel);
}

.vn-scene-symbol--reflection {
  background-color: var(--color-paper);
}

.vn-scene-symbol--evening {
  background-color: #33302B;
}

.vn-scene-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 400;
  border-bottom: none;
  padding-bottom: 0;
  color: var(--color-ink);
}

.vn-scene-text {
  color: var(--color-ink);
  font-size: 0.95rem;
}

.vn-scene-text p {
  margin: 0 0 var(--space-sm) 0;
}

.vn-compact-card {
  max-height: 130px;
  overflow-y: auto;
  padding: var(--space-sm);
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 6px;
  font-size: 0.85rem;
}

/* --------------------------------------------------------------------
   Panel akcji: siatka kart (agenda) albo lista przycisków dialogowych
   -------------------------------------------------------------------- */

.vn-action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
}

@media (max-width: 760px) {
  .vn-action-grid {
    grid-template-columns: 1fr;
  }
}

.vn-action-card {
  border-radius: 8px;
}

.vn-action-card--completed {
  opacity: 0.6;
}

.vn-action-card-meta {
  font-size: 0.75rem;
}

.vn-choice-button {
  border-radius: 8px;
}

/* --------------------------------------------------------------------
   Konsekwencje jako duże, wyraźne kafle (reflection screen)
   -------------------------------------------------------------------- */

.vn-consequence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space-sm);
  margin: var(--space-sm) 0;
}

.vn-consequence-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-sm);
  background-color: var(--color-panel);
  border: 1px solid var(--color-line);
  border-radius: 8px;
  text-align: center;
}

.vn-consequence-label {
  font-size: 0.7rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.vn-consequence-value {
  font-size: 1.4rem;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--color-ink);
}

.vn-consequence-card--positive .vn-consequence-value {
  color: var(--color-sage);
}

.vn-consequence-card--negative .vn-consequence-value {
  color: var(--color-rose);
}

.vn-consequence-card--neutral .vn-consequence-value {
  color: var(--color-muted);
}
/* END CLEAN v0.16 visual novel RPG layout */
"""

VN_SHELL_CSS_MARKER = "CLEAN v0.16 visual novel RPG layout"


# ---------------------------------------------------------------------------
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        "export const GAME_VERSION = \"v0.15\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.15\";",
        "export const GAME_VERSION = \"v0.16\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.16\";",
        "GAME_VERSION -> v0.16",
    ),
]

INDEX_HTML_PATCHES = [
    (
        "  <script type=\"module\" src=\"./js/main.js?v=150\"></script>",
        "  <script type=\"module\" src=\"./js/main.js?v=160\"></script>",
        "cache-bust ?v=160 w index.html",
    ),
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.16 (Visual Novel RPG Layout Redesign)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f"Podaj poprawna sciezke jako argument, np.:\n"
            f'  python apply_clean_v0_16_visual_novel_rpg_layout.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/ui/uiManager.js",
        "js/ui/gameHud.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/agendaScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eveningScreen.js",
        "js/ui/screens/weeklySummaryScreen.js",
        "js/systems/dayAgendaSystem.js",
        "js/systems/dayCycle.js",
        "js/state/gameState.js",
        "js/data/versionData.js",
        "index.html",
        "css/style.css",
    ]

    missing = [f for f in expected_files if not (project_root / f).exists()]
    if missing:
        raise UpdaterError(
            "Brakuje oczekiwanych plikow w projekcie:\n"
            + "\n".join(f"  - {f}" for f in missing)
            + "\n\nTo repo wyglada inaczej niz zakladal ten updater. Przerywam."
        )

    print("Sanity check OK - wszystkie oczekiwane pliki znalezione.\n")

    print("1/8 js/ui/vnLayout.js")
    create_new_file_if_needed(
        project_root / "js/ui/vnLayout.js",
        VN_LAYOUT_JS,
        VN_LAYOUT_MARKER,
        "utworzenie vnLayout.js",
    )
    print()

    print("2/8 js/ui/screens/gameScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/gameScreen.js", GAME_SCREEN_OLD, GAME_SCREEN_NEW, "gameScreen.js -> layout VN")
    print()

    print("3/8 js/ui/screens/agendaScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/agendaScreen.js", AGENDA_SCREEN_OLD, AGENDA_SCREEN_NEW, "agendaScreen.js -> layout VN")
    print()

    print("4/8 js/ui/screens/eventScreen.js (pelna podmiana, w tym ukrycie dokladnych kosztow)")
    replace_whole_file(project_root / "js/ui/screens/eventScreen.js", EVENT_SCREEN_OLD, EVENT_SCREEN_NEW, "eventScreen.js -> layout VN + jakosciowe koszty")
    print()

    print("5/8 js/ui/screens/reflectionScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/reflectionScreen.js", REFLECTION_SCREEN_OLD, REFLECTION_SCREEN_NEW, "reflectionScreen.js -> layout VN + kafle konsekwencji")
    print()

    print("6/8 js/ui/screens/eveningScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/eveningScreen.js", EVENING_SCREEN_OLD, EVENING_SCREEN_NEW, "eveningScreen.js -> layout VN")
    print()

    print("7/8 css/style.css")
    apply_patches(project_root / "css/style.css", [(CSS_CHOICE_BUTTON_OLD, CSS_CHOICE_BUTTON_NEW, "choice-button -> wyglad przycisku dialogowego")])
    append_css_block_if_needed(project_root / "css/style.css", VN_SHELL_CSS_BLOCK, VN_SHELL_CSS_MARKER, "dopisanie bloku CSS visual novel RPG layout")
    print()

    print("8/8 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.16 (Visual Novel RPG Layout Redesign) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Uruchom gre (otworz index.html w przegladarce / serwuj lokalnie).
 2. Sprawdz badge: powinno pokazywac "Out of Spoons v0.16".
 3. Zacznij nowa gre.
 4. Na typowym laptopie (1366x768 / 1440x900) glowny flow NIE powinien
    wymagac przewijania calej strony (sprawdz w prawdziwej przegladarce -
    to jedyne, czego nie moglem zweryfikowac automatycznie).
 5. Poranek: duzy symbol sceny, karta gracza po lewej, jeden przycisk
    "Otworz plan dnia".
 6. Agenda: trzy duze karty akcji (Obowiazek/Relacja/Wewnetrzne) z
    ryzykiem/obciazeniem/hintem - nie lista pytan.
 7. Event: scena z duzym symbolem, tytul, opis, przyciski dialogowe.
    WAZNE: przed wyborem NIE ma dokladnych liczb typu "-3 spoons" -
    tylko "Koszt: niskie/srednie/wysokie" i "Niepewnosc: ...".
 8. Refleksja: duze, wyrazne kafle z liczbami (Spoons -2, Zaufanie +1
    itd.) - to jedyne miejsce, gdzie dokladne liczby sa widoczne.
 9. Wieczor: wyraznie ciemniejszy/spokojniejszy nastroj.
10. Po 1. i 2. evencie wraca sie do agendy ("Wroc do agendy dnia").
11. Po 3. evencie przechodzi sie do wieczoru ("Zakoncz dzien").
12. Spoons nadal NIE resetuja sie do maksimum miedzy dniami.
13. Po dniu 7 weekly summary nadal dziala.
14. Globalny HUD (gorny pasek ze statystykami) nadal widoczny na
    wszystkich ekranach gameplayowych - nie zostal usuniety.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)
