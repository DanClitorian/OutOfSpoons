#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_hotfix_v0_17_5_professional_layout_polish.py

Updater dla Out of Spoons: v0.17.4 -> v0.17.5 (Professional Layout
Polish Pass).

BAZA: repo faktycznie na v0.17.4 w momencie przygotowania tego
updatera (potwierdzone: badge "Out of Spoons v0.17.4", index.html
"?v=174", commit "WIP: v0.17.4 local state before v0.17.5 polish
pass"). Wszystkie "OLD" stale ponizej zostaly wziete bezposrednio z
realnego stanu repo (git show HEAD) w momencie przygotowania tego
skryptu - NIE z v0.15, v0.16 ani "czystego" v0.17.

Naprawiane konkretnie (na podstawie zrzutow ekranu i realnego kodu
z hotfixow v0.17.1-v0.17.4):

  1. Consequence cards (Spoons/Zaufanie/Frustracja na reflection)
     wygladaly jak klikalne przyciski (ten sam "wcisniety guzik"
     cien i gruba ramka co prawdziwe decision cards). Teraz: cienka
     ramka, miekki cien, cursor:default, pointer-events:none, brak
     hover-lift - czytelne read-only result tiles.

  2. CTA "Wroc do planu dnia" bylo krzywo/doklejone wzgledem kafli
     konsekwencji. Przyczyna: kafle byly zagniezdzone w osobnym
     .reflection-impact-panel obok osobno wyrownywanego przycisku
     (2 poziomy zagniezdzenia). Naprawione przez PRZEBUDOWE
     reflectionScreen.js: kafle i CTA sa teraz bezposrednim
     rodzenstwem w jednym plaskim rzedzie flex (.vn-reflection-row),
     wiec align-items:stretch wyrownuje je automatycznie, bez
     zgadywania wysokosci.

  3. Karta relacji w sidebarze byla przycieta (mood niewidoczny).
     Rebalans gridu sidebaru (karta postaci / karta relacji, z
     ok. 52/48 na wieksze, oba z bezpiecznym minimum wysokosci) +
     ukryty (przez CSS, nie usuniety z JS) status z karty postaci,
     zeby zrobic miejsce. Dodatkowo: etykieta nastroju dostala
     prefiks "Mood: " (poprzednio pokazywala sam label, np.
     "Niepewnie" bez kontekstu).

  4. "Ryzyko: XNapiecie: Y" sklejone w jedna linie na agendzie -
     .agenda-choice-card-meta bylo -webkit-box z line-clamp na CALYM
     bloku, a jego dzieci (risk/pressure/hint) to inline spany bez
     zadnego separatora w DOM. Naprawione: meta jest teraz flex
     column, kazda linia (Ryzyko / Napiecie / hint) osobno.

  5. Evening: karty opcji byly ucinane u gory i dolu (overflow).
     Przyczyna: 5 opcji wieczornych (nie 4 - eventingRecoveryData.js
     ma faktycznie 5 pozycji) w siatce 2 kolumny to 3 rzedy (2+2+1),
     za duzo na dostepna wysokosc (max-height:98px na przycisk).
     Naprawione: siatka 3 kolumny (5 opcji = 2 rzedy: 3+2), wiecej
     miejsca na caly rzad akcji przy wieczorze, krotszy tekst
     (line-clamp) w kazdej karcie.

  6. Sprzatanie: narrative strip w gameScreen.js budowal (ale nigdy
     nie pokazywal - CSS juz to ukrywal od v0.17.3) pelna karte
     partnera, mini-agende, morning events, notatke o spoons. Ten
     martwy kod zostal usuniety z gameScreen.js (nic sie wizualnie
     nie zmienia dla gracza - to bylo juz niewidoczne), zgodnie z
     wymogiem "narrative strip pokazuje tylko glowny tekst sceny".
     Dane o relacji sa teraz czytelnie w karcie relacji w sidebarze.
     Podobnie usunieto redundantny badge spoons z narrative wieczoru
     (spoons juz widoczne w topbar i karcie gracza).

Strategia CSS: ten hotfix jest dopisany NA KONCU pliku (po
v0.17.1-v0.17.4). Przy rownej specyficznosci selektorow i takim
samym uzyciu !important, pozniejsza regula w zrodle wygrywa - dlatego
nie trzeba podbijac specyficznosci ani duplikowac regul wewnatrz
medium query, wystarczy uzyc tych samych selektorow.

Nie zmienia saveVersion. Nie zmienia zadnej mechaniki gry (eventData.js,
dayAgendaSystem.js, dayCycle.js, eveningRecoverySystem.js,
weeklySummarySystem.js, saveManager.js sa nietkniete) - to wylacznie
layout/CSS/prezentacja. agendaScreen.js i eventScreen.js NIE sa
zmieniane (ich problemy byly czysto CSS-owe).

Skrypt jest idempotentny: mozna go uruchomic wielokrotnie - juz
zaaplikowane zmiany sa pomijane, a nie duplikowane/nadpisywane ponownie.

WAZNE dla pelnych podmian plikow: poniewaz sa PODMIENIANE W CALOSCI
(nie male fragmenty), ten updater wymaga, zeby zawartosc plikow w
repo dokladnie odpowiadala stanowi v0.17.4 sprzed patcha. Jesli plik
lokalnie rozni sie (np. reczna edycja nieopublikowana jeszcze na
GitHubie), updater PRZERWIE dzialanie z jasnym komunikatem zamiast
zgadywac lub nadpisywac cos po cichu.

Uzycie:
    python apply_hotfix_v0_17_5_professional_layout_polish.py

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
            f"  Zawartosc pliku nie odpowiada ani stanowi v0.17.4 sprzed\n"
            f"  patcha, ani stanowi v0.17.5 po patchu. Plik mogl zostac\n"
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


# ---------------------------------------------------------------------------
# Pelna zawartosc PRZED (v0.17.4) i PO (v0.17.5) dla podmienianych plikow
# ---------------------------------------------------------------------------

VN_LAYOUT_OLD = r"""// vnLayout.js
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
  mood.textContent = `Mood: ${buildRelationshipMoodLabel(npc)}`;
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
 * @param {string} [layout] - "grid" (domyślnie, np. 3 karty agendy),
 *   "stack" (pojedyncza kolumna/rząd, np. lista wyborów eventu) albo
 *   "reflection" (v0.17.5: płaski jeden rząd — kafle konsekwencji +
 *   CTA obok siebie, ta sama oś pionowa, patrz .vn-reflection-row)
 */
export function createActionPanel(children, layout) {
  const panel = document.createElement("div");

  if (layout === "stack") {
    panel.className = "vn-action-stack";
  } else if (layout === "reflection") {
    panel.className = "vn-reflection-row";
  } else {
    panel.className = "vn-action-grid";
  }

  (children || []).forEach((child) => {
    if (child) {
      panel.appendChild(child);
    }
  });

  return panel;
}

/**
 * Buduje siatkę dużych "kafli" konsekwencji (np. Spoons -2, Zaufanie +1).
 * Używane tam, gdzie kafle mają być w OSOBNYM, samodzielnym kontenerze.
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

/**
 * v0.17.5: jak createConsequencePanel, ale zwraca TABLICĘ pojedynczych
 * kafli (bez wspólnego kontenera-gridu) — potrzebne, żeby kafle mogły
 * być bezpośrednim rodzeństwem przycisku CTA w jednym płaskim rzędzie
 * (.vn-reflection-row), zamiast być zagnieżdżone w osobnym gridzie
 * obok osobno wyrównywanego przycisku. To naprawia niewspółosiowość
 * CTA względem kafli na ekranie refleksji.
 *
 * @param {Array<{icon?: string, label: string, value: number}>} items
 */
export function createConsequenceCards(items) {
  return (items || []).map((item) => buildConsequenceCard(item.icon, item.label, item.value));
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

GAME_SCREEN_NEW = r"""// gameScreen.js
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


# ---------------------------------------------------------------------------
# CSS: dopisany blok HOTFIX v0.17.5
# ---------------------------------------------------------------------------

CSS_POLISH_BLOCK = r"""/* CLEAN HOTFIX v0.17.5 professional layout polish START */
/*
  Cel: naprawić konkretne, zgłoszone problemy z v0.17.4, nie dokładać
  kolejnej warstwy przypadkowych reguł. Ten blok jest ostatni w pliku,
  więc przy równej specyficzności selektorów i takim samym użyciu
  !important, jego reguły wygrywają z wcześniejszymi hotfixami
  (v0.17.1-v0.17.4) przez kolejność w źródle — nie trzeba podbijać
  specyficzności ani duplikować reguł wewnątrz media queries.

  Naprawiane konkretnie:
  1. Consequence cards (Spoons/Zaufanie/Frustracja na reflection) —
     wyglądały jak klikalne przyciski. Teraz: cienka ramka, miękki
     cień, cursor:default, pointer-events:none, brak hover-lift.
  2. CTA "Wróć do planu dnia" — było krzywo/doklejone. Teraz kafle
     konsekwencji i CTA są bezpośrednim rodzeństwem w jednym płaskim
     rzędzie flex (.vn-reflection-row, patrz reflectionScreen.js),
     więc align-items: stretch wyrównuje je automatycznie.
  3. Karta relacji była przycięta (mood niewidoczny). Rebalansowany
     grid sidebaru (karta postaci / karta relacji) + usunięty status
     z karty postaci, żeby zrobić miejsce.
  4. "Ryzyko: XNapięcie: Y" sklejone w jedną linię na agendzie — meta
     agendy była -webkit-box z line-clamp na całym bloku zamiast
     każda linia osobno. Teraz flex-column, każda linia osobna.
  5. Evening: karty opcji ucięte (za mała wysokość rzędu akcji na
     ekranie wieczoru dla 2x2 siatki 4 kart). Rząd akcji dla wieczoru
     dostaje więcej miejsca, karty dostają mniej tekstu (line-clamp).
*/

/* --------------------------------------------------------------------
   1 + 2. Consequence cards jako read-only result tiles + płaski rząd
   reflection (kafle + CTA jako bezpośrednie rodzeństwo, wspólna oś).
   -------------------------------------------------------------------- */

.vn-consequence-card {
  cursor: default !important;
  pointer-events: none !important;
  transform: none !important;
  border: 1.5px solid rgba(93, 123, 144, 0.45) !important;
  box-shadow: 0 1px 2px rgba(74, 69, 60, 0.12) !important;
}

.vn-consequence-card:hover {
  transform: none !important;
  border-color: rgba(93, 123, 144, 0.45) !important;
  box-shadow: 0 1px 2px rgba(74, 69, 60, 0.12) !important;
}

.vn-reflection-row {
  display: flex !important;
  align-items: stretch !important;
  gap: 12px !important;
  width: min(100%, 1040px) !important;
  max-width: 1040px !important;
  height: 100% !important;
  margin: 0 auto !important;
  position: relative !important;
  z-index: 31 !important;
}

.vn-reflection-row .vn-consequence-card {
  flex: 1 1 0 !important;
  min-width: 0 !important;
  height: auto !important;
  max-height: none !important;
  align-self: stretch !important;
}

.vn-reflection-row .primary-button.vn-choice-button {
  flex: 0 0 clamp(160px, 20%, 220px) !important;
  width: auto !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  align-self: stretch !important;
  pointer-events: auto !important;
  cursor: pointer !important;
}

@media (max-width: 900px) {
  .vn-reflection-row {
    flex-wrap: wrap !important;
  }

  .vn-reflection-row .vn-consequence-card {
    flex: 1 1 28% !important;
  }

  .vn-reflection-row .primary-button.vn-choice-button {
    flex: 1 1 100% !important;
    width: 100% !important;
  }
}

/* --------------------------------------------------------------------
   3. Sidebar: rebalans karta postaci / karta relacji, żeby relacja
   zawsze mieściła się w całości (imię, etykieta, 2 mierniki, mood).
   -------------------------------------------------------------------- */

.vn-sidebar-stack {
  grid-template-rows: minmax(190px, 1.08fr) minmax(215px, 1fr) !important;
  gap: 10px !important;
}

/* "jeśli trzeba: usuń niepotrzebne opisy statusowe z karty postaci" —
   status jest nadal liczony w JS (bez zmiany danych/mechaniki), tylko
   nie zajmuje już miejsca w wąskiej karcie, żeby zrobić przestrzeń
   dla w pełni widocznej karty relacji. */
.vn-player-status {
  display: none !important;
}

.vn-player-card-inner {
  justify-content: flex-start !important;
  gap: 4px !important;
}

.vn-player-name {
  margin: 0 0 4px !important;
}

.vn-player-meta {
  margin: 0 0 10px !important;
}

.vn-player-stat {
  margin: 8px 0 !important;
}

.vn-relationship-card {
  overflow: visible !important;
}

@media (max-height: 790px) {
  .vn-sidebar-stack {
    grid-template-rows: minmax(170px, 1.05fr) minmax(190px, 1fr) !important;
    gap: 8px !important;
  }
}

/* --------------------------------------------------------------------
   4. Agenda meta: każda linia (Ryzyko / Napięcie / hint) osobno,
   zamiast sklejonych w jeden -webkit-box.
   -------------------------------------------------------------------- */

.agenda-choice-card-meta {
  display: flex !important;
  flex-direction: column !important;
  gap: 3px !important;
  -webkit-line-clamp: unset !important;
  -webkit-box-orient: unset !important;
  overflow: visible !important;
}

.agenda-choice-risk,
.agenda-choice-pressure {
  display: block !important;
  white-space: normal !important;
  -webkit-line-clamp: 1 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

.agenda-choice-hint {
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  margin-top: 2px !important;
  padding-top: 3px !important;
  border-top: 1px solid rgba(74, 69, 60, 0.14) !important;
  font-style: italic !important;
}

/* --------------------------------------------------------------------
   5. Evening: więcej miejsca na 2x2 siatkę kart opcji, krótszy tekst
   w każdej karcie, żeby nic nie było ucinane.
   -------------------------------------------------------------------- */

.vn-screen--evening {
  grid-template-rows: 52px minmax(0, 1fr) clamp(215px, 30vh, 275px) !important;
}

/* v0.17.4 ustawiało tu siatkę 2 kolumny — przy 5 opcjach wieczornych
   (a nie 4) to 3 rzędy (2+2+1), za wysokie na dostępny budżet. 3
   kolumny dają 2 rzędy (3+2), które mieszczą się bez ucinania. */
.vn-screen--evening .vn-action-stack,
.vn-screen--evening .evening-options {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  grid-auto-rows: 1fr !important;
  gap: 10px 12px !important;
  width: min(100%, 980px) !important;
  max-width: 980px !important;
}

.vn-screen--evening .evening-option-button {
  min-height: 96px !important;
  max-height: none !important;
  height: 100% !important;
  padding: 9px 10px !important;
  gap: 3px !important;
  overflow: hidden !important;
}

.vn-screen--evening .evening-option-label {
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  font-size: clamp(12px, 1.05vw, 16px) !important;
  line-height: 1.15 !important;
}

.vn-screen--evening .evening-option-description,
.vn-screen--evening .evening-option-effects {
  display: -webkit-box !important;
  -webkit-line-clamp: 1 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

@media (max-width: 900px) {
  .vn-screen--evening .vn-action-stack,
  .vn-screen--evening .evening-options {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-height: 790px) {
  .vn-screen--evening {
    grid-template-rows: 46px minmax(0, 1fr) clamp(190px, 28vh, 230px) !important;
  }

  .vn-screen--evening .evening-option-button {
    min-height: 82px !important;
  }
}
/* CLEAN HOTFIX v0.17.5 professional layout polish END */
"""

CSS_POLISH_MARKER = "CLEAN HOTFIX v0.17.5 professional layout polish"


# ---------------------------------------------------------------------------
# Patche dla js/data/versionData.js oraz index.html
# ---------------------------------------------------------------------------

VERSION_DATA_PATCHES = [
    (
        "export const GAME_VERSION = \"v0.17.4\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.17.4\";",
        "export const GAME_VERSION = \"v0.17.5\";\n"
        "export const GAME_VERSION_LABEL = \"Out of Spoons v0.17.5\";",
        "GAME_VERSION -> v0.17.5",
    ),
]

INDEX_HTML_PATCHES = [
    (
        "  <script type=\"module\" src=\"./js/main.js?v=174\"></script>",
        "  <script type=\"module\" src=\"./js/main.js?v=175\"></script>",
        "cache-bust ?v=175 w index.html",
    ),
]


def main():
    if len(sys.argv) > 1:
        project_root = Path(sys.argv[1])
    else:
        project_root = Path(DEFAULT_PROJECT_ROOT)

    print("Out of Spoons - updater v0.17.5 (Professional Layout Polish Pass)")
    print(f"Katalog projektu: {project_root}\n")

    if not project_root.exists():
        raise UpdaterError(
            f"Katalog projektu nie istnieje: {project_root}\n"
            f'Podaj poprawna sciezke jako argument, np.:\n'
            f'  python apply_hotfix_v0_17_5_professional_layout_polish.py "D:\\sciezka\\do\\OutOfSpoons"'
        )

    expected_files = [
        "js/ui/vnLayout.js",
        "js/ui/screens/gameScreen.js",
        "js/ui/screens/agendaScreen.js",
        "js/ui/screens/eventScreen.js",
        "js/ui/screens/reflectionScreen.js",
        "js/ui/screens/eveningScreen.js",
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

    print("1/6 js/ui/vnLayout.js (pelna podmiana)")
    replace_whole_file(project_root / "js/ui/vnLayout.js", VN_LAYOUT_OLD, VN_LAYOUT_NEW, "vnLayout.js -> mood prefix, createConsequenceCards, layout reflection")
    print()

    print("2/6 js/ui/screens/gameScreen.js (pelna podmiana - usuniecie martwego kodu)")
    replace_whole_file(project_root / "js/ui/screens/gameScreen.js", GAME_SCREEN_OLD, GAME_SCREEN_NEW, "gameScreen.js -> uproszczony narrative strip")
    print()

    print("3/6 js/ui/screens/reflectionScreen.js (pelna podmiana - plaski rzad)")
    replace_whole_file(project_root / "js/ui/screens/reflectionScreen.js", REFLECTION_SCREEN_OLD, REFLECTION_SCREEN_NEW, "reflectionScreen.js -> vn-reflection-row")
    print()

    print("4/6 js/ui/screens/eveningScreen.js (pelna podmiana - usuniecie redundantnego badge)")
    replace_whole_file(project_root / "js/ui/screens/eveningScreen.js", EVENING_SCREEN_OLD, EVENING_SCREEN_NEW, "eveningScreen.js -> czystszy narrative")
    print()

    print("5/6 css/style.css")
    append_css_block_if_needed(project_root / "css/style.css", CSS_POLISH_BLOCK, CSS_POLISH_MARKER, "dopisanie bloku HOTFIX v0.17.5")
    print()

    print("6/6 js/data/versionData.js oraz index.html")
    apply_patches(project_root / "js/data/versionData.js", VERSION_DATA_PATCHES)
    apply_patches(project_root / "index.html", INDEX_HTML_PATCHES, encoding="utf-8-sig")
    print()

    print("=" * 70)
    print("Gotowe. v0.17.5 (Professional Layout Polish Pass) zaaplikowane.")
    print("=" * 70)
    print("""
TEST PO WDROZENIU:

 1. Badge pokazuje "Out of Spoons v0.17.5", index.html ma ?v=175.
 2. Kreator postaci ma klasyczny, waski layout i scrolluje sie
    normalnie (nie jest to zmieniane w tym hotfixie, ale sprawdz).
 3. Reflection:
      - kafle Spoons/Zaufanie/Frustracja NIE wygladaja jak przyciski
        (cienka ramka, brak hover-lift, kursor domyslny),
      - CTA "Wroc do planu dnia" / "Zamknij dzien" jest w tym samym
        rzedzie co kafle, na tej samej osi, nic nie zachodzi na siebie,
      - karta relacji w sidebarze jest w pelni widoczna (Zaufanie,
        Frustracja, "Mood: ...").
 4. Morning: opis sceny czytelny, bez scroll-boxow, bez starych
    sekcji (partner card / agenda / morning events) w narrative.
 5. Agenda: karty rowne i klikalne, "Ryzyko: ..." i "Napiecie: ..."
    sa na OSOBNYCH liniach (nie sklejone w jeden string).
 6. Event: wybory klikalne, bez zmian wzgledem v0.17.4.
 7. Evening: wszystkie 5 kart opcji miesci sie w calosci, bez
    ucinania tekstu u gory/dolu, wszystkie klikalne.
 8. Body nie scrolluje na gameplay screens przy 1366x768.
 9. Non-game screens (menu, kreator) moga scrollowac normalnie.
10. Spoons nadal NIE resetuja sie do maksimum miedzy dniami.
11. Po dniu 7 weekly summary nadal dziala.
""")


if __name__ == "__main__":
    try:
        main()
    except UpdaterError as error:
        print("\nBLAD:", error, file=sys.stderr)
        sys.exit(1)