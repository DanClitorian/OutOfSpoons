// gameScreen.js
//
// Ekran poranka: pokazuje aktualny dzień, imię gracza, stan spoons,
// zdanie statusu zależne od cech oraz kartę partnera. Stąd gracz
// przechodzi do wydarzenia dnia.
//
// v0.3: partner nie jest już statycznym Alexem z data/npcData.js —
// jego pełny profil (imię, etykieta relacji, opis relacji, wiadomość
// poranna) pochodzi bezpośrednio ze stanu gry (state.partner),
// wygenerowanego przez systems/partnerSystem.js przy starcie gry.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

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

  if (state.partner) {
    wrapper.appendChild(renderPartnerCard(state.partner));
  }

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

/**
 * Buduje kartę partnera: imię, etykieta relacji, krótki opis relacji
 * i wiadomość poranna. To kluczowe dla czytelności — gracz musi od razu
 * widzieć, że to osoba partnerska, a nie przypadkowy NPC.
 */
function renderPartnerCard(partner) {
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

  const message = document.createElement("p");
  message.className = "npc-message";
  message.textContent = partner.morningMessage;
  card.appendChild(message);

  return card;
}
