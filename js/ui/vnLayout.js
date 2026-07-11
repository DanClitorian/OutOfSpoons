// vnLayout.js
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
