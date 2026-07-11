#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_clean_v0_17_asset_based_vn_ui.py

Updater dla Out of Spoons: v0.16 -> v0.17 (Asset-Based VN UI Implementation).

BAZA: repo faktycznie na v0.16 w momencie przygotowania tego updatera
(potwierdzone: badge "Out of Spoons v0.16", index.html "?v=160", pliki
ekranow juz w strukturze VN z v0.16). Ten updater patchuje TEN stan,
nie zaklada v0.15. Wszystkie "OLD" stale ponizej zostaly wziete
bezposrednio z realnego stanu repo (git show HEAD) w momencie
przygotowania tego skryptu.

Repo zawiera juz assety graficzne v0.17 (assets/scenes/*, assets/ui/
player-card-frame.png, assets/references/*) - ten updater ich NIE
kopiuje ani nie tworzy, tylko podpina istniejace pliki jako tla przez
CSS background-image / inline style. Jesli te pliki nie istnieja w
repo, gra nadal dziala (po prostu tlo sceny bedzie puste/przezroczyste),
ale wyglad nie bedzie zgodny z blueprintem.

Co robi:
  - JEDEN HUD: vn-topbar (dzien/faza/spoons/zaufanie) zastepuje osobny
    globalny js/ui/gameHud.js. Plik gameHud.js zostaje w repo
    NIEUZYWANY (nic go juz nie importuje),
  - PRZEBUDOWUJE js/ui/vnLayout.js: dodaje createTopBar, dzieli dawny
    createScenePanel na createScenePanel (samo tlo + tab tytulu, teraz
    oparte o assets/scenes/*) + createNarrativeStrip (osobny pasek
    tekstu pod scena), tak zeby duze tlo zostalo dominujacym elementem
    ekranu (assets/references/mockup-flow.png), a nie zaslonione
    tekstem,
  - PODMIENIA CALA ZAWARTOSC 5 plikow ekranow (pelny redesign
    struktury, nie punktowe patche) - kazdy uzywa teraz odpowiedniego
    tla z assets/scenes/:
      js/ui/screens/gameScreen.js       -> scene-morning.png
      js/ui/screens/agendaScreen.js     -> scene-agenda.jpg
      js/ui/screens/eventScreen.js      -> scene-event.png
      js/ui/screens/reflectionScreen.js -> scene-reflection.png
      js/ui/screens/eveningScreen.js    -> scene-evening.png
  - patchuje js/ui/uiManager.js: usuwa wywolanie appendGameHud (koniec
    podwojnego HUD-u),
  - CSS: prawdziwy brak scrolla body (height:100vh + overflow:hidden),
    .vn-screen jako CSS grid z nazwanymi obszarami (topbar/side/stage/
    actions), karta gracza z tlem assets/ui/player-card-frame.png,
    "tactile" karty decyzji/konsekwencji (miekkie cienie, hover-lift),
    duzy dopisany blok CLEAN v0.17,
  - dokladne koszty liczbowe nadal ukryte przed wyborem (bez zmian -
    to juz bylo wprowadzone w v0.16),
  - podbija wersje w js/data/versionData.js do v0.17,
  - podbija cache-bust w index.html do ?v=170.

Nie zmienia saveVersion. Nie zmienia zadnej mechaniki gry (eventData.js,
dayAgendaSystem.js, dayCycle.js, eveningRecoverySystem.js,
weeklySummarySystem.js, saveManager.js sa nietkniete) - to wylacznie UI.
weeklySummaryScreen.js NIE jest przebudowywany.

Skrypt jest idempotentny: mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane, a nie duplikowane/nadpisywane ponownie.

WAZNE dla pelnych podmian plikow ekranow: poniewaz sa PODMIENIANE W
CALOSCI (nie male fragmenty), ten updater wymaga, zeby zawartosc
plikow w repo dokladnie odpowiadala stanowi v0.16 sprzed patcha. Jesli
plik lokalnie rozni sie (np. reczna edycja nieopublikowana jeszcze na
GitHubie), updater PRZERWIE dzialanie z jasnym komunikatem zamiast
zgadywac lub nadpisywac cos po cichu.

Uzycie:
    python apply_clean_v0_17_asset_based_vn_ui.py

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
    Uzywane dla plikow podmienianych w calosci (pelny redesign, nie
    punktowa zmiana). Idempotentne i bezpieczne - patrz apply_patches.
    """
    current = read_text(path)

    if current == new_content:
        print(f"  [pominieto] {label} (juz zastosowano)")
        return

    if current != old_content:
        raise UpdaterError(
            f"{path}\n"
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.16 sprzed\n"
            f"  patcha, ani stanowi v0.17 po patchu. Plik mogl zostac\n"
            f"  recznie zmieniony od czasu przygotowania tego updatera.\n"
            f"  Nie nadpisuje go automatycznie - sprawdz recznie roznice\n"
            f"  (np. git diff) przed ponowna proba."
        )

    write_text(path, new_content)
    print(f"  [ok] {label} (plik podmieniony w calosci)")


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


def check_assets_exist(project_root, asset_paths):
    """
    Assety v0.17 powinny juz byc w repo (przygotowane wczesniej).
    Ten updater ich nie tworzy - tylko ostrzega, jesli ktoregos brakuje,
    zamiast cicho wdrozyc UI z zepsutymi tlami.
    """
    missing = [p for p in asset_paths if not (project_root / p).exists()]
    if missing:
        print("  UWAGA: brakuje nastepujacych assetow (tla scen beda puste):")
        for p in missing:
            print(f"    - {p}")
        print("  Gra nadal zadziala, ale wyglad nie bedzie zgodny z blueprintem v0.17.")
    else:
        print("  Wszystkie assety v0.17 znalezione w repo.")


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED (v0.16) i PO (v0.17) dla podmienianych plikow
# ---------------------------------------------------------------------------

VN_LAYOUT_OLD = r"""// vnLayout.js
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

VN_LAYOUT_NEW = r"""// vnLayout.js
//
// v0.16: Visual Novel RPG Layout Redesign.
// v0.17: Asset-Based VN UI Implementation.
//
// Wspólny "shell" layoutu dla ekranów gameplayowych, teraz oparty o
// realne assety graficzne z assets/ (sceny tła, ramka karty gracza) —
// patrz assets/ASSET_MANIFEST_v0_17.md. Struktura zgodna z
// assets/references/mockup-flow.png:
//
// <div class="vn-screen vn-screen--{screenClass}">
//   <header class="vn-topbar">...</header>            (jedyny HUD)
//   <div class="vn-main">
//     <aside class="vn-side"><div class="vn-player-card">...</div></aside>
//     <section class="vn-stage">
//       <div class="vn-scene-panel">                   (tło = scene asset)
//         <div class="vn-scene-title-tab">...</div>
//       </div>
//       <div class="vn-narrative-strip">...</div>       (osobny pasek tekstu)
//     </section>
//   </div>
//   <section class="vn-actions">...</section>           (karty decyzji/konsekwencji)
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
// Ścieżki są względne do index.html (root repo), tak jak istniejące
// <link rel="stylesheet" href="css/style.css">.
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
 * Zastępuje wcześniejszy osobny globalny panel (gameHud.js), żeby
 * uniknąć podwójnego HUD-u (patrz komentarz w uiManager.js).
 *
 * @param {object} state - aktualny stan gry (getState())
 * @param {string} screenName - nazwa ekranu (jak w uiManager.js "screens")
 * @param {string} [overridePhaseText] - dokładniejszy tekst fazy (np.
 *   "Wydarzenie 2/3 — Relacja") zamiast domyślnej etykiety ekranu
 */
export function createTopBar(state, screenName, overridePhaseText) {
  const bar = document.createElement("header");
  bar.className = "vn-topbar";

  const dayPhase = document.createElement("span");
  dayPhase.className = "vn-topbar-daylabel";
  dayPhase.textContent = `Dzień ${state.day} · ${overridePhaseText || getPhaseLabel(screenName)}`;
  bar.appendChild(dayPhase);

  const statsRow = document.createElement("div");
  statsRow.className = "vn-topbar-stats";

  const spoons = state.resources ? state.resources.spoons : null;
  if (spoons) {
    statsRow.appendChild(buildTopBarStat("🥄", `${spoons.current}/${spoons.max}`, "spoons"));
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    statsRow.appendChild(buildTopBarStat("🤝", `${clampPercent(npc.trust)}`, "trust"));
  }

  bar.appendChild(statsRow);

  return bar;
}

function buildTopBarStat(icon, valueText, modifier) {
  const stat = document.createElement("span");
  stat.className = `vn-topbar-stat vn-topbar-stat--${modifier}`;

  const iconEl = document.createElement("span");
  iconEl.className = "vn-topbar-stat-icon";
  iconEl.setAttribute("aria-hidden", "true");
  iconEl.textContent = icon;
  stat.appendChild(iconEl);

  const valueEl = document.createElement("span");
  valueEl.className = "vn-topbar-stat-value";
  valueEl.textContent = valueText;
  stat.appendChild(valueEl);

  return stat;
}

/**
 * Buduje pełną strukturę ekranu visual novel z gotowych elementów DOM.
 *
 * @param {object} options
 * @param {string} options.screenClass - np. "morning", "agenda"...
 * @param {HTMLElement} options.topbar - wynik createTopBar()
 * @param {HTMLElement} [options.side] - wynik createPlayerCard()
 * @param {HTMLElement} [options.scene] - wynik createScenePanel()
 * @param {HTMLElement} [options.narrative] - wynik createNarrativeStrip()
 * @param {HTMLElement} [options.actions] - zawartość dolnego panelu akcji
 */
export function createVnShell(options) {
  const { screenClass, topbar, side, scene, narrative, actions } = options || {};

  const shell = document.createElement("div");
  shell.className = `vn-screen vn-screen--${screenClass || "default"}`;

  if (topbar) {
    shell.appendChild(topbar);
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
  if (narrative) {
    stage.appendChild(narrative);
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
 * Buduje centralny panel sceny: tło = asset graficzny danej fazy
 * (assets/scenes/...) + tab z tytułem w rogu. Tekst NIE jest tu już
 * renderowany — patrz createNarrativeStrip(), osobny pasek pod sceną,
 * żeby duże tło zawsze zostawało czytelne i "dominujące" (zgodnie z
 * mockup-flow.png), a nie zasłonięte ścianą tekstu.
 *
 * @param {object} options
 * @param {string} options.symbolModifier - "morning" | "agenda" |
 *   "event" | "reflection" | "evening" — wybiera asset tła i klasę CSS
 * @param {string} [options.title] - tytuł pokazywany w tabie
 */
export function createScenePanel(options) {
  const { symbolModifier, title } = options || {};

  const panel = document.createElement("div");
  panel.className = `vn-scene-panel vn-scene-panel--${symbolModifier || "default"}`;

  const assetPath = SCENE_ASSET_PATHS[symbolModifier];
  if (assetPath) {
    panel.style.backgroundImage = `url("${assetPath}")`;
  }

  if (title) {
    const tab = document.createElement("div");
    tab.className = "vn-scene-title-tab";
    tab.textContent = title;
    panel.appendChild(tab);
  }

  return panel;
}

/**
 * Buduje wąski pasek tekstu narracyjnego pod sceną (opis eventu, echo
 * decyzji, wstęp poranka itd.), z opcjonalnymi dodatkowymi kompaktowymi
 * kartami (np. skrót poprzedniego wieczoru, wydarzenia poranne) —
 * każda owinięta w .vn-compact-card z własnym wewnętrznym scrollem,
 * żeby długość treści nigdy nie wymusiła scrolla całej strony.
 *
 * @param {string|HTMLElement} text
 * @param {Array<HTMLElement|null>} [extra]
 */
export function createNarrativeStrip(text, extra) {
  const strip = document.createElement("div");
  strip.className = "vn-narrative-strip";

  if (text) {
    if (typeof text === "string") {
      const paragraph = document.createElement("p");
      paragraph.className = "vn-narrative-text";
      paragraph.textContent = text;
      strip.appendChild(paragraph);
    } else {
      strip.appendChild(text);
    }
  }

  if (Array.isArray(extra)) {
    extra.forEach((element) => {
      if (element) {
        const compact = document.createElement("div");
        compact.className = "vn-compact-card";
        compact.appendChild(element);
        strip.appendChild(compact);
      }
    });
  }

  return strip;
}

/**
 * Buduje symboliczną kartę postaci w lewym sidebarze, stylizowaną na
 * ramkę z assets/ui/player-card-frame.png (patrz .vn-player-card w
 * CSS): imię, etykieta "Twoja postać", spoons, zaufanie, opcjonalny
 * jednowierszowy status. CELOWO nie pokazuje partnera jako portretu.
 *
 * @param {object} state - aktualny stan gry (getState())
 * @param {string} screenName - nazwa ekranu, do etykiety fazy
 * @param {string} [statusLine] - opcjonalne 1 krótkie zdanie profilu
 */
export function createPlayerCard(state, screenName, statusLine) {
  const card = document.createElement("div");
  card.className = "vn-player-card";

  const inner = document.createElement("div");
  inner.className = "vn-player-card-inner";

  const badge = document.createElement("p");
  badge.className = "vn-player-badge";
  badge.textContent = "Twoja postać";
  inner.appendChild(badge);

  const name = document.createElement("p");
  name.className = "vn-player-name";
  name.textContent = state && state.player ? state.player.name : "Ty";
  inner.appendChild(name);

  const meta = document.createElement("p");
  meta.className = "vn-player-meta";
  meta.textContent = `Dzień ${state.day} · ${getPhaseLabel(screenName)}`;
  inner.appendChild(meta);

  const spoons = state && state.resources ? state.resources.spoons : null;
  if (spoons) {
    inner.appendChild(
      buildPlayerStat("🥄 Spoons", `${spoons.current}/${spoons.max}`, percent(spoons.current, spoons.max), "spoons")
    );
  }

  const npc = getPartnerNpc(state);
  if (npc) {
    inner.appendChild(
      buildPlayerStat("🤝 Zaufanie", `${clampPercent(npc.trust)}`, clampPercent(npc.trust), "trust")
    );
  }

  if (statusLine) {
    const status = document.createElement("p");
    status.className = "vn-player-status";
    status.textContent = statusLine;
    inner.appendChild(status);
  }

  card.appendChild(inner);

  return card;
}

function buildPlayerStat(label, valueText, percentValue, modifier) {
  const stat = document.createElement("div");
  stat.className = "vn-player-stat";

  const labelRow = document.createElement("div");
  labelRow.className = "vn-player-stat-label";

  const labelText = document.createElement("span");
  labelText.textContent = label;
  labelRow.appendChild(labelText);

  const valueEl = document.createElement("span");
  valueEl.className = "vn-player-stat-value";
  valueEl.textContent = valueText;
  labelRow.appendChild(valueEl);

  stat.appendChild(labelRow);

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
 * Opakowuje przekazane elementy (karty akcji, przyciski) we wspólny
 * kontener treści dolnego panelu.
 *
 * @param {Array<HTMLElement|null>} children
 * @param {string} [layout] - "grid" (domyślnie, np. 3 karty agendy) albo
 *   "stack" (pojedyncza kolumna, np. lista wyborów eventu)
 */
export function createActionPanel(children, layout) {
  const panel = document.createElement("div");
  panel.className = layout === "stack" ? "vn-action-stack" : "vn-action-grid";

  (children || []).forEach((child) => {
    if (child) {
      panel.appendChild(child);
    }
  });

  return panel;
}

/**
 * Buduje siatkę dużych "kafli" konsekwencji (np. Spoons -2, Zaufanie +1).
 *
 * @param {Array<{icon?: string, label: string, value: number}>} items
 */
export function createConsequencePanel(items) {
  const grid = document.createElement("div");
  grid.className = "vn-consequence-grid";

  (items || []).forEach((item) => {
    grid.appendChild(buildConsequenceCard(item.icon, item.label, item.value));
  });

  return grid;
}

function buildConsequenceCard(icon, label, value) {
  const direction = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

  const card = document.createElement("div");
  card.className = `vn-consequence-card vn-consequence-card--${direction}`;

  const labelEl = document.createElement("span");
  labelEl.className = "vn-consequence-label";
  labelEl.textContent = icon ? `${icon} ${label}` : label;
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

GAME_SCREEN_OLD = r"""// gameScreen.js
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

GAME_SCREEN_NEW = r"""// gameScreen.js
//
// Morning screen.
// v0.16: Visual Novel RPG Layout Redesign — poranek jako scena VN.
// v0.17: Asset-Based VN UI Implementation. Scena używa teraz realnego
// tła assets/scenes/scene-morning.png zamiast samego emoji, a tekst
// (poprzedni wieczór, wydarzenia poranne, agenda dnia, karta partnera)
// przeniósł się do osobnego narrative-strip pod sceną, żeby duże tło
// zostało dominującym elementem ekranu (assets/references/mockup-flow.png).
// Funkcje budujące te sekcje są nietknięte od v0.13/v0.10 — zmienia się
// tylko to, GDZIE ich wynik trafia w layoucie.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";
import { ensureDailyAgenda, getAgendaSlotLabel } from "../../systems/dayAgendaSystem.js";
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

  const extraCards = [
    renderPersistentSpoonsNote(),
    renderPreviousEveningSummary(state),
    renderMorningEvents(state),
    renderDailyAgendaSection(state),
    renderPartnerCardIfPresent(state)
  ];

  const topbar = createTopBar(state, "game");
  const side = createPlayerCard(state, "game", state.player ? buildStatusSentence(state.player) : null);

  const scene = createScenePanel({
    symbolModifier: "morning",
    title: `Dzień ${state.day}`
  });

  const narrative = createNarrativeStrip(
    "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.",
    extraCards
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

AGENDA_SCREEN_NEW = r"""// agendaScreen.js
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

REFLECTION_SCREEN_OLD = r"""// reflectionScreen.js
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

REFLECTION_SCREEN_NEW = r"""// reflectionScreen.js
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
// assets/scenes/scene-reflection.png, a tekst wyniku decyzji trafia do
// osobnego narrative-strip. Kafle konsekwencji dostały ikony (🥄🤝🌡️).

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
  createConsequencePanel
} from "../vnLayout.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const topbar = createTopBar(state, "reflection");
  const side = createPlayerCard(state, "reflection");

  const scene = createScenePanel({
    symbolModifier: "reflection",
    title: "Skutek decyzji"
  });

  const narrative = createNarrativeStrip(resultText);

  const panelChildren = [];
  if (consequences) {
    panelChildren.push(renderImpactPanel(consequences, state));
  }

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

  panelChildren.push(endDayButton);

  const actions = createActionPanel(panelChildren, "stack");

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

// CLEAN v0.16 reflection impact panel START
// konsekwencje jako duże kafle (vn-consequence-grid) z ikonami.
function renderImpactPanel(consequences, state) {
  const panel = document.createElement("div");
  panel.className = "reflection-impact-panel";

  const title = document.createElement("p");
  title.className = "reflection-impact-title";
  title.textContent = "Skutek decyzji";
  panel.appendChild(title);

  const items = [
    { icon: "🥄", label: "Spoons", value: consequences.spoonsChange },
    { icon: "🤝", label: "Zaufanie", value: consequences.trustChange },
    { icon: "🌡️", label: "Frustracja", value: consequences.frustrationChange }
  ];

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    items.push({ icon: "🌀", label: "Przeciążenie", value: consequences.fatigueChange });
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

EVENING_SCREEN_NEW = r"""// eveningScreen.js
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

  const resourceSummary = document.createElement("p");
  resourceSummary.className = "evening-resource-summary";
  resourceSummary.textContent = `Spoons: ${state.resources.spoons.current}/${state.resources.spoons.max}`;

  const topbar = createTopBar(state, "evening");
  const side = createPlayerCard(state, "evening");

  const scene = createScenePanel({
    symbolModifier: "evening",
    title: "Koniec dnia"
  });

  const narrative = createNarrativeStrip(
    "Dzień się domyka. To, co zostało w zasobach, przechodzi na jutro. Dzień już się wydarzył — teraz zostaje pytanie, co robisz z resztką siebie.",
    [resourceSummary]
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


# ---------------------------------------------------------------------------
# CSS: duzy dopisany blok v0.17 (asset-based VN UI)
# ---------------------------------------------------------------------------

VN_SHELL_CSS_BLOCK = r"""/* CLEAN v0.17 asset-based VN UI */

/* --------------------------------------------------------------------
   Prawdziwy brak scrolla body na gameplay screens: body dostaje stałą
   wysokość 100vh + overflow:hidden, #app wypełnia ją flexem, a
   .vn-screen wypełnia #app gridem. weeklySummary NIE dostaje tego
   traktowania — zostaje normalnym, przewijalnym ekranem.
   -------------------------------------------------------------------- */

body[data-game-screen="game"],
body[data-game-screen="morning"],
body[data-game-screen="agenda"],
body[data-game-screen="event"],
body[data-game-screen="reflection"],
body[data-game-screen="evening"] {
  height: 100vh;
  overflow: hidden;
  align-items: stretch;
  padding: 0.65rem 1rem;
}

body[data-game-screen="game"] #app,
body[data-game-screen="morning"] #app,
body[data-game-screen="agenda"] #app,
body[data-game-screen="event"] #app,
body[data-game-screen="reflection"] #app,
body[data-game-screen="evening"] #app {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 1100px;
}

body[data-game-screen="game"] .version-badge,
body[data-game-screen="morning"] .version-badge,
body[data-game-screen="agenda"] .version-badge,
body[data-game-screen="event"] .version-badge,
body[data-game-screen="reflection"] .version-badge,
body[data-game-screen="evening"] .version-badge {
  position: fixed;
  bottom: 4px;
  right: 8px;
  margin: 0;
  z-index: 5;
}

@media (max-width: 780px) {
  body[data-game-screen="game"],
  body[data-game-screen="morning"],
  body[data-game-screen="agenda"],
  body[data-game-screen="event"],
  body[data-game-screen="reflection"],
  body[data-game-screen="evening"] {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
}

/* --------------------------------------------------------------------
   vn-screen jako CSS grid z nazwanymi obszarami — dokładnie struktura
   z assets/references/mockup-flow.png: topbar na górze na całą
   szerokość, sidebar + scena obok siebie, actions na dole na całą
   szerokość.
   -------------------------------------------------------------------- */

.vn-screen {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  grid-template-rows: 52px minmax(0, 1fr) 230px;
  grid-template-areas:
    "topbar  topbar"
    "side    stage"
    "actions actions";
  gap: 0.75rem;
  overflow: hidden;
}

@media (max-width: 780px) {
  .vn-screen {
    display: flex;
    flex-direction: column;
    height: auto;
    overflow: visible;
  }
}

/* --------------------------------------------------------------------
   Top bar — JEDYNY HUD (dzień / faza / spoons / zaufanie)
   -------------------------------------------------------------------- */

.vn-topbar {
  grid-area: topbar;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.5rem 1rem;
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(43, 42, 40, 0.08);
}

.vn-topbar-daylabel {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-ink);
  white-space: nowrap;
}

.vn-topbar-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.vn-topbar-stat {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
}

.vn-topbar-stat-icon {
  font-size: 1rem;
}

.vn-topbar-stat--spoons .vn-topbar-stat-value {
  color: var(--color-gold);
}

.vn-topbar-stat--trust .vn-topbar-stat-value {
  color: var(--color-sage);
}

/* --------------------------------------------------------------------
   Left player card — oparta o assets/ui/player-card-frame.png jako
   tło; półprzezroczysta "pergaminowa" nakładka nad nim gwarantuje
   czytelność tekstu niezależnie od dokładnej treści assetu.
   -------------------------------------------------------------------- */

.vn-side {
  grid-area: side;
  min-height: 0;
  overflow-y: auto;
}

.vn-player-card {
  position: relative;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  background-image: url("../assets/ui/player-card-frame.png");
  background-size: cover;
  background-position: center;
  box-shadow: 0 2px 5px rgba(43, 42, 40, 0.18);
  border: 1px solid var(--color-line);
}

.vn-player-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(244, 239, 230, 0.62), rgba(244, 239, 230, 0.8));
}

.vn-player-card-inner {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 0.85rem;
  overflow-y: auto;
}

.vn-player-badge {
  margin: 0;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
}

.vn-player-name {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-ink);
}

.vn-player-meta {
  margin: 0 0 0.25rem 0;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.vn-player-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vn-player-stat-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.vn-player-stat-value {
  font-weight: 700;
  color: var(--color-ink);
}

.vn-player-bar {
  height: 8px;
  background-color: var(--color-line);
  border-radius: 4px;
  overflow: hidden;
}

.vn-player-bar-fill {
  height: 100%;
}

.vn-player-bar-fill--spoons {
  background-color: var(--color-gold);
}

.vn-player-bar-fill--trust {
  background-color: var(--color-sage);
}

.vn-player-status {
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-line);
  font-size: 0.8rem;
  font-style: italic;
  color: var(--color-muted);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* --------------------------------------------------------------------
   Stage: duży panel sceny (tło = asset danej fazy) + tab z tytułem +
   osobny pasek narracji pod spodem.
   -------------------------------------------------------------------- */

.vn-stage {
  grid-area: stage;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.vn-scene-panel {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  border: 1px solid var(--color-line);
  box-shadow: 0 2px 8px rgba(43, 42, 40, 0.18);
  background-size: cover;
  background-position: center;
  background-color: var(--color-panel);
  overflow: hidden;
}

.vn-scene-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(43, 42, 40, 0) 60%, rgba(43, 42, 40, 0.28) 100%);
  pointer-events: none;
}

.vn-scene-title-tab {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
  padding: 0.4rem 1rem;
  background-color: rgba(244, 239, 230, 0.92);
  border: 1px solid var(--color-line);
  border-radius: 6px;
  font-family: var(--font-display);
  font-size: 1.05rem;
  color: var(--color-ink);
  box-shadow: 0 2px 4px rgba(43, 42, 40, 0.2);
  max-width: calc(100% - 24px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vn-narrative-strip {
  flex-shrink: 0;
  max-height: 34%;
  overflow-y: auto;
  padding: 0.6rem 0.9rem;
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--color-ink);
}

.vn-narrative-text {
  margin: 0 0 0.4rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.vn-compact-card {
  max-height: 110px;
  overflow-y: auto;
  padding: 0.5rem 0.6rem;
  margin-top: 0.4rem;
  background-color: var(--color-panel);
  border: 1px solid var(--color-line);
  border-radius: 6px;
  font-size: 0.8rem;
}

/* --------------------------------------------------------------------
   Bottom action panel — decision cards w stylu "tactile", nie zwykłe
   przyciski formularza (assets/references/component-sheet.jpg).
   -------------------------------------------------------------------- */

.vn-actions {
  grid-area: actions;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.vn-action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  height: 100%;
}

.vn-action-stack {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  justify-content: center;
  height: 100%;
}

@media (max-width: 780px) {
  .vn-action-grid {
    grid-template-columns: 1fr;
    height: auto;
  }

  .vn-actions {
    max-height: none;
  }
}

.vn-action-card,
.choice-button,
.evening-option-button {
  background: linear-gradient(180deg, #FBF7EE 0%, #F0E6D2 100%);
  border: 1px solid var(--color-line);
  border-radius: 10px;
  box-shadow: 0 2px 0 rgba(67, 53, 46, 0.14), 0 4px 10px rgba(67, 53, 46, 0.12);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.vn-action-card:not(:disabled):hover,
.choice-button:not(:disabled):hover,
.evening-option-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 3px 0 rgba(67, 53, 46, 0.18), 0 7px 14px rgba(67, 53, 46, 0.16);
}

.vn-action-card--completed,
.choice-button--disabled {
  background: var(--color-panel);
  box-shadow: none;
  transform: none;
  opacity: 0.6;
}

.vn-action-card-meta {
  font-size: 0.75rem;
}

.agenda-choice-description {
  color: var(--color-muted);
  font-size: 0.8rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agenda-choice-hint {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.choices {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.6rem;
}

.consequences-interpretation,
.spoons-summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* --------------------------------------------------------------------
   Konsekwencje jako duże, wyraźne kafle z ikonami (reflection screen)
   -------------------------------------------------------------------- */

.vn-consequence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.6rem;
  margin: 0.5rem 0;
}

.vn-consequence-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0.6rem;
  background: linear-gradient(180deg, #FBF7EE 0%, #F0E6D2 100%);
  border: 1px solid var(--color-line);
  border-radius: 10px;
  box-shadow: 0 2px 0 rgba(67, 53, 46, 0.1), 0 3px 8px rgba(67, 53, 46, 0.1);
  text-align: center;
}

.vn-consequence-label {
  font-size: 0.72rem;
  color: var(--color-muted);
}

.vn-consequence-value {
  font-size: 1.5rem;
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
/* END CLEAN v0.17 asset-based VN UI */
"""

VN_SHELL_CSS_MARKER = "CLEAN v0.17 asset-based VN UI"


# ---------------------------------------------------------------------------
# Patche dla js/ui/uiManager.js (koniec podwojnego HUD-u)
# ---------------------------------------------------------------------------

UI_MANAGER_PATCHES = [
    (
        r"""import { renderAgendaScreen } from "./screens/agendaScreen.js";
import { appendGameHud } from "./gameHud.js";
let appContainer = null;""",
        r"""import { renderAgendaScreen } from "./screens/agendaScreen.js";
let appContainer = null;""",
        'uiManager: usuniecie importu appendGameHud',
    ),
    (
        r"""  appContainer.innerHTML = "";
  document.body.dataset.gameScreen = screenName;
  render(appContainer, data);
  appendGameHud(appContainer, screenName);
  appendVersionBadge(appContainer);
}""",
        r"""  appContainer.innerHTML = "";
  document.body.dataset.gameScreen = screenName;
  render(appContainer, data);
  // v0.17: appendGameHud() (osobny globalny panel nad ekranem) zostało
  // usunięte stąd celowo — powodowało "podwójny HUD" razem z nowym
  // vn-topbar w vnLayout.js. Dzień/faza/spoons/zaufanie pokazuje teraz
  // wyłącznie vn-topbar, budowany przez każdy ekran gameplayowy z
  // osobna (patrz js/ui/vnLayout.js#createTopBar).
  appendVersionBadge(appContainer);
}""",
        'uiManager: usuniecie wywolania appendGameHud (koniec podwojnego HUD)',
    ),
]


# ---------------------------------------------------------------------------
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        "export const GAME_VERSION = \"v0.16\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.16\";",
        "export const GAME_VERSION = \"v0.17\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.17\";",
        "GAME_VERSION -> v0.17",
    ),
]

INDEX_HTML_PATCHES = [
    (
        "  <script type=\"module\" src=\"./js/main.js?v=160\"></script>",
        "  <script type=\"module\" src=\"./js/main.js?v=170\"></script>",
        "cache-bust ?v=170 w index.html",
    ),
]


ASSET_PATHS = [
    "assets/scenes/scene-morning.png",
    "assets/scenes/scene-agenda.jpg",
    "assets/scenes/scene-event.png",
    "assets/scenes/scene-reflection.png",
    "assets/scenes/scene-evening.png",
    "assets/ui/player-card-frame.png",
]


def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.17 (Asset-Based VN UI Implementation)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f'Podaj poprawna sciezke jako argument, np.:\n'
            f'  python apply_clean_v0_17_asset_based_vn_ui.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/ui/uiManager.js",
        "js/ui/gameHud.js",
        "js/ui/vnLayout.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/agendaScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eveningScreen.js",
        "js/ui/screens/weeklySummaryScreen.js",
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

    print("0/8 assety v0.17")
    check_assets_exist(project_root, ASSET_PATHS)
    print()

    print("1/8 js/ui/vnLayout.js (przebudowa)")
    replace_whole_file(project_root / "js/ui/vnLayout.js", VN_LAYOUT_OLD, VN_LAYOUT_NEW, "vnLayout.js -> asset-based VN shell")
    print()

    print("2/8 js/ui/screens/gameScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/gameScreen.js", GAME_SCREEN_OLD, GAME_SCREEN_NEW, "gameScreen.js -> scene-morning.png")
    print()

    print("3/8 js/ui/screens/agendaScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/agendaScreen.js", AGENDA_SCREEN_OLD, AGENDA_SCREEN_NEW, "agendaScreen.js -> scene-agenda.jpg")
    print()

    print("4/8 js/ui/screens/eventScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/eventScreen.js", EVENT_SCREEN_OLD, EVENT_SCREEN_NEW, "eventScreen.js -> scene-event.png")
    print()

    print("5/8 js/ui/screens/reflectionScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/reflectionScreen.js", REFLECTION_SCREEN_OLD, REFLECTION_SCREEN_NEW, "reflectionScreen.js -> scene-reflection.png")
    print()

    print("6/8 js/ui/screens/eveningScreen.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/screens/eveningScreen.js", EVENING_SCREEN_OLD, EVENING_SCREEN_NEW, "eveningScreen.js -> scene-evening.png")
    print()

    print("7/8 js/ui/uiManager.js (koniec podwojnego HUD-u)")
    apply_patches(project_root / "js/ui/uiManager.js", UI_MANAGER_PATCHES)
    print()

    print("8/8 css/style.css, versionData.js, index.html")
    append_css_block_if_needed(project_root / "css/style.css", VN_SHELL_CSS_BLOCK, VN_SHELL_CSS_MARKER, "dopisanie bloku CSS asset-based VN UI")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.17 (Asset-Based VN UI Implementation) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Uruchom gre. Sprawdz badge: "Out of Spoons v0.17".
 2. Zacznij nowa gre.
 3. Na kazdym gameplay screenie widac DOKLADNIE JEDEN pasek HUD na
    gorze (dzien / faza / spoons / zaufanie) - nie dwa.
 4. Na typowym laptopie (1366x768 / 1440x900) body NIE przewija sie.
 5. Uklad przypomina assets/references/mockup-flow.png: top bar / lewa
    karta gracza (tlo = player-card-frame.png) / duza scena z realnym
    tlem-obrazkiem / pasek narracji / dolny panel akcji.
 6. Kazdy ekran ma inne tlo sceny:
      poranek    -> assets/scenes/scene-morning.png
      agenda     -> assets/scenes/scene-agenda.jpg
      event      -> assets/scenes/scene-event.png
      refleksja  -> assets/scenes/scene-reflection.png
      wieczor    -> assets/scenes/scene-evening.png
 7. Agenda: 3 karty z ikona, opisem, ryzykiem, napieciem i hintem -
    bez liczb kosztow, w stylu "tactile" (miekki cien, hover-lift).
 8. Event: decision cards na dole, bez dokladnych liczb przed wyborem.
 9. Refleksja: duze kafle z ikonami (🥄 Spoons, 🤝 Zaufanie, 🌡️
    Frustracja), przycisk "Wroc do planu dnia" po 1. i 2. evencie.
10. Po 3. evencie przycisk to "Zamknij dzien", prowadzi do wieczoru.
11. Wieczor ma wyraznie ciemniejszy, nocny klimat.
12. Spoons nadal NIE resetuja sie do maksimum miedzy dniami.
13. Po dniu 7 weekly summary nadal dziala.
14. Nie wrocily morningMessage / npc-message / "pisze:".
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)