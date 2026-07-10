// morningEventSystem.js
//
// Hotfix v0.8.2.
// Morning events make spoons persistent and alive:
//
// previous day leftover spoons
// + global morning event
// + kind partner action
// = current spoons for the new day

import { globalMorningEvents, partnerKindnessEvents } from "../data/morningEventData.js";

export function ensureMorningEventState(state) {
  if (!state.morningEventHistory) {
    state.morningEventHistory = {
      lastGlobalId: null,
      lastPartnerKindnessId: null
    };
  }

  if (!state.todayMorningEvents) {
    state.todayMorningEvents = {
      day: state.day,
      events: [],
      spoonsBefore: state.resources.spoons.current,
      spoonsAfter: state.resources.spoons.current,
      netSpoonsChange: 0
    };
  }

  return state.morningEventHistory;
}

export function resolveMorningEvents(state) {
  ensureMorningEventState(state);

  const spoonsBefore = state.resources.spoons.current;
  const events = [];

  const globalEvent = pickWithoutImmediateRepeat(
    globalMorningEvents,
    state.morningEventHistory.lastGlobalId
  );

  if (globalEvent) {
    events.push(applyMorningEvent(state, globalEvent));
    state.morningEventHistory.lastGlobalId = globalEvent.id;
  }

  if (state.partner) {
    const partnerEvent = pickWithoutImmediateRepeat(
      partnerKindnessEvents,
      state.morningEventHistory.lastPartnerKindnessId
    );

    if (partnerEvent) {
      events.push(applyMorningEvent(state, partnerEvent));
      state.morningEventHistory.lastPartnerKindnessId = partnerEvent.id;
    }
  }

  const spoonsAfter = state.resources.spoons.current;

  state.todayMorningEvents = {
    day: state.day,
    events,
    spoonsBefore,
    spoonsAfter,
    netSpoonsChange: spoonsAfter - spoonsBefore
  };

  return state.todayMorningEvents;
}

function applyMorningEvent(state, event) {
  const resolved = {
    id: event.id,
    type: event.type,
    title: replacePlaceholders(event.title, state),
    description: replacePlaceholders(event.description, state),
    spoonsChange: Number(event.spoonsChange) || 0,
    trustChange: Number(event.trustChange) || 0,
    frustrationChange: Number(event.frustrationChange) || 0
  };

  const actualSpoonsChange = applySpoonsChange(state, resolved.spoonsChange);
  resolved.actualSpoonsChange = actualSpoonsChange;

  if (resolved.type === "partner-kindness") {
    applyPartnerRelationshipChange(state, resolved.trustChange, resolved.frustrationChange);
  }

  return resolved;
}

function applySpoonsChange(state, delta) {
  const spoons = state.resources.spoons;
  const before = spoons.current;
  const max = spoons.max;

  spoons.current = clamp(before + delta, 0, max);

  return spoons.current - before;
}

function applyPartnerRelationshipChange(state, trustChange, frustrationChange) {
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

function pickWithoutImmediateRepeat(items, previousId) {
  if (!items || items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return items[0];
  }

  const candidates = items.filter((item) => item.id !== previousId);
  return candidates[Math.floor(Math.random() * candidates.length)];
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
