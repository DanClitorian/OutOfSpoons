// gameScreen.js
//
// Ekran poranka: pokazuje aktualny dzień, stan spoons oraz wiadomość
// od NPC. Stąd gracz przechodzi do wydarzenia dnia.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";
import { npcData } from "../../data/npcData.js";

export function renderGameScreen(container) {
  const state = getState();
  // Zabezpieczenie na wypadek nietypowego stanu bez postaci —
  // w normalnym flow (kreator -> start gry) player zawsze istnieje.
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const header = document.createElement("h2");
  header.textContent = `Dzień ${state.day} — ${playerName}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));

  if (state.player) {
    const statusSentence = document.createElement("p");
    statusSentence.className = "status-sentence";
    statusSentence.textContent = buildStatusSentence(state.player);
    wrapper.appendChild(statusSentence);
  }

  // Prototyp v0.1: jeden NPC, więc bierzemy pierwszego z listy.
  const npcId = Object.keys(state.npcs)[0];
  const npcDefinition = npcData[npcId];

  const message = document.createElement("p");
  message.className = "npc-message";
  message.textContent = npcDefinition.morningMessage;
  wrapper.appendChild(message);

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Zobacz, co się dzieje";
  continueButton.addEventListener("click", () => {
    goToEvent();
    showScreen("event");
  });
  wrapper.appendChild(continueButton);

  container.appendChild(wrapper);
}

/**
 * Buduje wizualny licznik spoons (etykieta liczbowa + rząd ikon).
 */
function renderSpoonsMeter(spoons) {
  const meter = document.createElement("div");
  meter.className = "spoons-meter";

  const label = document.createElement("span");
  label.className = "spoons-label";
  label.textContent = `Spoons: ${spoons.current}/${spoons.max}`;
  meter.appendChild(label);

  const row = document.createElement("div");
  row.className = "spoons-row";
  for (let i = 0; i < spoons.max; i++) {
    const spoon = document.createElement("span");
    spoon.className = i < spoons.current ? "spoon full" : "spoon empty";
    row.appendChild(spoon);
  }
  meter.appendChild(row);

  return meter;
}