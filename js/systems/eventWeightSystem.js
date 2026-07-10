// eventWeightSystem.js
export function getWeightedEventForDay(events, state, previousEventId = null) {
  try {
    const candidates = excludeImmediateRepeat(events, previousEventId);
    if (!candidates || candidates.length === 0) return pickRandom(events);
    return pickWeightedRandom(candidates, state);
  } catch (error) {
    console.warn("eventWeightSystem fallback:", error);
    return pickRandom(events);
  }
}

function excludeImmediateRepeat(events, previousEventId) {
  if (!Array.isArray(events) || events.length === 0) return [];
  if (events.length > 1 && previousEventId) {
    const filtered = events.filter((event) => event.id !== previousEventId);
    if (filtered.length > 0) return filtered;
  }
  return events;
}

function pickWeightedRandom(candidates, state) {
  const weighted = candidates.map((event) => ({
    event,
    weight: computeEventWeight(event, state)
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return pickRandom(candidates);
  let roll = Math.random() * totalWeight;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.event;
  }
  return weighted[weighted.length - 1].event;
}

function computeEventWeight(event, state) {
  let weight = 1;
  const tags = event && Array.isArray(event.weightTags) ? event.weightTags : [];
  if (tags.length === 0) return weight;

  const spoons = readCurrentSpoons(state);
  const trust = readCurrentTrust(state);
  const frustration = readCurrentFrustration(state);

  if (tags.includes("low-spoons") && spoons !== null && spoons <= 3) weight += 3;
  if (tags.includes("high-spoons") && spoons !== null && spoons >= 7) weight += 2;
  if (tags.includes("high-frustration") && frustration !== null && frustration >= 60) weight += 3;
  if (tags.includes("low-trust") && trust !== null && trust <= 35) weight += 3;
  if (tags.includes("high-trust") && trust !== null && trust >= 70) weight += 3;

  if (
    tags.includes("repair") &&
    trust !== null &&
    frustration !== null &&
    trust >= 45 &&
    frustration >= 35
  ) weight += 2;

  if (tags.includes("tension") && frustration !== null && frustration >= 50) weight += 2;
  if (tags.includes("avoidance") && spoons !== null && spoons <= 4) weight += 2;

  return Math.max(1, weight);
}

function readCurrentSpoons(state) {
  return state &&
    state.resources &&
    state.resources.spoons &&
    typeof state.resources.spoons.current === "number"
    ? state.resources.spoons.current
    : null;
}

function readCurrentTrust(state) {
  const npc = readCurrentNpc(state);
  return npc && typeof npc.trust === "number" ? npc.trust : null;
}

function readCurrentFrustration(state) {
  const npc = readCurrentNpc(state);
  return npc && typeof npc.frustration === "number" ? npc.frustration : null;
}

function readCurrentNpc(state) {
  return state && state.partner && state.npcs ? state.npcs[state.partner.id] || null : null;
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error("No events available.");
  return list[Math.floor(Math.random() * list.length)];
}
