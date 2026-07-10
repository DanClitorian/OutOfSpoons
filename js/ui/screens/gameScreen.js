// gameScreen.js
//
// Morning screen.
// Shows persistent spoons, morning events, player status, partner card,
// relationship bars and relationship mood.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

import { ensureDailyAgenda, getAgendaSlotLabel } from "../../systems/dayAgendaSystem.js";
import { saveGame } from "../../state/saveManager.js";
export function renderGameScreen(container) {
  const state = getState();
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const header = document.createElement("h2");
  header.textContent = `Dzie\u0144 ${state.day} \u2014 ${playerName}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));
  wrapper.appendChild(renderPersistentSpoonsNote());

  const previousEveningSummary = renderPreviousEveningSummary(state);
  if (previousEveningSummary) {
    wrapper.appendChild(previousEveningSummary);
  }

  const morningEvents = renderMorningEvents(state);
  if (morningEvents) {
    wrapper.appendChild(morningEvents);
  }

  wrapper.appendChild(renderDailyAgendaSection(state));

  if (state.player) {
    const statusSentence = document.createElement("p");
    statusSentence.className = "status-sentence";
    statusSentence.textContent = buildStatusSentence(state.player);
    wrapper.appendChild(statusSentence);
  }

  if (state.partner) {
    const npc = state.npcs ? state.npcs[state.partner.id] : undefined;
    wrapper.appendChild(renderPartnerCard(state.partner, npc));
  }

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Wybierz, czym zajmiesz się teraz";
  continueButton.addEventListener("click", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });
  wrapper.appendChild(continueButton);

  container.appendChild(wrapper);
}

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

function renderPersistentSpoonsNote() {
  const note = document.createElement("p");
  note.className = "persistent-spoons-note";
  note.textContent = "Spoons nie odnawiają się automatycznie. To, co zostaje po dniu, przechodzi na kolejny poranek.";
  return note;
}

// CLEAN v0.10 previous evening summary helpers START
function renderPreviousEveningSummary(state) {
  const recovery = state.lastEveningRecovery;

  if (!recovery || recovery.day !== state.day - 1) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "previous-evening-summary";

  const heading = document.createElement("p");
  heading.className = "previous-evening-heading";
  heading.textContent = "Wczoraj wieczorem";
  section.appendChild(heading);

  const label = document.createElement("p");
  label.className = "previous-evening-label";
  label.textContent = replacePartnerPlaceholder(recovery.label, state);
  section.appendChild(label);

  const description = document.createElement("p");
  description.className = "previous-evening-description";
  description.textContent = replacePartnerPlaceholder(recovery.description, state);
  section.appendChild(description);

  const effects = document.createElement("p");
  effects.className = "previous-evening-effects";
  effects.textContent = formatPreviousEveningEffects(recovery.effects);
  section.appendChild(effects);

  return section;
}

function formatPreviousEveningEffects(effects) {
  if (!effects) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSignedForPreviousEvening(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSignedForPreviousEvening(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSignedForPreviousEvening(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function replacePartnerPlaceholder(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatSignedForPreviousEvening(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
// CLEAN v0.10 previous evening summary helpers END

function renderMorningEvents(state) {
  const morning = state.todayMorningEvents;

  if (!morning || !Array.isArray(morning.events) || morning.events.length === 0) {
    return null;
  }

  if (morning.day !== state.day) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "morning-events";

  const heading = document.createElement("p");
  heading.className = "morning-events-heading";
  heading.textContent = "Poranek";
  section.appendChild(heading);

  morning.events.forEach((event) => {
    section.appendChild(renderMorningEvent(event));
  });

  if (typeof morning.netSpoonsChange === "number" && morning.netSpoonsChange !== 0) {
    const net = document.createElement("p");
    net.className = "morning-events-net";
    net.textContent = `Bilans poranka: ${formatSigned(morning.netSpoonsChange)} spoons`;
    section.appendChild(net);
  }

  return section;
}

function renderMorningEvent(event) {
  const item = document.createElement("div");
  item.className = `morning-event morning-event--${event.type}`;

  const title = document.createElement("p");
  title.className = "morning-event-title";
  title.textContent = event.title;
  item.appendChild(title);

  const description = document.createElement("p");
  description.className = "morning-event-description";
  description.textContent = event.description;
  item.appendChild(description);

  const effects = buildMorningEventEffects(event);
  if (effects.length > 0) {
    const effectLine = document.createElement("p");
    effectLine.className = "morning-event-effects";
    effectLine.textContent = effects.join(" · ");
    item.appendChild(effectLine);
  }

  return item;
}

function buildMorningEventEffects(event) {
  const effects = [];

  if (typeof event.actualSpoonsChange === "number" && event.actualSpoonsChange !== 0) {
    effects.push(`Spoons ${formatSigned(event.actualSpoonsChange)}`);
  }

  if (typeof event.trustChange === "number" && event.trustChange !== 0) {
    effects.push(`Zaufanie ${formatSigned(event.trustChange)}`);
  }

  if (typeof event.frustrationChange === "number" && event.frustrationChange !== 0) {
    effects.push(`Frustracja ${formatSigned(event.frustrationChange)}`);
  }

  return effects;
}

// CLEAN v0.13 daily agenda helpers START
function renderDailyAgendaSection(state) {
  const agenda = ensureDailyAgenda(state);

  const section = document.createElement("div");
  section.className = "daily-agenda";

  const heading = document.createElement("p");
  heading.className = "daily-agenda-heading";
  heading.textContent = "Agenda dnia";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "daily-agenda-list";

  agenda.slots.forEach((item, index) => {
    list.appendChild(renderDailyAgendaItem(item, index, agenda.currentIndex, agenda.slots.length));
  });

  section.appendChild(list);
  return section;
}

function renderDailyAgendaItem(item, index, currentIndex, totalSlots) {
  const listItem = document.createElement("li");
  const classes = ["daily-agenda-item"];

  if (item.completed) {
    classes.push("daily-agenda-item--completed");
  } else if (index === currentIndex) {
    classes.push("daily-agenda-item--current");
  }

  listItem.className = classes.join(" ");

  const indexLabel = document.createElement("span");
  indexLabel.className = "daily-agenda-index";
  indexLabel.textContent = `[${index + 1}/${totalSlots}]`;
  listItem.appendChild(indexLabel);

  const label = document.createElement("span");
  label.className = "daily-agenda-label";
  label.textContent = getAgendaSlotLabel(item.slot);
  listItem.appendChild(label);

  return listItem;
}
// CLEAN v0.13 daily agenda helpers END

function renderPartnerCard(partner, npc) {
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

  const communicationStyle = document.createElement("p");
  communicationStyle.className = "partner-communication-style";
  communicationStyle.textContent = `Styl komunikacji: ${partner.communicationStyle}`;
  card.appendChild(communicationStyle);

  card.appendChild(renderRelationshipState(npc));

  return card;
}

function renderRelationshipState(npc) {
  const section = document.createElement("div");
  section.className = "relationship-state";

  const heading = document.createElement("p");
  heading.className = "relationship-state-heading";
  heading.textContent = "Stan relacji";
  section.appendChild(heading);

  if (!npc) {
    const fallback = document.createElement("p");
    fallback.className = "relationship-state-empty";
    fallback.textContent = "Brak danych";
    section.appendChild(fallback);
    return section;
  }

  section.appendChild(renderRelationshipMeter("Zaufanie", npc.trust, "trust"));
  section.appendChild(renderRelationshipMeter("Frustracja", npc.frustration, "frustration"));
  section.appendChild(renderRelationshipMood(npc));

  return section;
}

function renderRelationshipMeter(label, value, modifier) {
  const safeValue = clampToPercentage(Number(value) || 0);

  const meter = document.createElement("div");
  meter.className = "relationship-meter";

  const labelEl = document.createElement("span");
  labelEl.className = "relationship-meter-label";
  labelEl.textContent = label;
  meter.appendChild(labelEl);

  const track = document.createElement("div");
  track.className = "relationship-meter-track";

  const fill = document.createElement("div");
  fill.className = `relationship-meter-fill relationship-meter-fill--${modifier}`;
  fill.style.width = `${safeValue}%`;
  track.appendChild(fill);
  meter.appendChild(track);

  const valueEl = document.createElement("span");
  valueEl.className = "relationship-meter-value";
  valueEl.textContent = `${safeValue}/100`;
  meter.appendChild(valueEl);

  return meter;
}

function renderRelationshipMood(npc) {
  const mood = buildRelationshipMood(npc);

  const moodSection = document.createElement("div");
  moodSection.className = "relationship-mood";

  const label = document.createElement("p");
  label.className = "relationship-mood-label";
  label.textContent = `Stan emocjonalny relacji: ${mood.label}`;
  moodSection.appendChild(label);

  const description = document.createElement("p");
  description.className = "relationship-mood-description";
  description.textContent = mood.description;
  moodSection.appendChild(description);

  return moodSection;
}

function buildRelationshipMood(npc) {
  const trust = clampToPercentage(Number(npc.trust) || 0);
  const frustration = clampToPercentage(Number(npc.frustration) || 0);

  if (trust >= 70 && frustration <= 25) {
    return {
      label: "Bezpiecznie",
      description: "W tej relacji jest dużo zaufania i niewiele napięcia."
    };
  }

  if (trust >= 50 && frustration <= 45) {
    return {
      label: "Stabilnie",
      description: "Relacja trzyma się dobrze, choć nadal wymaga uważności."
    };
  }

  if (frustration >= 70 && trust >= 40) {
    return {
      label: "Napięcie",
      description: "Zaufanie jeszcze istnieje, ale napięcie zaczyna dominować."
    };
  }

  if (trust < 35 && frustration >= 55) {
    return {
      label: "Krucho",
      description: "Relacja może źle znosić kolejne uniki albo niejasne sygnały."
    };
  }

  if (trust < 35) {
    return {
      label: "Niepewnie",
      description: "W relacji brakuje poczucia bezpieczeństwa."
    };
  }

  if (frustration >= 55) {
    return {
      label: "Przeciążenie",
      description: "Nagromadzone napięcie zaczyna być trudne do ignorowania."
    };
  }

  return {
    label: "Niejasno",
    description: "Relacja jest w ruchu. Jeszcze nie wiadomo, w którą stronę pójdzie."
  };
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function clampToPercentage(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
