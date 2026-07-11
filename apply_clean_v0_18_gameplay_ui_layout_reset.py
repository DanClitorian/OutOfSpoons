#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_18_gameplay_ui_layout_reset.py

Updater dla Out of Spoons: v0.17.5 -> v0.18 (Gameplay UI Layout Reset).

BAZA: repo faktycznie na v0.17.5 w momencie przygotowania tego
updatera (potwierdzone: badge "Out of Spoons v0.17.5", index.html
"?v=175", commit "WIP: state before v0.18 layout reset"). Wszystkie
"OLD" stale ponizej zostaly wziete bezposrednio z realnego stanu repo
(git show HEAD) w momencie przygotowania tego skryptu.

TO NIE JEST KOLEJNY HOTFIX. Po pieciu warstwach hotfixow (v0.17.1 -
v0.17.5) w css/style.css (ponad 1500 linii gestego !important, ktore
zaczely ze soba kolidowac), ten updater robi CZYSTY RESET gameplay UI:

  - NOWY plik js/ui/oosLayout.js: kompletnie nowy, izolowany system
    layoutu (namespace ".oos-*") - createTopBar, createSidebar,
    createPlayerCard, createScenePanel, createNarrativeStrip,
    createDecisionCard, createResultTile, createCtaButton,
    createGameShell. Zero zaleznosci od starych .vn-* / .choice-button /
    .primary-button. Stary js/ui/vnLayout.js zostaje w repo NIEUZYWANY
    (jak js/ui/gameHud.js po v0.17) - bezpieczniejsze niz usuwanie
    pliku, zero ryzyka zlamania czegos, co go jeszcze gdzies importuje.

  - NOWY plik css/game-ui-v0-18.css: kompletny, samodzielny system
    stylow dla gameplay UI, zaladowany w index.html PO css/style.css.
    Body/#app scoping jest w PELNI SAMODZIELNY (oparty o
    body[data-game-screen="..."], ktore uiManager.js i tak juz zawsze
    ustawia) - NIE polega na starym mechanizmie ":has(.vn-screen)" z
    poprzednich hotfixow (ktory i tak przestalby dzialac poprawnie,
    bo .vn-screen nigdzie juz nie wystepuje po tym resecie).

  - PODMIENIA CALA ZAWARTOSC 5 plikow ekranow gameplayowych (pelny
    redesign struktury, uzywaja teraz WYLACZNIE oosLayout.js):
      js/ui/screens/gameScreen.js
      js/ui/screens/agendaScreen.js
      js/ui/screens/eventScreen.js
      js/ui/screens/reflectionScreen.js
      js/ui/screens/eveningScreen.js

  - Karty decyzji (.oos-decision-card) NIGDY nie ucinaja tytulu w
    polowie slowa: tytul ma line-clamp:2 z pelnymi slowami i elegancka
    elipsa, nie hard cutoff. Evening (5 opcji, potwierdzone w
    eveningRecoveryData.js) dostaje siatke 5 rownych kolumn w jednym
    rzedzie (z fallbackiem do 3 kolumn na waskich oknach) - NIE
    2 kolumny x 3 rzedy jak w zepsutej wersji v0.17.4/v0.17.5.

  - Result tiles (.oos-result-tile) sa jawnie NIEKLIKALNE: cursor:
    default, pointer-events:none, brak hover/transform, cienka ramka -
    wyraznie inny styl niz .oos-decision-card i .oos-cta-button.

  - Character creator i menu NIE dostaja .oos-game - zostaja w
    klasycznym, waskim (max-width 640px), przewijalnym layoucie,
    calkowicie niezaleznie od tego, co robi reszta pliku.

Nie zmienia saveVersion. Nie zmienia zadnej mechaniki gry (eventData.js,
dayAgendaSystem.js, dayCycle.js, eveningRecoverySystem.js,
weeklySummarySystem.js, saveManager.js sa nietkniete) - to wylacznie UI.
js/ui/uiManager.js i css/style.css NIE sa zmieniane (uiManager.js juz
ustawia body[data-game-screen], czego potrzebuje nowy CSS; stary
css/style.css zostaje w repo jako nieuzywany bagaz, celowo nietkniety -
nowy plik laduje sie PO nim i wygrywa dzieki bardziej celowanym
selektorom + !important tam, gdzie to konieczne).

Skrypt jest idempotentny: mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane, a nie duplikowane/nadpisywane ponownie.

WAZNE dla pelnych podmian plikow: poniewaz sa PODMIENIANE W CALOSCI
(nie male fragmenty), ten updater wymaga, zeby zawartosc plikow w
repo dokladnie odpowiadala stanowi v0.17.5 sprzed patcha. Jesli plik
lokalnie rozni sie (np. reczna edycja nieopublikowana jeszcze na
GitHubie), updater PRZERWIE dzialanie z jasnym komunikatem zamiast
zgadywac lub nadpisywac cos po cichu.

Uzycie:
    python apply_clean_v0_18_gameplay_ui_layout_reset.py

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
    Idempotentnosc: jesli new_str jest juz w pliku, patch jest pomijany.
    Bezpieczenstwo: jesli old_str nie wystepuje dokladnie raz, przerywamy.
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
    Uzywane dla plikow podmienianych w calosci. Idempotentne i
    bezpieczne - patrz apply_patches.
    """
    current = read_text(path)

    if current == new_content:
        print(f"  [pominieto] {label} (juz zastosowano)")
        return

    if current != old_content:
        raise UpdaterError(
            f"{path}\n"
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.17.5 sprzed\n"
            f"  patcha, ani stanowi v0.18 po patchu. Plik mogl zostac\n"
            f"  recznie zmieniony od czasu przygotowania tego updatera.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie roznice\n"
            f"  (np. git diff) przed ponowna proba."
        )

    write_text(path, new_content)
    print(f"  [ok] {label} (plik podmieniony w calosci)")


def create_new_file_if_needed(path: Path, content: str, marker: str, label: str) -> None:
    if path.exists():
        existing = read_text(path)
        if marker in existing:
            print(f"  [pominieto] {label} (plik juz istnieje z oczekiwana zawartoscia)")
            return
        raise UpdaterError(
            f"{path}\n"
            f"  Plik juz istnieje, ale nie zawiera oczekiwanego markera v0.18.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie."
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    write_text(path, content)
    print(f"  [ok] {label} (nowy plik utworzony)")


# ---------------------------------------------------------------------------
# Zawartosc nowych plikow: js/ui/oosLayout.js oraz css/game-ui-v0-18.css
# ---------------------------------------------------------------------------

OOS_LAYOUT_JS = r"""// oosLayout.js
//
// v0.18: Gameplay UI Layout Reset.
//
// Po pięciu hotfixach (v0.17.1-v0.17.5) stare klasy .vn-* zebrały zbyt
// wiele warstw konfliktujących reguł CSS, żeby dalej je bezpiecznie
// łatać. Ten moduł to CAŁKOWICIE NOWY, izolowany system layoutu
// gameplayowego, namespacowany przez klasę ".oos-game" — nic z niego
// nie zależy od starych klas .vn-*, .choice-button, .primary-button
// itd. Stary js/ui/vnLayout.js zostaje w repo nieużywany (podobnie jak
// js/ui/gameHud.js po v0.17) — bezpieczniejsze niż usuwanie plików,
// zero ryzyka złamania czegoś, co go jeszcze gdzieś importuje.
//
// Struktura (patrz assets/references/mockup-flow.png):
//
// <div class="oos-game oos-game--{screenClass}">
//   <header class="oos-topbar">...</header>              (jedyny HUD)
//   <aside class="oos-sidebar">
//     <section class="oos-player-card">...</section>
//     <section class="oos-relationship-card">...</section>
//   </aside>
//   <main class="oos-stage">
//     <section class="oos-scene oos-scene--{modifier}">...</section>
//     <section class="oos-narrative">...</section>
//   </main>
//   <section class="oos-actions oos-actions--{variant}">
//     ...oos-decision-card / oos-result-tile / oos-cta-button...
//   </section>
// </div>
//
// Ten moduł NIE zawiera żadnej logiki gry — tylko buduje DOM. Nie wie
// nic o spoons, eventach, agendzie itd. poza tym, co dostanie w opcjach.

const SCREEN_PHASE_LABELS = {
  game: "Poranek",
  morning: "Poranek",
  agenda: "Plan dnia",
  event: "Wydarzenie",
  reflection: "Refleksja",
  evening: "Wieczór",
  weeklySummary: "Podsumowanie tygodnia"
};

// Ścieżki do assetów scen — patrz assets/ASSET_MANIFEST_v0_17.md.
// Ścieżki są względne do index.html (root repo).
const SCENE_ASSET_PATHS = {
  morning: "assets/scenes/scene-morning.png",
  agenda: "assets/scenes/scene-agenda.jpg",
  event: "assets/scenes/scene-event.png",
  reflection: "assets/scenes/scene-reflection.png",
  evening: "assets/scenes/scene-evening.png"
};

/**
 * Zamienia nazwę ekranu (jak w uiManager.js "screens") na etykietę fazy
 * dnia czytelną dla gracza.
 */
export function getPhaseLabel(screenName) {
  return SCREEN_PHASE_LABELS[screenName] || "";
}

/**
 * Buduje górny pasek — JEDYNY HUD w grze: dzień, faza, spoons, zaufanie.
 *
 * @param {object} state - aktualny stan gry (getState())
 * @param {string} screenName - nazwa ekranu (jak w uiManager.js "screens")
 * @param {string} [overridePhaseText] - dokładniejszy tekst fazy (np.
 *   "Wydarzenie 2/3 — Relacja") zamiast domyślnej etykiety ekranu
 */
export function createTopBar(state, screenName, overridePhaseText) {
  const bar = document.createElement("header");
  bar.className = "oos-topbar";

  const dayPhase = document.createElement("span");
  dayPhase.className = "oos-topbar-daylabel";
  dayPhase.textContent = `Dzień ${state.day} · ${overridePhaseText || getPhaseLabel(screenName)}`;
  bar.appendChild(dayPhase);

  const stats = document.createElement("div");
  stats.className = "oos-topbar-stats";

  const spoons = state.resources ? state.resources.spoons : null;
  if (spoons) {
    stats.appendChild(buildTopBarStat("🥄", `${spoons.current}/${spoons.max}`, "spoons"));
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    stats.appendChild(buildTopBarStat("🤝", `${clampPercent(npc.trust)}`, "trust"));
  }

  bar.appendChild(stats);

  return bar;
}

function buildTopBarStat(icon, valueText, modifier) {
  const stat = document.createElement("span");
  stat.className = `oos-topbar-stat oos-topbar-stat--${modifier}`;

  const iconEl = document.createElement("span");
  iconEl.className = "oos-topbar-stat-icon";
  iconEl.setAttribute("aria-hidden", "true");
  iconEl.textContent = icon;
  stat.appendChild(iconEl);

  const valueEl = document.createElement("span");
  valueEl.className = "oos-topbar-stat-value";
  valueEl.textContent = valueText;
  stat.appendChild(valueEl);

  return stat;
}

/**
 * Buduje pełną planszę gry z gotowych elementów DOM.
 *
 * @param {object} options
 * @param {string} options.screenClass - "morning" | "agenda" | "event" |
 *   "reflection" | "evening" (dołączany jako "oos-game--{screenClass}")
 * @param {HTMLElement} options.topbar - wynik createTopBar()
 * @param {HTMLElement} options.sidebar - wynik createSidebar()
 * @param {HTMLElement} options.scene - wynik createScenePanel()
 * @param {HTMLElement} options.narrative - wynik createNarrativeStrip()
 * @param {Array<HTMLElement|null>} options.actions - dzieci panelu akcji
 *   (oos-decision-card / oos-result-tile / oos-cta-button)
 * @param {string} [options.actionsVariant] - modyfikator layoutu panelu
 *   akcji (np. "single", "triple", "flow", "reflection", "evening-5")
 */
export function createGameShell(options) {
  const { screenClass, topbar, sidebar, scene, narrative, actions, actionsVariant } = options || {};

  const shell = document.createElement("div");
  shell.className = `oos-game oos-game--${screenClass || "default"}`;

  if (topbar) {
    shell.appendChild(topbar);
  }

  if (sidebar) {
    shell.appendChild(sidebar);
  }

  const stage = document.createElement("main");
  stage.className = "oos-stage";
  if (scene) {
    stage.appendChild(scene);
  }
  if (narrative) {
    stage.appendChild(narrative);
  }
  shell.appendChild(stage);

  const actionsSection = document.createElement("section");
  actionsSection.className = actionsVariant
    ? `oos-actions oos-actions--${actionsVariant}`
    : "oos-actions";

  (actions || []).forEach((child) => {
    if (child) {
      actionsSection.appendChild(child);
    }
  });

  shell.appendChild(actionsSection);

  return shell;
}

/**
 * Buduje lewy sidebar: karta postaci + (jeśli jest partner) karta
 * relacji. Obie karty są bezpośrednim rodzeństwem w jednym pionowym
 * gridzie, żeby CSS mogło je zbalansować bez ryzyka przycięcia.
 *
 * @param {object} state - aktualny stan gry (getState())
 * @param {string} screenName - nazwa ekranu, do etykiety fazy
 */
export function createSidebar(state, screenName) {
  const sidebar = document.createElement("aside");
  sidebar.className = "oos-sidebar";

  sidebar.appendChild(createPlayerCard(state, screenName));

  const relationshipCard = createRelationshipCard(state);
  if (relationshipCard) {
    sidebar.appendChild(relationshipCard);
  }

  return sidebar;
}

/**
 * Karta postaci: imię, dzień/faza, spoons, zaufanie. CELOWO bez
 * długiego statusu osobowości ("Możesz usunąć status line z player
 * card") — to zwalnia miejsce, żeby karta relacji obok zawsze mieściła
 * się w całości.
 */
export function createPlayerCard(state, screenName) {
  const card = document.createElement("section");
  card.className = "oos-player-card";

  const badge = document.createElement("p");
  badge.className = "oos-player-card-badge";
  badge.textContent = "Twoja postać";
  card.appendChild(badge);

  const name = document.createElement("p");
  name.className = "oos-player-card-name";
  name.textContent = state && state.player ? state.player.name : "Ty";
  card.appendChild(name);

  const meta = document.createElement("p");
  meta.className = "oos-player-card-meta";
  meta.textContent = `Dzień ${state.day} · ${getPhaseLabel(screenName)}`;
  card.appendChild(meta);

  const spoons = state && state.resources ? state.resources.spoons : null;
  if (spoons) {
    card.appendChild(
      buildStatBar("🥄 Spoons", `${spoons.current}/${spoons.max}`, percent(spoons.current, spoons.max), "spoons")
    );
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    card.appendChild(
      buildStatBar("🤝 Zaufanie", `${clampPercent(npc.trust)}`, clampPercent(npc.trust), "trust")
    );
  }

  return card;
}

/**
 * Karta relacji: imię partnera, etykieta relacji, zaufanie, frustracja,
 * mood. Zwraca null, jeśli nie ma jeszcze partnera w stanie gry.
 */
function createRelationshipCard(state) {
  const npc = getPartnerNpc(state);
  const partner = state && state.partner ? state.partner : null;

  if (!npc || !partner) {
    return null;
  }

  const card = document.createElement("section");
  card.className = "oos-relationship-card";

  const heading = document.createElement("p");
  heading.className = "oos-relationship-card-heading";
  heading.textContent = "Relacja";
  card.appendChild(heading);

  const name = document.createElement("p");
  name.className = "oos-relationship-card-name";
  name.textContent = partner.name;
  card.appendChild(name);

  const label = document.createElement("p");
  label.className = "oos-relationship-card-label";
  label.textContent = partner.relationshipLabel || "Osoba partnerska";
  card.appendChild(label);

  card.appendChild(
    buildStatBar("🤝 Zaufanie", `${clampPercent(npc.trust)}/100`, clampPercent(npc.trust), "trust")
  );
  card.appendChild(
    buildStatBar("🌡️ Frustracja", `${clampPercent(npc.frustration)}/100`, clampPercent(npc.frustration), "frustration")
  );

  const mood = document.createElement("p");
  mood.className = "oos-relationship-card-mood";
  mood.textContent = `Mood: ${buildRelationshipMoodLabel(npc)}`;
  card.appendChild(mood);

  return card;
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

function buildStatBar(label, valueText, percentValue, modifier) {
  const stat = document.createElement("div");
  stat.className = "oos-stat-bar";

  const row = document.createElement("div");
  row.className = "oos-stat-bar-row";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "oos-stat-bar-value";
  valueEl.textContent = valueText;
  row.appendChild(valueEl);

  stat.appendChild(row);

  const track = document.createElement("div");
  track.className = "oos-stat-bar-track";

  const fill = document.createElement("div");
  fill.className = `oos-stat-bar-fill oos-stat-bar-fill--${modifier}`;
  fill.style.width = `${percentValue}%`;
  track.appendChild(fill);

  stat.appendChild(track);

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
 * Buduje centralny panel sceny: tło = asset graficzny danej fazy +
 * tab z tytułem w rogu. To ma być największy, najbardziej atrakcyjny
 * element ekranu (mockup-flow.png) — dlatego tekst NIE jest tu
 * renderowany, patrz createNarrativeStrip().
 *
 * @param {object} options
 * @param {string} options.modifier - "morning" | "agenda" | "event" |
 *   "reflection" | "evening" — wybiera asset tła i klasę CSS
 * @param {string} [options.title] - tytuł pokazywany w tabie
 */
export function createScenePanel(options) {
  const { modifier, title } = options || {};

  const scene = document.createElement("section");
  scene.className = `oos-scene oos-scene--${modifier || "default"}`;

  const assetPath = SCENE_ASSET_PATHS[modifier];
  if (assetPath) {
    scene.style.backgroundImage = `url("${assetPath}")`;
  }

  if (title) {
    const tab = document.createElement("div");
    tab.className = "oos-scene-title";
    tab.textContent = title;
    scene.appendChild(tab);
  }

  return scene;
}

/**
 * Buduje pasek narracji pod sceną. CELOWO pokazuje TYLKO główny tekst
 * (opis eventu, echo decyzji, wstęp poranka) — żadnych mini-kart z
 * agendą/partnerem/morning events. To robiło bałagan we wcześniejszych
 * wersjach (v0.16-v0.17.5) i nie wraca tu.
 *
 * @param {string} text
 */
export function createNarrativeStrip(text) {
  const strip = document.createElement("section");
  strip.className = "oos-narrative";

  const paragraph = document.createElement("p");
  paragraph.className = "oos-narrative-text";
  paragraph.textContent = text || "";
  strip.appendChild(paragraph);

  return strip;
}

/**
 * Buduje klikalną kartę decyzji (agenda slot / event choice / evening
 * option) — ikonka + tytuł + opcjonalny status + opcjonalny opis +
 * opcjonalne linie meta (ryzyko/napięcie/koszt/hint), każda jako
 * osobny element (nigdy sklejone w jeden string).
 *
 * @param {object} options
 * @param {string} [options.icon]
 * @param {string} options.title
 * @param {string} [options.statusText] - np. "wybierz" / "ukończone"
 * @param {string} [options.description]
 * @param {Array<string|null>} [options.metaLines]
 * @param {boolean} [options.disabled]
 * @param {Function} [options.onClick]
 */
export function createDecisionCard(options) {
  const { icon, title, statusText, description, metaLines, disabled, onClick } = options || {};

  const card = document.createElement("button");
  card.type = "button";
  card.className = disabled ? "oos-decision-card oos-decision-card--disabled" : "oos-decision-card";
  card.disabled = !!disabled;

  const header = document.createElement("span");
  header.className = "oos-decision-card-header";

  if (icon) {
    const iconEl = document.createElement("span");
    iconEl.className = "oos-decision-card-icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.textContent = icon;
    header.appendChild(iconEl);
  }

  const titleEl = document.createElement("span");
  titleEl.className = "oos-decision-card-title";
  titleEl.textContent = title || "";
  header.appendChild(titleEl);

  if (statusText) {
    const statusEl = document.createElement("span");
    statusEl.className = "oos-decision-card-status";
    statusEl.textContent = statusText;
    header.appendChild(statusEl);
  }

  card.appendChild(header);

  if (description) {
    const descEl = document.createElement("span");
    descEl.className = "oos-decision-card-description";
    descEl.textContent = description;
    card.appendChild(descEl);
  }

  if (Array.isArray(metaLines)) {
    const meaningfulLines = metaLines.filter((line) => !!line);

    if (meaningfulLines.length > 0) {
      const metaEl = document.createElement("span");
      metaEl.className = "oos-decision-card-meta";

      meaningfulLines.forEach((line) => {
        const lineEl = document.createElement("span");
        lineEl.className = "oos-decision-card-meta-line";
        lineEl.textContent = line;
        metaEl.appendChild(lineEl);
      });

      card.appendChild(metaEl);
    }
  }

  if (!disabled && typeof onClick === "function") {
    card.addEventListener("click", onClick);
  }

  return card;
}

/**
 * Buduje NIEKLIKALNY kafel wyniku (Spoons/Zaufanie/Frustracja na
 * reflection screen). Wygląda wyraźnie inaczej niż oos-decision-card:
 * cienka ramka, brak hover/lift, cursor:default, pointer-events:none
 * (patrz CSS) — to czytelny raport, nie przycisk.
 *
 * @param {object} options
 * @param {string} [options.icon]
 * @param {string} options.label
 * @param {number} options.value
 */
export function createResultTile(options) {
  const { icon, label, value } = options || {};
  const direction = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

  const tile = document.createElement("div");
  tile.className = `oos-result-tile oos-result-tile--${direction}`;

  const labelEl = document.createElement("span");
  labelEl.className = "oos-result-tile-label";
  labelEl.textContent = icon ? `${icon} ${label}` : label;
  tile.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "oos-result-tile-value";
  valueEl.textContent = formatSigned(value);
  tile.appendChild(valueEl);

  return tile;
}

/**
 * Buduje jedyny element w panelu akcji, który MA wyglądać jak
 * klikalny przycisk (np. "Otwórz plan dnia", "Wróć do planu dnia").
 *
 * @param {string} text
 * @param {Function} onClick
 */
export function createCtaButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "oos-cta-button";
  button.textContent = text;

  if (typeof onClick === "function") {
    button.addEventListener("click", onClick);
  }

  return button;
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

OOS_LAYOUT_MARKER = "v0.18: Gameplay UI Layout Reset"


GAME_UI_CSS = r"""/* game-ui-v0-18.css
 *
 * v0.18: Gameplay UI Layout Reset.
 *
 * Ten plik jest ładowany w index.html PO css/style.css, więc jest
 * ostatnim źródłem stylu — ale to nie jest jego mechanizm izolacji.
 * Izolacja działa przez NAMESPACE: wszystko tu jest spięte przez klasę
 * ".oos-game" i jej potomków (.oos-*). Stare klasy z css/style.css
 * (.vn-*, .choice-button, .primary-button, .agenda-choice-*, itd.)
 * zostają w tamtym pliku nieużywane przez gameplay screens — nic w tym
 * pliku ich nie rozszerza ani nie nadpisuje pojedynczo. To jest reset,
 * nie kolejna warstwa hotfixów.
 *
 * Sekcje:
 *   0. Body/#app: przywrócenie poprawnego zachowania scrolla —
 *      niezależnie od starych reguł ":has(.vn-screen)" w style.css
 *      (które teraz nigdy nie trafiają, bo gameplay screens nie mają
 *      już klasy .vn-screen). Ta sekcja jest w pełni samodzielna: nie
 *      polega na żadnym mechanizmie z css/style.css.
 *   1. .oos-game — plansza gry (CSS grid, topbar/sidebar/stage/actions)
 *   2. .oos-topbar — jedyny HUD
 *   3. .oos-sidebar — karta postaci + karta relacji
 *   4. .oos-stage — scena (tło = asset) + pasek narracji
 *   5. .oos-actions + warianty (single/triple/flow/reflection/evening-N)
 *   6. .oos-decision-card — klikalne karty wyboru
 *   7. .oos-result-tile — nieklikalne kafle wyników
 *   8. .oos-cta-button — jedyny "prawdziwy przycisk" w panelu akcji
 *   9. Noc (.oos-game--evening) — inny nastrój przez zmienne CSS
 *  10. Responsywność / bezpieczniki wysokości
 */

/* --------------------------------------------------------------------
   0. Body / #app — poprawne zachowanie scrolla, w pełni samodzielne
   -------------------------------------------------------------------- */

body[data-game-screen="game"],
body[data-game-screen="morning"],
body[data-game-screen="agenda"],
body[data-game-screen="event"],
body[data-game-screen="reflection"],
body[data-game-screen="evening"] {
  height: 100vh !important;
  min-height: 100vh !important;
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
  display: block !important;
}

body[data-game-screen="game"] #app,
body[data-game-screen="morning"] #app,
body[data-game-screen="agenda"] #app,
body[data-game-screen="event"] #app,
body[data-game-screen="reflection"] #app,
body[data-game-screen="evening"] #app {
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  display: block !important;
  box-sizing: border-box !important;
}

body[data-game-screen="game"] .version-badge,
body[data-game-screen="morning"] .version-badge,
body[data-game-screen="agenda"] .version-badge,
body[data-game-screen="event"] .version-badge,
body[data-game-screen="reflection"] .version-badge,
body[data-game-screen="evening"] .version-badge {
  position: fixed !important;
  right: 10px !important;
  bottom: 6px !important;
  margin: 0 !important;
  opacity: 0.6 !important;
  z-index: 5 !important;
}

/* Non-gameplay screens (menu, character creator, weekly summary):
   klasyczny, wąski, przewijalny layout — w pełni samodzielna reguła,
   nie polega na tym, czy .vn-screen istnieje. */
body[data-game-screen="mainMenu"],
body[data-game-screen="menu"],
body[data-game-screen="characterCreator"],
body[data-game-screen="character-creator"],
body[data-game-screen="weeklySummary"] {
  height: auto !important;
  min-height: 100vh !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}

body[data-game-screen="mainMenu"] #app,
body[data-game-screen="menu"] #app,
body[data-game-screen="characterCreator"] #app,
body[data-game-screen="character-creator"] #app,
body[data-game-screen="weeklySummary"] #app {
  width: 100% !important;
  max-width: 640px !important;
  min-height: auto !important;
  height: auto !important;
  margin: 0 auto !important;
  padding: 24px 16px 96px !important;
  overflow: visible !important;
  box-sizing: border-box !important;
  display: block !important;
}

@media (max-width: 780px) {
  body[data-game-screen="game"],
  body[data-game-screen="morning"],
  body[data-game-screen="agenda"],
  body[data-game-screen="event"],
  body[data-game-screen="reflection"],
  body[data-game-screen="evening"] {
    height: auto !important;
    min-height: 100vh !important;
    overflow-y: auto !important;
  }

  body[data-game-screen="game"] #app,
  body[data-game-screen="morning"] #app,
  body[data-game-screen="agenda"] #app,
  body[data-game-screen="event"] #app,
  body[data-game-screen="reflection"] #app,
  body[data-game-screen="evening"] #app {
    height: auto !important;
    overflow: visible !important;
  }
}

/* --------------------------------------------------------------------
   1. .oos-game — plansza gry
   -------------------------------------------------------------------- */

.oos-game {
  --oos-paper: #F7F1E4;
  --oos-panel: #EEE3CE;
  --oos-ink: #3E362C;
  --oos-muted: #8A7A67;
  --oos-line: #C8B48C;
  --oos-blue: #5D7B90;
  --oos-gold: #C08A3E;
  --oos-sage: #74915E;
  --oos-rose: #B5624F;
  --oos-shadow: rgba(62, 54, 44, 0.22);

  box-sizing: border-box;
  width: min(1440px, calc(100vw - 24px));
  height: calc(100vh - 24px);
  margin: 12px auto;
  padding: 14px;

  display: grid;
  grid-template-columns: 262px minmax(0, 1fr);
  grid-template-rows: 56px minmax(0, 1fr) 210px;
  grid-template-areas:
    "topbar topbar"
    "sidebar stage"
    "actions actions";
  gap: 14px;

  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--oos-line);
  background:
    radial-gradient(circle at 90% 90%, rgba(192, 138, 62, 0.14), transparent 26%),
    linear-gradient(135deg, #FBF7EC, var(--oos-paper));
  box-shadow: 0 16px 40px var(--oos-shadow);
  color: var(--oos-ink);
  font-family: Georgia, "Times New Roman", serif;
}

.oos-game * {
  box-sizing: border-box;
}

@media (max-width: 780px) {
  .oos-game {
    width: 100%;
    height: auto;
    min-height: calc(100vh - 24px);
    margin: 12px auto;
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
}

/* --------------------------------------------------------------------
   2. Topbar — jedyny HUD
   -------------------------------------------------------------------- */

.oos-topbar {
  grid-area: topbar;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 18px;

  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid var(--oos-line);
  background: rgba(255, 255, 255, 0.5);

  font-weight: 700;
}

.oos-topbar-daylabel {
  font-size: clamp(15px, 1.4vw, 19px);
  white-space: nowrap;
}

.oos-topbar-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.oos-topbar-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: clamp(14px, 1.2vw, 17px);
  white-space: nowrap;
}

.oos-topbar-stat--spoons .oos-topbar-stat-value {
  color: var(--oos-gold);
}

.oos-topbar-stat--trust .oos-topbar-stat-value {
  color: var(--oos-sage);
}

/* --------------------------------------------------------------------
   3. Sidebar — karta postaci + karta relacji
   -------------------------------------------------------------------- */

.oos-sidebar {
  grid-area: sidebar;
  min-height: 0;
  min-width: 0;

  display: grid;
  grid-template-rows: minmax(190px, 1.05fr) minmax(215px, 1fr);
  gap: 12px;
}

.oos-player-card,
.oos-relationship-card {
  min-height: 0;
  overflow: hidden;
  padding: 16px 15px;
  border-radius: 14px;
  border: 1px solid var(--oos-line);
  background: linear-gradient(180deg, #FDFAF2, var(--oos-panel));
  box-shadow: 0 6px 14px var(--oos-shadow);

  display: flex;
  flex-direction: column;
  gap: 6px;
}

.oos-player-card-badge,
.oos-relationship-card-heading {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--oos-muted);
  text-align: center;
}

.oos-player-card-name,
.oos-relationship-card-name {
  margin: 0;
  font-size: clamp(19px, 1.9vw, 25px);
  font-weight: 700;
  text-align: center;
  line-height: 1.15;
}

.oos-player-card-meta,
.oos-relationship-card-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--oos-muted);
  text-align: center;
}

.oos-stat-bar {
  margin: 6px 0;
}

.oos-stat-bar-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
}

.oos-stat-bar-value {
  color: var(--oos-blue);
}

.oos-stat-bar-track {
  height: 8px;
  margin-top: 5px;
  border-radius: 999px;
  background: rgba(62, 54, 44, 0.16);
  overflow: hidden;
}

.oos-stat-bar-fill {
  height: 100%;
  border-radius: 999px;
}

.oos-stat-bar-fill--spoons {
  background: var(--oos-gold);
}

.oos-stat-bar-fill--trust {
  background: var(--oos-sage);
}

.oos-stat-bar-fill--frustration {
  background: var(--oos-rose);
}

.oos-relationship-card-mood {
  margin: 6px 0 0;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(93, 123, 144, 0.14);
  color: var(--oos-ink);
  text-align: center;
  font-size: 11px;
  font-weight: 700;
}

@media (max-height: 800px) {
  .oos-sidebar {
    grid-template-rows: minmax(175px, 1.05fr) minmax(195px, 1fr);
    gap: 9px;
  }

  .oos-player-card,
  .oos-relationship-card {
    padding: 12px 13px;
  }
}

@media (max-width: 780px) {
  .oos-sidebar {
    grid-template-rows: none;
    gap: 10px;
  }
}

/* --------------------------------------------------------------------
   4. Stage — scena (tło = asset) + pasek narracji
   -------------------------------------------------------------------- */

.oos-stage {
  grid-area: stage;
  min-width: 0;
  min-height: 0;

  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(78px, auto);
  gap: 10px;
}

.oos-scene {
  position: relative;
  min-height: 0;
  border-radius: 14px;
  border: 1px solid var(--oos-line);
  box-shadow: 0 10px 24px var(--oos-shadow);
  background-color: var(--oos-panel);
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  overflow: hidden;
}

.oos-scene::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 65%, rgba(0, 0, 0, 0.22) 100%);
}

.oos-scene-title {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  max-width: min(85%, 560px);

  padding: 8px 22px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: linear-gradient(180deg, #9B6846, #6F442E);
  color: #F7F1E4;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);

  font-size: clamp(17px, 1.9vw, 27px);
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oos-narrative {
  min-height: 0;
  padding: 14px 26px;
  border-radius: 12px;
  border: 1px solid var(--oos-line);
  background: linear-gradient(180deg, #FDFAF2, rgba(238, 227, 206, 0.96));
  box-shadow: 0 4px 10px var(--oos-shadow);

  display: flex;
  align-items: center;
  justify-content: center;
}

.oos-narrative-text {
  margin: 0;
  max-width: 900px;
  font-size: clamp(18px, 1.7vw, 25px);
  line-height: 1.32;
  text-align: center;
  font-weight: 500;

  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-height: 800px) {
  .oos-narrative-text {
    font-size: clamp(16px, 1.5vw, 21px);
    -webkit-line-clamp: 2;
  }
}

/* --------------------------------------------------------------------
   5. Actions — panel dolny + warianty per ekran
   -------------------------------------------------------------------- */

.oos-actions {
  grid-area: actions;
  min-height: 0;
  min-width: 0;

  display: flex;
  align-items: stretch;
  justify-content: center;
}

/* Morning: jeden duży, wyśrodkowany CTA. */
.oos-actions--single {
  align-items: center;
}

.oos-actions--single .oos-cta-button {
  width: min(520px, 90%);
  height: auto;
  min-height: 74px;
}

/* Agenda: dokładnie 3 równe karty. */
.oos-actions--triple {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  width: 100%;
}

/* Event: 2-4 karty, elastyczna siatka. */
.oos-actions--flow {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

/* Reflection: result tiles + CTA w jednym płaskim rzędzie flex —
   align-items:stretch wyrównuje je automatycznie na tej samej osi. */
.oos-actions--reflection {
  display: flex;
  align-items: stretch;
  gap: 12px;
  width: min(100%, 1100px);
  margin: 0 auto;
}

.oos-actions--reflection .oos-result-tile {
  flex: 1 1 0;
  min-width: 0;
}

.oos-actions--reflection .oos-cta-button {
  flex: 0 0 clamp(170px, 20%, 230px);
  height: auto;
}

@media (max-width: 900px) {
  .oos-actions--reflection {
    flex-wrap: wrap;
  }

  .oos-actions--reflection .oos-result-tile {
    flex: 1 1 28%;
  }

  .oos-actions--reflection .oos-cta-button {
    flex: 1 1 100%;
  }
}

/* Evening: preferowane 5 równych kolumn w jednym rzędzie (mieszczą się
   na 1366px+); poniżej progu przechodzi na 3 kolumny (3+2, 2 rzędy). */
.oos-actions--evening-5,
.oos-actions--evening-4,
.oos-actions--evening-3 {
  display: grid;
  gap: 10px 12px;
  width: 100%;
}

.oos-actions--evening-5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.oos-actions--evening-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.oos-actions--evening-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 1180px) {
  .oos-actions--evening-5,
  .oos-actions--evening-4 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 780px) {
  .oos-actions--triple,
  .oos-actions--flow,
  .oos-actions--evening-5,
  .oos-actions--evening-4,
  .oos-actions--evening-3 {
    grid-template-columns: 1fr;
  }
}

/* --------------------------------------------------------------------
   6. Decision cards — klikalne karty wyboru
   -------------------------------------------------------------------- */

.oos-decision-card {
  height: 100%;
  min-height: 0;
  width: 100%;
  overflow: hidden;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;

  padding: 14px 14px;
  border: 2px solid var(--oos-blue);
  border-radius: 14px;
  background: linear-gradient(180deg, #FBF7EC, #EFE2C6);
  box-shadow:
    0 6px 0 rgba(54, 74, 88, 0.45),
    0 10px 18px var(--oos-shadow);

  color: var(--oos-ink);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  text-align: center;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}

.oos-decision-card:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: var(--oos-gold);
  box-shadow:
    0 8px 0 rgba(54, 74, 88, 0.4),
    0 14px 22px var(--oos-shadow);
}

.oos-decision-card:focus-visible {
  outline: 2px solid var(--oos-gold);
  outline-offset: 2px;
}

.oos-decision-card--disabled,
.oos-decision-card:disabled {
  cursor: default;
  opacity: 0.55;
  filter: grayscale(0.4);
  transform: none;
  box-shadow: 0 3px 8px var(--oos-shadow);
}

.oos-decision-card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.oos-decision-card-icon {
  font-size: clamp(16px, 1.6vw, 22px);
  flex-shrink: 0;
}

/* Tytuł NIGDY nie może zniknąć w ucięciu bez śladu — dopuszczalne 2
   pełne linie z eleganckim wielokropkiem, nigdy ucięte pół-słowo bez
   oznaczenia. */
.oos-decision-card-title {
  font-weight: 700;
  font-size: clamp(14px, 1.2vw, 18px);
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.02em;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.oos-decision-card-status {
  flex-shrink: 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--oos-muted);
}

.oos-decision-card-description {
  font-size: clamp(11.5px, 1vw, 13.5px);
  line-height: 1.3;
  color: var(--oos-muted);

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.oos-decision-card-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding-top: 5px;
  border-top: 1px solid rgba(62, 54, 44, 0.14);
}

.oos-decision-card-meta-line {
  font-size: clamp(10.5px, 0.9vw, 12.5px);
  line-height: 1.25;
  color: var(--oos-muted);

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Evening cards: mniej pionowego tekstu (opis 1 linia, jedna linia meta),
   żeby 5 kart w jednym rzędzie zawsze się mieściło bez ucinania tytułu. */
.oos-actions--evening-5 .oos-decision-card-description,
.oos-actions--evening-4 .oos-decision-card-description {
  -webkit-line-clamp: 1;
}

.oos-actions--evening-5 .oos-decision-card-title,
.oos-actions--evening-4 .oos-decision-card-title {
  font-size: clamp(12.5px, 1.05vw, 15px);
}

/* --------------------------------------------------------------------
   7. Result tiles — NIEKLIKALNE kafle wyników
   -------------------------------------------------------------------- */

.oos-result-tile {
  height: 100%;
  min-height: 0;
  width: 100%;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;

  padding: 10px 12px;
  border: 1.5px solid rgba(93, 123, 144, 0.4);
  border-radius: 12px;
  background: var(--oos-panel);
  box-shadow: 0 2px 4px var(--oos-shadow);

  text-align: center;
  cursor: default;
  pointer-events: none;
  transform: none;
}

.oos-result-tile:hover {
  transform: none;
  box-shadow: 0 2px 4px var(--oos-shadow);
}

.oos-result-tile-label {
  font-size: clamp(11px, 1vw, 13px);
  color: var(--oos-muted);
}

.oos-result-tile-value {
  font-size: clamp(22px, 2.2vw, 32px);
  font-weight: 700;
}

.oos-result-tile--positive {
  background: linear-gradient(180deg, #E4EFDD, #CFE2C4);
}

.oos-result-tile--positive .oos-result-tile-value {
  color: var(--oos-sage);
}

.oos-result-tile--negative {
  background: linear-gradient(180deg, #F1DCD5, #E3BCB0);
}

.oos-result-tile--negative .oos-result-tile-value {
  color: var(--oos-rose);
}

.oos-result-tile--neutral {
  background: linear-gradient(180deg, #EFE6D3, #E1D5B9);
}

.oos-result-tile--neutral .oos-result-tile-value {
  color: var(--oos-muted);
}

/* --------------------------------------------------------------------
   8. CTA button — jedyny "prawdziwy przycisk" w panelu akcji
   -------------------------------------------------------------------- */

.oos-cta-button {
  min-height: 64px;
  padding: 12px 20px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(180deg, #9B6846, #6F442E);
  color: #F7F1E4;

  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(16px, 1.5vw, 21px);
  font-weight: 700;

  box-shadow: 0 6px 0 rgba(74, 45, 31, 0.75), 0 12px 20px var(--oos-shadow);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.oos-cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 0 rgba(74, 45, 31, 0.7), 0 16px 24px var(--oos-shadow);
}

.oos-cta-button:focus-visible {
  outline: 2px solid var(--oos-gold);
  outline-offset: 2px;
}

/* --------------------------------------------------------------------
   9. Noc — inny nastrój tylko przez przedefiniowanie zmiennych,
   scoped do .oos-game--evening. Cały poddrzewo re-tematyzuje się samo,
   bo wszystko powyżej używa var(--oos-*), nie surowych hexów.
   -------------------------------------------------------------------- */

.oos-game--evening {
  --oos-paper: #262A3B;
  --oos-panel: #333750;
  --oos-ink: #F1EBDD;
  --oos-muted: #B7AFC4;
  --oos-line: #4B5068;
  --oos-shadow: rgba(0, 0, 0, 0.38);

  background:
    radial-gradient(circle at 85% 15%, rgba(192, 138, 62, 0.14), transparent 26%),
    linear-gradient(135deg, #2B2F42, var(--oos-paper));
}

.oos-game--evening .oos-topbar {
  background: rgba(38, 42, 59, 0.55);
}

.oos-game--evening .oos-decision-card {
  background: linear-gradient(180deg, #3A3F58, #2E3247);
  color: var(--oos-ink);
}

/* --------------------------------------------------------------------
   10. Bezpiecznik na niskie okna (typowy laptop 1366x768 z paskami
   przeglądarki potrafi mieć realnie mniej niż 768px wysokości).
   -------------------------------------------------------------------- */

@media (max-height: 800px) {
  .oos-game {
    grid-template-rows: 48px minmax(0, 1fr) 178px;
    padding: 10px;
    gap: 10px;
  }

  .oos-decision-card {
    padding: 10px 11px;
    gap: 4px;
  }

  .oos-cta-button {
    min-height: 56px;
  }
}

@media (min-width: 1700px) {
  .oos-game {
    width: min(1700px, calc(100vw - 24px));
  }
}
"""

GAME_UI_CSS_MARKER = "v0.18: Gameplay UI Layout Reset"


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED (v0.17.5) i PO (v0.18) dla podmienianych ekranow
# ---------------------------------------------------------------------------

GAME_SCREEN_OLD = r"""// gameScreen.js
//
// Morning screen.
// v0.16: Visual Novel RPG Layout Redesign — poranek jako scena VN.
// v0.17: Asset-Based VN UI Implementation. Scena używa realnego tła
// assets/scenes/scene-morning.png.
//
// v0.17.5: Professional Layout Polish Pass. Wcześniej narrative strip
// dostawał całą starą zawartość (previous evening summary, morning
// events, mini-agenda, pełna karta partnera) jako "kompaktowe karty" —
// ale to i tak było już ukryte przez CSS (.vn-narrative-strip
// .vn-compact-card { display:none }) od hotfixu v0.17.3, bo psuło
// czytelność sceny. Ten kod był więc od jakiegoś czasu martwy: budowany,
// ale nigdy niewidoczny. Usunięty tu w całości, zgodnie z wymogiem
// ticketu v0.17.5: "Narrative strip ma pokazywać tylko główny tekst
// sceny". Dane o poprzednim wieczorze / zaufaniu / frustracji / nastroju
// partnera są teraz czytelnie dostępne w karcie relacji w sidebarze
// (patrz js/ui/vnLayout.js#buildRelationshipCard, dodane w hotfixach
// v0.17.1-v0.17.4) — nic nie ginie, tylko nie dubluje się już w dwóch
// miejscach naraz.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";
import { ensureDailyAgenda } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
import {
  createVnShell,
  createTopBar,
  createScenePanel,
  createNarrativeStrip,
  createPlayerCard,
  createActionPanel
} from "../vnLayout.js";

export function renderGameScreen(container) {
  const state = getState();

  const topbar = createTopBar(state, "game");
  const side = createPlayerCard(state, "game", state.player ? buildStatusSentence(state.player) : null);

  const scene = createScenePanel({
    symbolModifier: "morning",
    title: `Dzień ${state.day}`
  });

  const narrative = createNarrativeStrip(
    "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw."
  );

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button vn-choice-button";
  continueButton.textContent = "Otwórz plan dnia";
  continueButton.addEventListener("click", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });

  const actions = createActionPanel([continueButton], "stack");

  const shell = createVnShell({
    screenClass: "morning",
    topbar,
    side,
    scene,
    narrative,
    actions
  });

  container.appendChild(shell);
}
"""

GAME_SCREEN_NEW = r"""// gameScreen.js
//
// Morning screen.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Żadnej zależności od
// starych klas .vn-*.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { ensureDailyAgenda } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createCtaButton
} from "../oosLayout.js";

export function renderGameScreen(container) {
  const state = getState();

  const topbar = createTopBar(state, "game");
  const sidebar = createSidebar(state, "game");

  const scene = createScenePanel({
    modifier: "morning",
    title: `Dzień ${state.day}`
  });

  const narrative = createNarrativeStrip(
    "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw."
  );

  const cta = createCtaButton("Otwórz plan dnia", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });

  const shell = createGameShell({
    screenClass: "morning",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [cta],
    actionsVariant: "single"
  });

  container.appendChild(shell);
}
"""

AGENDA_SCREEN_OLD = r"""// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.16: Visual Novel RPG Layout Redesign — agenda jako plansza wyboru akcji.
// v0.17: Asset-Based VN UI Implementation. Scena używa teraz tła
// assets/scenes/scene-agenda.jpg. Karty slotów dostały ikonę i krótki
// opis (zgodnie z assets/references/component-sheet.jpg — decision
// card jako "tactile" karta, nie zwykły przycisk formularza).
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
import {
  createVnShell,
  createTopBar,
  createScenePanel,
  createNarrativeStrip,
  createPlayerCard,
  createActionPanel
} from "../vnLayout.js";

const SLOT_ICONS = {
  obligation: "📌",
  relationship: "💬",
  inner: "🧠"
};

const SLOT_DESCRIPTIONS = {
  obligation: "Sprawy, które i tak trzeba załatwić.",
  relationship: "Bliskość i napięcie między Tobą a partnerem.",
  inner: "To, jak się dziś czujesz i ile jeszcze masz w sobie."
};

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

  const topbar = createTopBar(state, "agenda");
  const side = createPlayerCard(state, "agenda");

  const scene = createScenePanel({
    symbolModifier: "agenda",
    title: "Plan dnia"
  });

  const narrative = createNarrativeStrip("Wybierz, czym zajmiesz się teraz. Kolejność ma znaczenie.");

  const cards = agenda.slots.map((item, index) => renderAgendaChoiceButton(item, index, state));
  const actions = createActionPanel(cards);

  const shell = createVnShell({
    screenClass: "agenda",
    topbar,
    side,
    scene,
    narrative,
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
  marker.textContent = item.completed ? "✓" : SLOT_ICONS[item.slot] || "•";
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

  const description = document.createElement("span");
  description.className = "agenda-choice-description";
  description.textContent = SLOT_DESCRIPTIONS[item.slot] || "";
  button.appendChild(description);

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
// decyzji (napięcie / ryzyko / hint), zamiast wyglądać jak lista pytań
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
  pressure.textContent = `Napięcie: ${buildSlotPressure(item, state)}`;
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
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Karty slotów mają pełne,
// nieucinane tytuły i czytelne linie ryzyka/napięcia/hintu, każda
// osobno (nie sklejone w jeden string, jak to się zdarzało w v0.17.x).
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
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

const SLOT_ICONS = {
  obligation: "📌",
  relationship: "💬",
  inner: "🧠"
};

const SLOT_DESCRIPTIONS = {
  obligation: "Sprawy, które i tak trzeba załatwić.",
  relationship: "Bliskość i napięcie między Tobą a partnerem.",
  inner: "To, jak się dziś czujesz i ile jeszcze masz w sobie."
};

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

  const topbar = createTopBar(state, "agenda");
  const sidebar = createSidebar(state, "agenda");

  const scene = createScenePanel({
    modifier: "agenda",
    title: "Plan dnia"
  });

  const narrative = createNarrativeStrip("Wybierz, czym zajmiesz się teraz. Kolejność ma znaczenie.");

  const cards = agenda.slots.map((item, index) => buildAgendaCard(item, index, state));

  const shell = createGameShell({
    screenClass: "agenda",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "triple"
  });

  container.appendChild(shell);
}

function buildAgendaCard(item, index, state) {
  return createDecisionCard({
    icon: item.completed ? "✓" : SLOT_ICONS[item.slot] || "•",
    title: getAgendaSlotLabel(item.slot),
    statusText: item.completed ? "ukończone" : "wybierz",
    description: SLOT_DESCRIPTIONS[item.slot] || "",
    metaLines: [
      `Ryzyko: ${buildSlotRiskLabel(item)}`,
      `Napięcie: ${buildSlotPressure(item, state)}`,
      buildSlotOrderHint(item)
    ],
    disabled: item.completed,
    onClick: () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    }
  });
}

// v0.15: RPG Gameplay Shell. Karty agendy komunikują stawkę decyzji
// (napięcie / ryzyko / hint) — czysto informacyjnie, bez wpływu na
// mechanikę wyboru ani na losowanie eventów.
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

function buildSlotOrderHint(item) {
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
//
// v0.16: przed wyborem NIE pokazujemy już dokładnych liczb (np.
// "− 3 spoons"). Zamiast tego pokazujemy jakościowy poziom (Koszt:
// niskie/średnie/wysokie, Niepewność: niska/średnia/wysoka). Dokładne
// liczby gracz widzi dopiero PO decyzji, na ekranie refleksji.
// choice availability by spoons (blokowanie zbyt drogich wyborów,
// forced cheapest choice) zostaje bez zmian — zmienia się tylko to,
// co widać, nie logika dostępności.
//
// v0.17: Asset-Based VN UI Implementation — scena używa teraz tła
// assets/scenes/scene-event.png, opis eventu trafia do osobnego
// narrative-strip pod sceną, a wybory wyglądają jak decision cards
// (assets/references/component-sheet.jpg), nie zwykłe przyciski.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";
import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js";
import {
  createVnShell,
  createTopBar,
  createScenePanel,
  createNarrativeStrip,
  createPlayerCard,
  createActionPanel
} from "../vnLayout.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const progress = getCurrentAgendaProgress(state);

  const topbar = createTopBar(state, "event", `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`);
  const side = createPlayerCard(state, "event");

  const scene = createScenePanel({
    symbolModifier: "event",
    title: replacePlaceholders(event.title, state)
  });

  const narrative = createNarrativeStrip(replacePlaceholders(event.description, state));

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  event.choices.forEach((choice) => {
    const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
    choicesList.appendChild(renderChoiceButton(choice, state, currentSpoons, isForced));
  });

  const actions = createActionPanel([choicesList], "stack");

  const shell = createVnShell({
    screenClass: "event",
    topbar,
    side,
    scene,
    narrative,
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

// zamiast dokładnej liczby spoons (np. "− 3 spoons"), pokazujemy tylko
// jakościowy poziom kosztu. Progi dobrane pod realny zakres spoonsCost
// w eventData.js (0-5).
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

// "niepewność" to jakościowa miara tego, jak mocno wybór może poruszyć
// zaufanie/frustrację — bez ujawniania kierunku ani wartości.
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
// v0.16: przed wyborem NIE pokazujemy już dokładnych liczb (np.
// "− 3 spoons"). Zamiast tego pokazujemy jakościowy poziom (Koszt:
// niskie/średnie/wysokie, Niepewność: niska/średnia/wysoka). Dokładne
// liczby gracz widzi dopiero PO decyzji, na ekranie refleksji.
// choice availability by spoons (blokowanie zbyt drogich wyborów,
// forced cheapest choice) zostaje bez zmian — zmienia się tylko to,
// co widać, nie logika dostępności.
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js).

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";
import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const progress = getCurrentAgendaProgress(state);

  const topbar = createTopBar(
    state,
    "event",
    `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`
  );
  const sidebar = createSidebar(state, "event");

  const scene = createScenePanel({
    modifier: "event",
    title: replacePlaceholders(event.title, state)
  });

  const narrative = createNarrativeStrip(replacePlaceholders(event.description, state));

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  const cards = event.choices.map((choice) => buildChoiceCard(choice, state, currentSpoons, forcedChoice));

  const shell = createGameShell({
    screenClass: "event",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "flow"
  });

  container.appendChild(shell);
}

function buildChoiceCard(choice, state, currentSpoons, forcedChoice) {
  const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
  const canAfford = choice.spoonsCost <= currentSpoons;
  const isDisabled = !canAfford && !isForced;

  return createDecisionCard({
    title: replacePlaceholders(choice.label, state),
    metaLines: [
      `Koszt: ${buildCostTier(choice.spoonsCost)} · Niepewność: ${buildUncertaintyTier(choice)}`,
      isDisabled ? "niedostępne teraz" : isForced ? "ostatnia dostępna opcja" : null
    ],
    disabled: isDisabled,
    onClick: () => {
      resolveEvent(choice.id);
      showScreen("reflection");
    }
  });
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

// zamiast dokładnej liczby spoons (np. "− 3 spoons"), pokazujemy tylko
// jakościowy poziom kosztu. Progi dobrane pod realny zakres spoonsCost
// w eventData.js (0-5).
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

// "niepewność" to jakościowa miara tego, jak mocno wybór może poruszyć
// zaufanie/frustrację — bez ujawniania kierunku ani wartości.
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
"""

REFLECTION_SCREEN_OLD = r"""// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.
//
// v0.16: to jest ekran, na którym gracz PIERWSZY RAZ widzi dokładne
// liczby dla swojej decyzji (event screen celowo ich już nie pokazuje —
// patrz eventScreen.js). Dlatego konsekwencje są tu dużymi, wyraźnymi
// kaflami (vn-consequence-*), a nie cichą listą tekstu.
//
// v0.17: Asset-Based VN UI Implementation — scena używa teraz tła
// assets/scenes/scene-reflection.png.
//
// v0.17.5: Professional Layout Polish Pass.
// - Usunięto zagnieżdżony ".reflection-impact-panel": kafle konsekwencji
//   i przycisk CTA są teraz BEZPOŚREDNIM rodzeństwem w jednym płaskim
//   rzędzie (.vn-reflection-row), więc CSS Grid/Flex wyrównuje je do
//   tej samej osi automatycznie — koniec z "doklejonym" przyciskiem.
// - Kafle konsekwencji są teraz wyraźnie NIE-klikalne wizualnie (patrz
//   .vn-consequence-card w CSS: cursor:default, pointer-events:none,
//   bez hover-lift) — to czytelne read-only result tiles, nie przyciski.
// - Interpretacja tekstowa skutku dołączona do narrative strip (to nadal
//   "główny tekst refleksji", tylko rozszerzony o jedno zdanie), a
//   "Zostało Ci X spoons" i "Postęp dnia" zdjęte z dolnego rzędu — to
//   drugie przeniesione do top bara (już i tak pokazuje fazę dnia), żeby
//   nic nie zaśmiecało rzędu kafli+CTA.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";
import {
  createVnShell,
  createTopBar,
  createScenePanel,
  createNarrativeStrip,
  createPlayerCard,
  createActionPanel,
  createConsequenceCards
} from "../vnLayout.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const dayProgressText = buildDayProgressText(state);
  const topbar = createTopBar(
    state,
    "reflection",
    dayProgressText ? `Refleksja · ${dayProgressText}` : undefined
  );
  const side = createPlayerCard(state, "reflection");

  const scene = createScenePanel({
    symbolModifier: "reflection",
    title: "Skutek decyzji"
  });

  const narrative = createNarrativeStrip(buildNarrativeText(resultText, consequences));

  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const endDayButton = document.createElement("button");
  endDayButton.className = "primary-button vn-choice-button";
  endDayButton.textContent = goesBackToAgenda
    ? "Wróć do planu dnia"
    : "Zamknij dzień";

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

  const rowChildren = consequences
    ? [...createConsequenceCards(buildConsequenceItems(consequences)), endDayButton]
    : [endDayButton];

  const actions = createActionPanel(rowChildren, "reflection");

  const shell = createVnShell({
    screenClass: "reflection",
    topbar,
    side,
    scene,
    narrative,
    actions
  });

  container.appendChild(shell);
}

function buildConsequenceItems(consequences) {
  const items = [
    { icon: "🥄", label: "Spoons", value: consequences.spoonsChange },
    { icon: "🤝", label: "Zaufanie", value: consequences.trustChange },
    { icon: "🌡️", label: "Frustracja", value: consequences.frustrationChange }
  ];

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    items.push({ icon: "🌀", label: "Przeciążenie", value: consequences.fatigueChange });
  }

  return items;
}

function buildNarrativeText(resultText, consequences) {
  const interpretation = consequences ? buildInterpretation(consequences) : null;

  if (!interpretation) {
    return resultText;
  }

  return resultText ? `${resultText} ${interpretation}` : interpretation;
}

function buildDayProgressText(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;
  return `${completed}/${total}`;
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
"""

REFLECTION_SCREEN_NEW = r"""// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.
//
// v0.16: to jest ekran, na którym gracz PIERWSZY RAZ widzi dokładne
// liczby dla swojej decyzji (event screen celowo ich już nie pokazuje).
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Kafle wyników (Spoons/
// Zaufanie/Frustracja) używają teraz oos-result-tile — jawnie
// NIEKLIKALNEGO komponentu (cursor:default, pointer-events:none, brak
// hover) — i są bezpośrednim rodzeństwem przycisku CTA w jednym rzędzie
// panelu akcji, więc są zawsze na tej samej osi.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createResultTile,
  createCtaButton
} from "../oosLayout.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const dayProgressText = buildDayProgressText(state);
  const topbar = createTopBar(
    state,
    "reflection",
    dayProgressText ? `Refleksja · ${dayProgressText}` : undefined
  );
  const sidebar = createSidebar(state, "reflection");

  const scene = createScenePanel({
    modifier: "reflection",
    title: "Skutek decyzji"
  });

  const narrative = createNarrativeStrip(buildNarrativeText(resultText, consequences));

  const goesBackToAgenda = hasRemainingAgendaItems(state);

  const cta = createCtaButton(
    goesBackToAgenda ? "Wróć do planu dnia" : "Zamknij dzień",
    () => {
      if (goesBackToAgenda) {
        saveGame(state);
        showScreen("agenda");
      } else {
        state.phase = "evening";
        saveGame(state);
        showScreen("evening");
      }
    }
  );

  const tiles = consequences ? buildResultTiles(consequences) : [];

  const shell = createGameShell({
    screenClass: "reflection",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [...tiles, cta],
    actionsVariant: "reflection"
  });

  container.appendChild(shell);
}

function buildResultTiles(consequences) {
  const items = [
    { icon: "🥄", label: "Spoons", value: consequences.spoonsChange },
    { icon: "🤝", label: "Zaufanie", value: consequences.trustChange },
    { icon: "🌡️", label: "Frustracja", value: consequences.frustrationChange }
  ];

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    items.push({ icon: "🌀", label: "Przeciążenie", value: consequences.fatigueChange });
  }

  return items.map((item) => createResultTile(item));
}

function buildNarrativeText(resultText, consequences) {
  const interpretation = consequences ? buildInterpretation(consequences) : null;

  if (!interpretation) {
    return resultText;
  }

  return resultText ? `${resultText} ${interpretation}` : interpretation;
}

function buildDayProgressText(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;
  return `${completed}/${total}`;
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
"""

EVENING_SCREEN_OLD = r"""// eveningScreen.js
//
// v0.9: evening recovery screen.
// Flow:
//   morning -> event -> reflection -> evening -> next morning
//
// v0.16: Wieczór ma wyraźnie inny, ciemniejszy nastrój i tę samą
// strukturę VN co reszta ekranów gameplayowych. Logika evening recovery
// i weekly summary flow są nietknięte.
//
// v0.17: Asset-Based VN UI Implementation — scena używa teraz tła
// assets/scenes/scene-evening.png.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery
} from "../../systems/eveningRecoverySystem.js";
import { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";
import {
  createVnShell,
  createTopBar,
  createScenePanel,
  createNarrativeStrip,
  createPlayerCard,
  createActionPanel
} from "../vnLayout.js";

export function renderEveningScreen(container) {
  const state = getState();

  const topbar = createTopBar(state, "evening");
  const side = createPlayerCard(state, "evening");

  const scene = createScenePanel({
    symbolModifier: "evening",
    title: "Koniec dnia"
  });

  const narrative = createNarrativeStrip(
    "Dzień się domyka. To, co zostało w zasobach, przechodzi na jutro. Dzień już się wydarzył — teraz zostaje pytanie, co robisz z resztką siebie."
  );

  const options = document.createElement("div");
  options.className = "evening-options";

  getEveningRecoveryOptions(state).forEach((option) => {
    options.appendChild(renderEveningOptionButton(option, state));
  });

  const actions = createActionPanel([options], "stack");

  const shell = createVnShell({
    screenClass: "evening",
    topbar,
    side,
    scene,
    narrative,
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

EVENING_SCREEN_NEW = r"""// eveningScreen.js
//
// v0.9: evening recovery screen.
// Flow:
//   morning -> event -> reflection -> evening -> next morning
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Jest 5 opcji wieczornych
// (eveningRecoveryData.js) — panel akcji dostaje wariant
// "evening-{liczba}", żeby CSS mogło dobrać odpowiednią siatkę (5
// równych kolumn w jednym rzędzie, jeśli mieszczą się na 1366px, w
// przeciwnym razie 3+2) BEZ ucinania tytułów.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery
} from "../../systems/eveningRecoverySystem.js";
import { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

export function renderEveningScreen(container) {
  const state = getState();

  const topbar = createTopBar(state, "evening");
  const sidebar = createSidebar(state, "evening");

  const scene = createScenePanel({
    modifier: "evening",
    title: "Koniec dnia"
  });

  const narrative = createNarrativeStrip(
    "Dzień się domyka. To, co zostało w zasobach, przechodzi na jutro. Dzień już się wydarzył — teraz zostaje pytanie, co robisz z resztką siebie."
  );

  const options = getEveningRecoveryOptions(state);
  const cards = options.map((option) => buildEveningCard(option, state));

  const shell = createGameShell({
    screenClass: "evening",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: `evening-${cards.length}`
  });

  container.appendChild(shell);
}

function buildEveningCard(option, state) {
  return createDecisionCard({
    title: replacePlaceholders(option.label, state),
    description: replacePlaceholders(option.description, state),
    metaLines: [formatEffects(option.effects)],
    onClick: () => {
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
    }
  });
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
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        "export const GAME_VERSION = \"v0.17.5\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.17.5\";",
        "export const GAME_VERSION = \"v0.18\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.18\";",
        "GAME_VERSION -> v0.18",
    ),
]

INDEX_HTML_PATCHES = [
    (
        r"""  <link rel="stylesheet" href="css/style.css">
</head>""",
        r"""  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="./css/game-ui-v0-18.css?v=180">
</head>""",
        'index.html: dodanie game-ui-v0-18.css PO style.css',
    ),
    (
        r"""  <script type="module" src="./js/main.js?v=175"></script>""",
        r"""  <script type="module" src="./js/main.js?v=180"></script>""",
        'cache-bust ?v=180 w index.html',
    ),
]


def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.18 (Gameplay UI Layout Reset)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f'Podaj poprawna sciezke jako argument, np.:\n'
            f'  python apply_clean_v0_18_gameplay_ui_layout_reset.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/ui/uiManager.js",
        "js/ui/vnLayout.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/agendaScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eveningScreen.js",
        "js/ui/screens/weeklySummaryScreen.js",
        "js/ui/screens/characterCreatorScreen.js",
        "js/data/versionData.js",
        "index.html",
        "css/style.css",
        "assets/scenes/scene-morning.png",
        "assets/scenes/scene-agenda.jpg",
        "assets/scenes/scene-event.png",
        "assets/scenes/scene-reflection.png",
        "assets/scenes/scene-evening.png",
    ]

    missing = [f for f in expected_files if not (project_root / f).exists()]
    if missing:
        raise UpdaterError(
            "Brakuje oczekiwanych plikow w projekcie:\n"
            + "\n".join(f"  - {f}" for f in missing)
            + "\n\nTo repo wyglada inaczej niz zakladal ten updater. Przerywam."
        )

    print("Sanity check OK - wszystkie oczekiwane pliki znalezione (w tym assety v0.17).\n")

    print("1/8 js/ui/oosLayout.js (nowy plik)")
    create_new_file_if_needed(project_root / "js/ui/oosLayout.js", OOS_LAYOUT_JS, OOS_LAYOUT_MARKER, "oosLayout.js -> nowy izolowany system .oos-*")
    print()

    print("2/8 css/game-ui-v0-18.css (nowy plik)")
    create_new_file_if_needed(project_root / "css/game-ui-v0-18.css", GAME_UI_CSS, GAME_UI_CSS_MARKER, "game-ui-v0-18.css -> nowy izolowany CSS")
    print()

    print("3/8 js/ui/screens/gameScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/gameScreen.js", GAME_SCREEN_OLD, GAME_SCREEN_NEW, "gameScreen.js -> oosLayout.js")
    print()

    print("4/8 js/ui/screens/agendaScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/agendaScreen.js", AGENDA_SCREEN_OLD, AGENDA_SCREEN_NEW, "agendaScreen.js -> oosLayout.js")
    print()

    print("5/8 js/ui/screens/eventScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/eventScreen.js", EVENT_SCREEN_OLD, EVENT_SCREEN_NEW, "eventScreen.js -> oosLayout.js")
    print()

    print("6/8 js/ui/screens/reflectionScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/reflectionScreen.js", REFLECTION_SCREEN_OLD, REFLECTION_SCREEN_NEW, "reflectionScreen.js -> oosLayout.js")
    print()

    print("7/8 js/ui/screens/eveningScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/eveningScreen.js", EVENING_SCREEN_OLD, EVENING_SCREEN_NEW, "eveningScreen.js -> oosLayout.js")
    print()

    print("8/8 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.18 (Gameplay UI Layout Reset) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Badge pokazuje "Out of Spoons v0.18", index.html ma ?v=180.
 2. Zrodlo strony: css/game-ui-v0-18.css?v=180 laduje sie PO
    css/style.css.
 3. Character creator: normalna szerokosc (~640px), scrolluje sie,
    da sie dojsc do przycisku rozpoczecia gry.
 4. Morning: duza scena (scene-morning.png), czytelny opis, jeden
    duzy CTA "Otworz plan dnia", karta postaci + karta relacji w
    sidebarze, obie w pelni widoczne.
 5. Agenda: 3 rowne karty, PELNE tytuly (Obowiazek/Relacja/
    Wewnetrzne), Ryzyko/Napiecie/hint na OSOBNYCH liniach, wszystkie
    klikalne.
 6. Event: karty wyboru czytelne i klikalne, bez dokladnych kosztow
    liczbowych przed decyzja.
 7. Reflection: result tiles (Spoons/Zaufanie/Frustracja) WYRAZNIE
    nieklikalne (brak hover/lift/cursor pointer), CTA w tym samym
    rzedzie, na tej samej osi.
 8. Evening: 5 opcji w jednym rzedzie (albo 3+2 na waskim oknie),
    ZADEN tytul nie jest ucinany w polowie slowa, wszystkie klikalne,
    nic nie zachodzi na scene.
 9. Body NIE scrolluje na gameplay screens przy 1366x768.
10. Non-game screens (menu, kreator, weekly summary) moga scrollowac.
11. Nie wrocil podwojny HUD (dokladnie jeden .oos-topbar na kazdym
    ekranie gameplayowym).
12. Spoons nadal NIE resetuja sie do maksimum miedzy dniami.
13. Flow dnia dziala: poranek -> agenda -> event -> reflection ->
    (agenda/event/reflection x2) -> evening -> kolejny poranek.
14. Po dniu 7 weekly summary nadal dziala.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)