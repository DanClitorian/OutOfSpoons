// vnLayout.js
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
