// oosLayout.js
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
// v0.44.1: Choice Feedback Unification. Dodany opcjonalny 4. parametr
// `options` — jeśli options.showAchievements === true, dopisuje mały,
// subtelny przycisk-skrót do osiągnięć po prawej stronie topbara,
// obok statystyk. Backward-compatible: wszystkie istniejące wywołania
// (2-3 argumenty) działają dokładnie tak jak wcześniej, bo options
// domyślnie jest pustym obiektem.
export function createTopBar(state, screenName, overridePhaseText, options = {}) {
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

  if (options.showAchievements) {
    const achievementsButton = document.createElement("button");
    achievementsButton.type = "button";
    achievementsButton.className = "oos-topbar-achievements";
    achievementsButton.setAttribute("aria-label", "Osiągnięcia");
    achievementsButton.textContent = "🏆";
    if (typeof options.onAchievementsClick === "function") {
      achievementsButton.addEventListener("click", options.onAchievementsClick);
    }
    stats.appendChild(achievementsButton);
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

// v0.45.1: Solo UI Parity Fix. Wyeksportowane (było prywatne), żeby
// gameScreen.js mogło budować karty statystyk solo/dating DOKŁADNIE
// tym samym mechanizmem co karta partnera (oos-stat-bar) — zero
// nowego CSS potrzebnego do samych pasków statystyk.
export function buildStatBar(label, valueText, percentValue, modifier) {
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

// v0.45.1: Solo UI Parity Fix. Wcześniej zwracało npc niezależnie od
// state.partner.status — podczas solo (partner.status === "ex", obiekt
// celowo NIE jest usuwany, patrz soloRecoverySystem.js) createPlayerCard()
// pokazywałaby pasek zaufania do BYŁEGO partnera, co jest mylące
// (sugeruje aktywną relację, której już nie ma). Teraz zwraca npc
// TYLKO dla partnera o statusie "active" — naprawia to zarówno dla
// reużycia createPlayerCard() w trybie solo, jak i dla każdego innego
// przyszłego miejsca, które mogłoby wywołać ten sam problem.
function getPartnerNpc(state) {
  if (!state || !state.partner || !state.npcs) {
    return null;
  }

  if (state.partner.status && state.partner.status !== "active") {
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
 * opcjonalne linie meta, każda jako osobny element (nigdy sklejone w
 * jeden string).
 *
 * v0.19.1: metaLines NIE mają już służyć do ujawniania mechaniki przed
 * wyborem (Ryzyko/Napięcie/Koszt/Niepewność/Spoons/Zaufanie/Frustracja)
 * — ekrany (agendaScreen.js, eventScreen.js, eveningScreen.js) przestały
 * ich w ten sposób używać. Parametr statusText jest OK do pokazywania
 * dostępności (np. "wybierz" / "ukończone" / "niedostępne teraz"), bo
 * to nie jest przewidywanie efektu, tylko stan wyboru.
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
 * @param {"up"|"down"} [options.desirableDirection] - v0.19.1: dla
 *   większości statystyk WZROST jest dobry (domyślne "up" — Spoons,
 *   Zaufanie: wartość dodatnia = zielona/pozytywna). Dla statystyk,
 *   gdzie wzrost jest zły (np. Frustracja, Przeciążenie), przekaż
 *   "down" — wtedy wartość dodatnia dostaje kolor NEGATYWNY (czerwony),
 *   a ujemna POZYTYWNY (zielony). Sama liczba (formatSigned) nie
 *   zmienia się — zmienia się tylko interpretacja koloru.
 */
export function createResultTile(options) {
  const { icon, label, value, desirableDirection } = options || {};
  const direction = resolveResultDirection(value, desirableDirection);

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

function resolveResultDirection(value, desirableDirection) {
  if (!value) {
    return "neutral";
  }

  const isIncrease = value > 0;

  if (desirableDirection === "down") {
    return isIncrease ? "negative" : "positive";
  }

  return isIncrease ? "positive" : "negative";
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
