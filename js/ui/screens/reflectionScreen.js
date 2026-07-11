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
