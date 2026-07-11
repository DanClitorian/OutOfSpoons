// reflectionScreen.js
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
