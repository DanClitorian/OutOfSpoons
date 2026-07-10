// eveningRecoverySystem.js
//
// v0.9: applies one evening recovery choice before the next day starts.
// This system mutates the existing game state in place.
// It does not create a new save version.

import { eveningRecoveryOptions } from "../data/eveningRecoveryData.js";

export function getEveningRecoveryOptions(state) {
  return eveningRecoveryOptions;
}

export function applyEveningRecovery(optionId, state) {
  const option = eveningRecoveryOptions.find((item) => item.id === optionId);

  if (!option) {
    throw new Error(`Nieznana opcja wieczoru: ${optionId}`);
  }

  const resolvedOption = resolveOption(option, state);
  const effects = resolvedOption.effects;

  applySpoonsChange(state, effects.spoonsChange);
  applyRelationshipChange(state, effects.trustChange, effects.frustrationChange);

  state.lastEveningRecovery = {
    optionId: resolvedOption.id,
    label: resolvedOption.label,
    description: resolvedOption.description,
    effects: { ...effects },
    day: state.day
  };

  return resolvedOption;
}

function resolveOption(option, state) {
  return {
    ...option,
    label: replacePlaceholders(option.label, state),
    description: replacePlaceholders(option.description, state),
    effects: { ...option.effects }
  };
}

function applySpoonsChange(state, delta) {
  if (!state.resources || !state.resources.spoons) {
    return;
  }

  const spoons = state.resources.spoons;
  const max = Number(spoons.max) || 10;
  const current = Number(spoons.current) || 0;

  spoons.current = clamp(current + delta, 0, max);
}

function applyRelationshipChange(state, trustChange, frustrationChange) {
  if (!state.partner || !state.npcs) {
    return;
  }

  const npc = state.npcs[state.partner.id];

  if (!npc) {
    return;
  }

  if (typeof npc.trust === "number") {
    npc.trust = clamp(npc.trust + trustChange, 0, 100);
  }

  if (typeof npc.frustration === "number") {
    npc.frustration = clamp(npc.frustration + frustrationChange, 0, 100);
  }
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}
