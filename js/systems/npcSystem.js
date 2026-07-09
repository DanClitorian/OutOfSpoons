// npcSystem.js
//
// Logika dotycząca NPC: tworzenie stanu runtime NPC na podstawie
// statycznej definicji (z data/npcData.js) oraz modyfikacja ich atrybutów.
//
// W prototypie mamy jednego NPC, ale funkcje są napisane tak,
// by bez zmian obsługiwały wielu NPC w przyszłości.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Tworzy obiekt stanu NPC (runtime) na podstawie jego statycznej definicji.
 */
export function initNpc(npcDefinition) {
  return {
    id: npcDefinition.id,
    name: npcDefinition.name,
    trust: npcDefinition.baseTrust,
    frustration: npcDefinition.baseFrustration
  };
}

/**
 * Zmienia poziom zaufania danego NPC. Wynik przycięty do [0, 100].
 */
export function modifyTrust(state, npcId, amount) {
  const npc = state.npcs[npcId];
  if (!npc) {
    console.warn(`Nie znaleziono NPC o id: ${npcId}`);
    return;
  }
  npc.trust = clamp(npc.trust + amount, 0, 100);
}

/**
 * Zmienia poziom frustracji danego NPC. Wynik przycięty do [0, 100].
 */
export function modifyFrustration(state, npcId, amount) {
  const npc = state.npcs[npcId];
  if (!npc) {
    console.warn(`Nie znaleziono NPC o id: ${npcId}`);
    return;
  }
  npc.frustration = clamp(npc.frustration + amount, 0, 100);
}
