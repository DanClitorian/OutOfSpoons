// gameScreen.js
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
