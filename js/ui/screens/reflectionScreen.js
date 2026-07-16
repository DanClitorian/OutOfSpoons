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
//
// v0.31: Content Expansion Pack 1. eventData.js dostał 9 nowych
// eventów, dayAgendaSystem.js zmienił WŁASNY import eventData.js —
// oba importy podbite do ?v=310. Ten plik funkcjonalnie się nie
// zmienił, to czysty cache-bust.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { hasRemainingAgendaItems } from "../../systems/dayAgendaSystem.js?v=310";
import { recordPatternFromChoice } from "../../systems/patternSystem.js?v=300";
import { buildPatternPressureReflection } from "../../systems/patternPressureSystem.js?v=300";
import { buildRelationshipScarReflection } from "../../systems/relationshipScarsSystem.js?v=300";
import { buildRelationshipRepairReflection } from "../../systems/relationshipRepairSystem.js?v=300";
import { buildReflectionStaticLine } from "../../systems/staticSystem.js?v=300";
import { eventPool } from "../../data/eventData.js?v=310";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createResultTile,
  createCtaButton
} from "../oosLayout.js";

import { buildMetamourReflection } from "../../systems/metamourSystem.js?v=300";
import { buildWorkReflection } from "../../systems/workPressureSystem.js?v=300";
import { buildReflectionStakesLine } from "../../systems/dailyStakesSystem.js?v=320";
import { buildReflectionMaskingDebtLine } from "../../systems/maskingDebtSystem.js?v=330";
import { buildReflectionConflictLine } from "../../systems/conflictEscalationSystem.js?v=350";
import { buildReflectionSecrecyLine } from "../../systems/secrecyConsequenceSystem.js?v=380";
export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  // v0.22: Pattern Foundation / Narrative Echoes. Zapisuje wpis do
  // historii wzorców (state.patterns.history), JEŚLI konsekwencja albo
  // treść decyzji dają jakiś tag (patrz patternSystem.js). To NIE jest
  // pojedyncze echo per decyzja — to surowy sygnał, z którego dopiero
  // WZORZEC (3+ razy w 5 dni) generuje echo. Jeśli ta konkretna decyzja
  // akurat aktywowała/odnowiła wzorzec, dostajemy jedno krótkie zdanie
  // do narracji ("Znowu to robisz. ..."). Idempotentne przez key oparty
  // o day/eventId/choiceId, więc bezpieczne przy ponownym renderze.
  // Nie zmienia resultText ani konsekwencji, nie pokazuje przewidywanych
  // efektów na kartach.
  let patternEcho = null;
  if (lastEntry) {
    const originalEvent = eventPool.find((event) => event.id === lastEntry.eventId);
    const originalChoice = originalEvent
      ? originalEvent.choices.find((choice) => choice.id === lastEntry.choiceId)
      : null;

    const triggered = recordPatternFromChoice(state, {
      day: lastEntry.day,
      eventId: lastEntry.eventId,
      choiceId: lastEntry.choiceId,
      choiceLabel: originalChoice ? originalChoice.label : null,
      choiceDescription: lastEntry.resultText,
      consequences: lastEntry.consequences
    });

    if (triggered.length > 0) {
      patternEcho = triggered[0].text;
    }
  }

  // v0.24: Pattern Pressure. Jeśli TA decyzja miała zmodyfikowany koszt
  // przez aktywny wzorzec (patrz eventSystem.js#applyChoice), dostajemy
  // jedno krótkie, subtelne zdanie do narracji — dopiero TU, po fakcie,
  // nigdy przed wyborem. buildPatternPressureReflection() zwraca null,
  // jeśli presja nie zadziałała (zwykły przypadek), więc nic się nie
  // zmienia dla większości decyzji.
  let pressureText = null;
  if (lastEntry && lastEntry.patternPressure) {
    const originalEvent = eventPool.find((event) => event.id === lastEntry.eventId);
    const originalChoice = originalEvent
      ? originalEvent.choices.find((choice) => choice.id === lastEntry.choiceId)
      : null;

    pressureText = buildPatternPressureReflection(
      state,
      originalEvent,
      originalChoice,
      lastEntry.patternPressure
    );
  }

  // v0.25: Relationship Scars. Jeśli TA decyzja miała pomniejszony
  // zysk zaufania przez aktywną bliznę relacyjną (patrz
  // eventSystem.js#applyChoice), dostajemy jedno krótkie, subtelne
  // zdanie do narracji — dopiero TU, po fakcie, nigdy przed wyborem.
  // buildRelationshipScarReflection() zwraca null, jeśli blizna nie
  // zadziałała (zwykły przypadek).
  let scarText = null;
  if (lastEntry && lastEntry.relationshipScarEffect) {
    scarText = buildRelationshipScarReflection(state, lastEntry.relationshipScarEffect);
  }

  // v0.26: Repair Events. Jeśli TA decyzja była świadomym wyborem
  // naprawczym (repairAction), który faktycznie obniżył intensity
  // aktywnej blizny (patrz eventSystem.js#applyChoice), dostajemy jedno
  // krótkie, subtelne zdanie do narracji — dopiero TU, po fakcie.
  // buildRelationshipRepairReflection() zwraca null, jeśli naprawa nie
  // zadziałała (zwykły przypadek — repairAction jest dostępny tylko w
  // specjalnych eventach naprawczych).
  let repairText = null;
  if (lastEntry && lastEntry.relationshipRepairEffect) {
    repairText = buildRelationshipRepairReflection(state, lastEntry.relationshipRepairEffect);
  }

  // v0.27: The Static. Jeśli szum wewnętrzny był dziś aktywny
  // (intensity >= 2, przeliczony raz dziennie w gameScreen.js — tu
  // tylko go CZYTAMY), dostajemy JEDNO krótkie zdanie do narracji.
  // Maksymalnie jedno zdanie — nie dokłada się do ściany tekstu z
  // Pattern Pressure/Relationship Scars/Repair.
  const staticText = buildReflectionStaticLine(state, lastEntry);
  const metamourText = buildMetamourReflection(state, lastEntry ? lastEntry.metamourEffect : null);
  const workText = buildWorkReflection(state, lastEntry ? lastEntry.workEffect : null);

  // v0.32: Game Feel / Daily Stakes Pass. Jedno krótkie zdanie, TYLKO
  // CZASEM (nigdy przy niskim napięciu dnia, patrz
  // dailyStakesSystem.js#buildReflectionStakesLine) — żeby nie
  // dokładać się do ściany tekstu z pozostałych systemów powyżej.
  const stakesText = buildReflectionStakesLine(state, lastEntry);

  // v0.33: Masking Debt. Jeśli TA decyzja była wykryta jako maskująca
  // (patrz eventSystem.js#applyChoice), dostajemy jedno krótkie zdanie
  // — dopiero TU, po fakcie, nigdy przed wyborem, i nigdy jako liczba
  // ("masking debt +1"). buildReflectionMaskingDebtLine() zwraca null
  // w normalnym przypadku (wybór niemaskujący).
  const maskingDebtText = buildReflectionMaskingDebtLine(state, lastEntry);
  const conflictText = buildReflectionConflictLine(state, lastEntry);
  const secrecyText = buildReflectionSecrecyLine(state, lastEntry);

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

  const narrative = createNarrativeStrip(
    buildNarrativeText(
      resultText,
      consequences,
      patternEcho,
      pressureText,
      scarText,
      repairText,
      staticText,
      metamourText,
      workText,
      stakesText,
      maskingDebtText,
      conflictText,
      secrecyText
    )
  );

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

// v0.19.1: Frustracja i Przeciążenie mają ODWROTNĄ semantykę koloru —
// ich WZROST jest złym efektem (czerwony), a SPADEK dobrym (zielony).
// Spoons i Zaufanie zachowują domyślną semantykę (wzrost = dobry =
// zielony) — patrz createResultTile() / resolveResultDirection() w
// oosLayout.js.
function buildResultTiles(consequences) {
  const items = [
    { icon: "🥄", label: "Spoons", value: consequences.spoonsChange },
    { icon: "🤝", label: "Zaufanie", value: consequences.trustChange },
    { icon: "🌡️", label: "Frustracja", value: consequences.frustrationChange, desirableDirection: "down" }
  ];

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange !== 0) {
    items.push({ icon: "🌀", label: "Przeciążenie", value: consequences.fatigueChange, desirableDirection: "down" });
  }

  return items.map((item) => createResultTile(item));
}

function buildNarrativeText(
  resultText,
  consequences,
  patternEcho,
  pressureText,
  scarText,
  repairText,
  staticText,
  metamourText,
  workText,
  stakesText,
  maskingDebtText,
  conflictText,
  secrecyText
) {
  const interpretation = consequences ? buildInterpretation(consequences) : null;
  const parts = [
    resultText,
    interpretation,
    patternEcho,
    pressureText,
    scarText,
    repairText,
    staticText,
    metamourText,
    workText,
    stakesText,
    maskingDebtText,
    conflictText,
    secrecyText
  ].filter(Boolean);
  return parts.join(" ");
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
