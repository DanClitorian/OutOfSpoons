// eventWeightSystem.js
import { getPartnerCapacityContext } from "./partnerCapacitySystem.js";
import { hasRepairableScars } from "./relationshipRepairSystem.js?v=300";

import { getMetamourContext, hasMetamourSignal } from "./metamourSystem.js?v=300";
import { getWorkPressureContext, hasWorkSignal } from "./workPressureSystem.js?v=300";
// v0.46: Work & Obligation Variety Pass. Odczyt WYŁĄCZNIE (żadna
// modyfikacja criticalEventSystem.js) — potrzebne do delikatnego
// ważenia eventów "critical-event-approaching" (patrz niżej), które
// mają zapowiadać nadchodzący Wielki Test w codziennych obowiązkach.
import { getCurrentCriticalEvent, getCriticalEventCountdown } from "./criticalEventSystem.js?v=601";
// v0.55: Narrative Consequence Memory. Lekki odczyt aktywnych
// sladow (Set typow, intensity >= 2) — bez importu ciezkich
// systemow, jedna mala, czysta funkcja odczytu.
import { getNarrativeMemoryWeightTags } from "./narrativeMemorySystem.js?v=560";
// v0.56: Relationship Model Consequence Pass. Lekki odczyt (Set
// flag: low-clarity/poly-open/monogamy/recent-friction) — zero
// nowej mechaniki, tylko wplyw na losowanie.
import { getRelationshipModelWeightTags } from "./relationshipModelConsequenceSystem.js?v=560";
// v0.57: Daily Texture & Pacing Director. Lekki odczyt gotowej listy
// weightTags DZISIEJSZEJ tekstury (juz rozwiazanej przez
// dayAgendaSystem.js#ensureDailyAgenda, ktore wola sie ZAWSZE przed
// tym systemem w tym samym cyklu budowania agendy).
import { getDayTextureWeightTags } from "./dayTextureSystem.js?v=601";
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

  // v0.23: Partner Capacity Foundation. Delikatne ważenie (NIE
  // guaranteed spawn) — eventy oznaczone tymi tagami mają WIĘKSZĄ
  // SZANSĘ pojawić się, kiedy partner ma dziś mało miejsca, ale nadal
  // konkurują losowo z resztą puli.
  const partnerCapacity = getPartnerCapacityContext(state);
  if (tags.includes("partner-capacity-low")) {
    if (partnerCapacity.isLow) weight += 4;
    if (partnerCapacity.isCritical) weight += 3;
  }
  if (tags.includes("partner-needs-support") && partnerCapacity.stress >= 65) weight += 3;

  // v0.26: Repair Events. Delikatne ważenie (NIE guaranteed spawn) —
  // eventy naprawcze mają WIĘKSZĄ SZANSĘ pojawić się, kiedy istnieje
  // przynajmniej jedna aktywna blizna do naprawienia. Bez aktywnej
  // blizny te eventy nadal mogą wystąpić (bazowa waga = 1), tylko bez
  // bonusu.
  if ((tags.includes("relationship-scar") || tags.includes("repair-opportunity")) && hasRepairableScars(state)) {
    weight += 5;
  }

  // v0.28: Metamour weights. Delikatne ważenie, bez forced spawnu.
  if (tags.includes("metamour-signal") && hasMetamourSignal(state)) {
    weight += 4;
  }

  const metamourContext = getMetamourContext(state);
  if (
    metamourContext &&
    metamourContext.tension >= 60 &&
    (tags.includes("relationship-tension") || tags.includes("tension"))
  ) {
    weight += 2;
  }

  // v0.29: Work Pressure weights. Delikatne ważenie, bez forced spawnu.
  const workContext = getWorkPressureContext(state);
  const allTags = Array.from(new Set([...(tags || []), ...((event && event.tags) || [])]));

  if (
    workContext &&
    allTags.includes("work-pressure") &&
    (workContext.pressure >= 55 || hasWorkSignal(state))
  ) {
    weight += 4;
  }

  if (
    workContext &&
    workContext.burnout >= 60 &&
    (allTags.includes("burnout") || allTags.includes("low-spoons"))
  ) {
    weight += 2;
  }

  if (
    workContext &&
    workContext.stability <= 35 &&
    (allTags.includes("obligation") || allTags.includes("work"))
  ) {
    weight += 2;
  }

  // v0.46: Work & Obligation Variety Pass. Delikatne ważenie (NIE
  // guaranteed spawn) — eventy oznaczone "critical-event-approaching"
  // mają WIĘKSZĄ SZANSĘ pojawić się, kiedy aktywny Wielki Test jest
  // już blisko terminu (≤14 dni), zapowiadając go w codziennych
  // obowiązkach. Bez aktywnego Wielkiego Testu (albo gdy jest jeszcze
  // daleko) te eventy nadal mogą wystąpić (bazowa waga = 1), tylko bez
  // bonusu.
  // v0.54: Month One Content Expansion & Anti-Repetition Pass.
  // Dwie DELIKATNE reguły ważenia (nie forced spawn, tylko bonus wagi),
  // czytające stan WPROST — bez importu fatigueSystem.js/
  // maskingDebtSystem.js (obie wartości są już ensure'owane wcześniej
  // w cyklu dnia, zanim agenda w ogóle woła to losowanie: fatigue w
  // dayCycle#startNewGame, maskingDebt w gameScreen przed
  // ensureDailyAgenda). Zero nowego importu, zero refaktoru losowania.
  //
  // Wysokie zmęczenie (>=4 z 6, ten sam próg co "fatigue-high" na
  // poranku v0.52.1) -> nieco częściej eventy ciała/odpoczynku
  // oznaczone tagiem "high-fatigue".
  const fatigueCurrent =
    state && state.resources && state.resources.fatigue &&
    typeof state.resources.fatigue.current === "number"
      ? state.resources.fatigue.current
      : null;
  if (tags.includes("high-fatigue") && fatigueCurrent !== null && fatigueCurrent >= 4) {
    weight += 3;
  }

  // Wysoki dług maskowania (>=4 z 6) -> nieco częściej eventy
  // maskowania/zrzucania maski oznaczone tagiem "high-masking-debt".
  const maskingDebtCurrent =
    state && state.player && state.player.maskingDebt &&
    typeof state.player.maskingDebt.current === "number"
      ? state.player.maskingDebt.current
      : null;
  if (tags.includes("high-masking-debt") && maskingDebtCurrent !== null && maskingDebtCurrent >= 4) {
    weight += 3;
  }

  // v0.55: Narrative Consequence Memory. Pieciu DELIKATNYCH regul
  // (bonus +2, NIGDY forced spawn), po jednej na typ sladu. Zadna z
  // nich nie wymusza tego samego typu eventu w kolko: kazdy slad
  // wygasa po 3-7 dniach (patrz narrativeMemorySystem.js), a bonus
  // dziala tylko obok bazowej wagi = 1, nigdy jej nie zastepuje.
  const memoryTypes = getNarrativeMemoryWeightTags(state);

  if (memoryTypes.has("avoidance") && (tags.includes("avoidance") || tags.includes("tension"))) {
    weight += 2;
  }

  if (
    (memoryTypes.has("repair") || memoryTypes.has("honesty")) &&
    (tags.includes("repair") || allTags.includes("communication"))
  ) {
    weight += 2;
  }

  if (
    (memoryTypes.has("work") || memoryTypes.has("overextension")) &&
    (tags.includes("work-pressure") || tags.includes("obligation"))
  ) {
    weight += 2;
  }

  if (
    (memoryTypes.has("body") || memoryTypes.has("rest")) &&
    (tags.includes("low-spoons") || allTags.includes("body") || allTags.includes("recovery"))
  ) {
    weight += 2;
  }

  if (memoryTypes.has("metamour") && tags.includes("metamour-signal")) {
    weight += 2;
  }

  // v0.56: Relationship Model Consequence Pass. Piec DELIKATNYCH
  // bonusow (+2/+3, nigdy forced spawn, NIGDY ujemnych — zaden model
  // nie jest "gorszy", wiec zaden nie dostaje kary wagi). Monogamia
  // po prostu nie dostaje bonusu do metamour/boundaries — to
  // wystarczy, zeby byla WZGLEDNIE rzadsza bez blokowania jej.
  const modelFlags = getRelationshipModelWeightTags(state);

  if (
    modelFlags.has("low-clarity") &&
    (tags.includes("repair") || tags.includes("tension") || allTags.includes("communication") || allTags.includes("relationship"))
  ) {
    weight += 2;
  }

  if (
    modelFlags.has("poly-open") &&
    (tags.includes("metamour-signal") || allTags.includes("boundaries") || allTags.includes("metamour"))
  ) {
    weight += 2;
  }

  if (modelFlags.has("recent-friction") && (tags.includes("repair") || allTags.includes("communication"))) {
    weight += 3;
  }

  // v0.57: Daily Texture & Pacing Director. Jedna DELIKATNA regula
  // (+2, nigdy forced spawn) — kazdy event, ktorego weightTags/tags
  // przecina sie z teksturami dzisiejszego dnia, dostaje bonus. Zero
  // nowych tagow: getDayTextureWeightTags zwraca WYLACZNIE istniejace
  // wartosci (low-spoons/high-fatigue/obligation/work-pressure/...).
  const textureTags = getDayTextureWeightTags(state);
  if (textureTags.length > 0 && textureTags.some((t) => allTags.includes(t))) {
    weight += 2;
  }

  if (tags.includes("critical-event-approaching")) {
    const activeCriticalEvent = getCurrentCriticalEvent(state);
    if (activeCriticalEvent) {
      const daysLeft = getCriticalEventCountdown(state);
      if (typeof daysLeft === "number" && daysLeft >= 1 && daysLeft <= 14) {
        weight += 4;
      }
    }
  }

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
