// reflectionScreen.js
//
// Reflection screen after the daily event.
// v0.9: this screen no longer advances to the next day.
// It leads to the evening recovery screen instead.
//
// v0.16: to jest ekran, na którym gracz PIERWSZY RAZ widzi dokładne
// liczby dla swojej decyzji (event screen celowo ich już nie pokazuje).
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js).
//
// v0.59: Reflection Screen Game Feel & Consequence Clarity. Ekran
// PRZESTAJE sklejać do 16 fragmentów tekstu w jeden akapit i PRZESTAJE
// pokazywać surowe liczby (spoons/trust/frustration/fatigue) na
// kaflach wyników. Cała logika WYBORU, co pokazać, przeniesiona do
// js/systems/reflectionSummarySystem.js#buildReflectionSummary —
// ten plik jest teraz WYŁĄCZNIE odpowiedzialny za render:
//   1. Hero: opcjonalny label wyboru + resultText jako główny,
//      największy tekst.
//   2. Maks. 3 karty najważniejszych konsekwencji (tytuły tematyczne:
//      "W ciele" / "W relacji" / "W pracy" / "W tle" / "W ustaleniach"
//      / "W sieci relacji" / "W pamięci dnia" / "W napięciu" — NIGDY
//      nazwy systemów).
//   3. Jedna opcjonalna linia "cichego śladu".
//   4. Do 3 małych chipów tekstowych zamiast liczbowych kafli (zero
//      liczb — patrz buildChips w reflectionSummarySystem.js).
//   5. CTA — bez zmian we flow (agenda/evening dokładnie jak wcześniej).
// Mechanika, state.log, i wszystkie build*Reflection funkcje w innych
// plikach są NIETKNIĘTE — ten patch zmienia WYŁĄCZNIE prezentację.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js?v=601";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createCtaButton
} from "../oosLayout.js?v=530";
// v0.59: cała selekcja/priorytetyzacja konsekwencji żyje tu.
import { buildReflectionSummary, buildReflectionClosingLine } from "../../systems/reflectionSummarySystem.js?v=601";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const fallbackResultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");

  const summary = buildReflectionSummary(state, lastEntry);

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

  const narrative = summary
    ? buildReflectionNarrative(summary)
    : buildFallbackNarrative(fallbackResultText);

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

  const chips = summary ? buildChipTiles(summary.chips) : [];

  const shell = createGameShell({
    screenClass: "reflection",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [...chips, cta],
    actionsVariant: "reflection"
  });

  container.appendChild(shell);
}

// --------------------------------------------------------------------
// Render — hero + do 3 kart + cichy ślad + linia domknięcia.
// --------------------------------------------------------------------

function buildReflectionNarrative(summary) {
  const strip = document.createElement("section");
  strip.className = "oos-narrative oos-reflection-summary";

  if (summary.choiceLabel) {
    const eyebrow = document.createElement("p");
    eyebrow.className = "oos-reflection-summary__choice";
    eyebrow.textContent = summary.choiceLabel;
    strip.appendChild(eyebrow);
  }

  const result = document.createElement("p");
  result.className = "oos-narrative-text oos-reflection-summary__result";
  result.textContent = summary.resultText || "";
  strip.appendChild(result);

  if (summary.cards.length > 0) {
    const cardsWrap = document.createElement("div");
    cardsWrap.className = "oos-reflection-summary__cards";
    for (const card of summary.cards) {
      cardsWrap.appendChild(buildCard(card.title, card.text));
    }
    strip.appendChild(cardsWrap);
  }

  if (summary.quietTrace) {
    const trace = document.createElement("p");
    trace.className = "oos-reflection-summary__trace";
    trace.textContent = summary.quietTrace;
    strip.appendChild(trace);
  }

  const closing = buildReflectionClosingLine(summary);
  if (closing) {
    const closingEl = document.createElement("p");
    closingEl.className = "oos-reflection-summary__closing";
    closingEl.textContent = closing;
    strip.appendChild(closingEl);
  }

  return strip;
}

function buildFallbackNarrative(resultText) {
  const strip = document.createElement("section");
  strip.className = "oos-narrative oos-reflection-summary";

  const result = document.createElement("p");
  result.className = "oos-narrative-text oos-reflection-summary__result";
  result.textContent = resultText || "";
  strip.appendChild(result);

  return strip;
}

function buildCard(titleText, bodyText) {
  const card = document.createElement("div");
  card.className = "oos-reflection-summary__card";

  const title = document.createElement("p");
  title.className = "oos-reflection-summary__card-title";
  title.textContent = titleText;

  const body = document.createElement("p");
  body.className = "oos-reflection-summary__card-text";
  body.textContent = bodyText;

  card.appendChild(title);
  card.appendChild(body);
  return card;
}

// --------------------------------------------------------------------
// Chipy — reużywają istniejące klasy .oos-result-tile (zero nowego
// CSS potrzebnego tu), ale BEZ elementu wartości — tylko etykieta
// tekstowa, nigdy liczba. Neutralny wariant kolorystyczny (chip nie
// jest "dobry/zły", tylko krótką notatką).
// --------------------------------------------------------------------

function buildChipTiles(chips) {
  if (!Array.isArray(chips)) return [];
  return chips.map((text) => {
    const tile = document.createElement("div");
    tile.className = "oos-result-tile oos-result-tile--neutral";

    const label = document.createElement("span");
    label.className = "oos-result-tile-label";
    label.textContent = text;

    tile.appendChild(label);
    return tile;
  });
}

function buildDayProgressText(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;
  return `${completed}/${total}`;
}
