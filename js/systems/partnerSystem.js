// partnerSystem.js
//
// Generator pierwszego partnera. Losuje spójny profil na podstawie puli
// danych z data/partnerData.js. Partner na tym etapie nie ma pamięci
// ani prawdziwego AI — to jednorazowo wylosowany, statyczny profil
// plus kilka podstawowych, na razie biernych statystyk (przygotowanych
// pod przyszłe mechaniki, podobnie jak player.flags z kreatora postaci).

import {
  partnerNamePool,
  relationshipLabels,
  relationshipSummaries,
  communicationStyles,
  morningMessageTemplates
} from "../data/partnerData.js";

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Zamienia imię na proste id, np. "Mira" -> "mira". Wystarczające,
 * dopóki w rozgrywce istnieje tylko jeden partner naraz — przy dodaniu
 * kolejnych partnerów trzeba będzie dopilnować unikalności id.
 */
function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // usuwa polskie znaki diakrytyczne
}

/**
 * Generuje pełny, losowy profil partnera gotowy do zapisania
 * w gameState jako state.partner.
 */
export function generatePartner() {
  const name = pickRandom(partnerNamePool);
  const relationshipLabel = pickRandom(relationshipLabels);
  const relationshipSummary = pickRandom(relationshipSummaries);
  const communicationStyle = pickRandom(communicationStyles);
  const morningMessage = pickRandom(morningMessageTemplates).replace("{name}", name);

  return {
    id: slugify(name),
    name,
    relationshipLabel,
    relationshipSummary,
    communicationStyle,

    // Podstawowe statystyki osobowości partnera. Zakres 0-100.
    // Na razie bierne — żaden event jeszcze z nich nie korzysta.
    closenessNeed: randomInt(20, 80),
    autonomyNeed: randomInt(20, 80),
    jealousy: randomInt(0, 60),

    // Startowe wartości relacji. Z tych pól korzysta npcSystem.initNpc,
    // żeby zbudować runtime stan (trust/frustration) w state.npcs.
    baseTrust: randomInt(40, 60),
    baseFrustration: randomInt(10, 30),

    morningMessage
  };
}
