// dayTextureSystem.js
//
// v0.57: Daily Texture & Pacing Director.
//
// Reżyseria istniejących systemów, nie nowy event system. Raz dziennie
// wybiera miękką "teksturę dnia" (weighted random, nie if/else) na
// bazie tego, co JUŻ dzieje się w stanie gry (fatigue, spoons, praca,
// relacja, metamour, blizny, pamięć narracyjna, model relacji, Wielki
// Test, Stawka Tygodnia). Tekstura:
//   - lekko waży losowanie eventów (+2/+3, NIGDY forced spawn),
//   - dodaje jedno zdanie do istniejącej linii "Stawka dnia" na
//     poranku (zero nowej karteczki),
//   - daje jedno zdanie w weekly summary.
//
// Rozwiązywana LENIWIE (ten sam wzorzec co dailyStakesSystem#
// calculateDailyStakes): resolveDayTextureForToday jest idempotentne
// per state.day — wołane z dayAgendaSystem.js#ensureDailyAgenda, ZANIM
// jakikolwiek event zostanie wylosowany na dany dzień, więc ważenie
// zawsze widzi teksturę TEGO dnia. Dzięki temu dzień 1 też dostaje
// teksturę (nie trzeba czekać na advanceToNextDay) i nie ma ryzyka
// odczytu nieustawionego stanu (maskingDebt jest już ensure'owany
// przez pierwszy render poranka, zanim gracz w ogóle otworzy agendę).

import { getCurrentWeeklyChallenge, getWeeklyChallengeCountdown } from "./weeklyChallengeSystem.js?v=601";
import { getCurrentCriticalEvent, getCriticalEventCountdown } from "./criticalEventSystem.js?v=601";
import { getWorkPressureContext } from "./workPressureSystem.js?v=300";
import { getMetamourContext } from "./metamourSystem.js?v=300";
import { hasRepairableScars } from "./relationshipRepairSystem.js?v=300";
import { getActiveNarrativeMemories } from "./narrativeMemorySystem.js?v=560";
import { getRelationshipModelWeightTags } from "./relationshipModelConsequenceSystem.js?v=560";

const MAX_HISTORY = 7;
const PRESSURE_SPIKE_ID = "pressure_spike";
const PRESSURE_SPIKE_COOLDOWN_DAYS = 4;

// --------------------------------------------------------------------
// Definicje tekstur. weightTags to WYŁĄCZNIE tagi, które już istnieją
// w eventData.js/eventWeightSystem.js — żadnych nowych wymyślonych.
// --------------------------------------------------------------------

const TEXTURES = [
  {
    id: "body_tax",
    title: "Ciało prowadzi księgowość",
    tone: "body",
    weightTags: ["low-spoons", "high-fatigue", "body", "recovery"],
    line: "Ciało dziś prowadzi własną księgowość — kalendarz może się z nią nie zgadzać.",
    bonus: (ctx) => {
      let w = 0;
      if (ctx.fatigue >= 3) w += 4;
      if (ctx.spoons <= 3) w += 2;
      if (ctx.maskingDebt >= 4) w += 1;
      return w;
    }
  },
  {
    id: "admin_swarm",
    title: "Administracja życia",
    tone: "admin",
    weightTags: ["obligation", "admin", "work-pressure", "critical-event-approaching"],
    line: "Administracja życia dziś udaje, że wszystko jest pilne naraz.",
    bonus: (ctx) => {
      let w = 0;
      if (ctx.workContext && ctx.workContext.pressure >= 55) w += 2;
      if (ctx.criticalDaysLeft !== null && ctx.criticalDaysLeft <= 14) w += 2;
      return w;
    }
  },
  {
    id: "relationship_weather",
    title: "Pogoda w relacji",
    tone: "relational",
    weightTags: ["relationship", "communication", "tension", "relationship-tension", "repair"],
    line: "W relacji dziś zmienia się pogoda — nic dramatycznego, tylko inne ciśnienie.",
    bonus: (ctx) => {
      let w = 0;
      if (ctx.trust !== null && ctx.trust <= 35) w += 4;
      if (ctx.frustration !== null && ctx.frustration >= 60) w += 4;
      if (ctx.modelFlags.has("low-clarity")) w += 2;
      if (ctx.memoryTypes.has("conflict") || ctx.memoryTypes.has("connection")) w += 1;
      return w;
    }
  },
  {
    id: "work_squeeze",
    title: "Praca zabiera powietrze",
    tone: "work",
    weightTags: ["work-pressure", "obligation", "burnout"],
    line: "Praca dziś zabiera więcej powietrza, niż formalnie powinna.",
    bonus: (ctx) => {
      let w = 0;
      if (ctx.workContext && ctx.workContext.pressure >= 60) w += 4;
      if (ctx.workContext && ctx.workContext.burnout >= 55) w += 3;
      return w;
    }
  },
  {
    id: "network_weather",
    title: "Sieć relacji jest obecna",
    tone: "network",
    weightTags: ["metamour-signal", "metamour", "boundaries", "communication"],
    line: "Sieć relacji jest dziś bardziej obecna niż zwykle w tle rozmów.",
    bonus: (ctx) => {
      let w = 0;
      if (ctx.metamourContext && ctx.metamourContext.tension >= 50) w += 4;
      if (ctx.modelFlags.has("poly-open")) w += 1;
      return w;
    }
  },
  {
    id: "repair_window",
    title: "Jest miejsce na naprawę",
    tone: "repair",
    weightTags: ["repair", "communication", "relationship-scar", "repair-opportunity"],
    line: "Dziś jest odrobinę więcej miejsca na naprawę niż zwykle — nie trzeba z niego korzystać.",
    bonus: (ctx) => {
      // Baza celowo bardzo niska — to jedyna tekstura, która NIE ma
      // sensu bez konkretnego powodu (brief: "nie powinno pojawiać
      // się bez sensu, kiedy nie ma czego naprawiać").
      let w = 0;
      if (ctx.hasScars) w += 4;
      if (ctx.memoryTypes.has("repair") || ctx.memoryTypes.has("honesty")) w += 3;
      if (ctx.trust !== null && ctx.trust >= 45 && ctx.frustration !== null && ctx.frustration >= 35) w += 1;
      return w;
    },
    hasBaseline: false
  },
  {
    id: "quiet_pressure",
    title: "Cichy nacisk",
    tone: "inner",
    weightTags: ["avoidance", "inner", "masking", "tension"],
    line: "Coś dziś naciska po cichu — nic konkretnego, tylko stały, niski ton.",
    bonus: (ctx) => {
      let w = 0;
      if (ctx.memoryTypes.has("avoidance")) w += 3;
      if (ctx.maskingDebt >= 3) w += 2;
      if (ctx.modelFlags.has("low-clarity")) w += 2;
      return w;
    }
  },
  {
    id: "recovery_window",
    title: "Okno na oddech",
    tone: "recovery",
    weightTags: ["recovery", "body", "low-spoons"],
    line: "Dziś jest okno na oddech — nie ulga, tylko szansa, żeby się bardziej nie dobić.",
    bonus: (ctx) => {
      let w = 0;
      if (ctx.fatigue >= 4) w += 3;
      if (ctx.spoons <= 2) w += 4;
      if (ctx.yesterdayId === PRESSURE_SPIKE_ID) w += 2;
      if (ctx.yesterdayHadHighFatigue) w += 2;
      return w;
    }
  },
  {
    id: "strange_day",
    title: "Dzień robi dziwne miny",
    tone: "chaos",
    weightTags: ["chaos", "social", "inner", "obligation"],
    line: "Coś w tym dniu jest lekko przekrzywione — nic złego, tylko dziwne.",
    bonus: () => 0,
    // Rzadki, humorystyczny wyłom w monotonii — mała, stała szansa,
    // niezależna od stanu (patrz baseWeightOverride).
    baseWeightOverride: 1.5
  },
  {
    id: PRESSURE_SPIKE_ID,
    title: "Nacisk rośnie",
    tone: "tension",
    weightTags: ["tension", "work-pressure", "relationship-tension", "critical-event-approaching"],
    line: "Nacisk dziś realnie rośnie — to nie wyobraźnia i nie przypadek.",
    bonus: (ctx) => {
      // Baza 0: pressure_spike MUSI mieć konkretny powód, nigdy nie
      // pojawia się "просто tak" (brief: "tylko kiedy naprawdę jest
      // powód").
      let w = 0;
      if (ctx.criticalDaysLeft !== null && ctx.criticalDaysLeft <= 3) w += 5;
      if (ctx.conflictState === "critical" || ctx.conflictState === "fight") w += 5;
      if (ctx.fatigue >= 5) w += 3;
      if (ctx.spoons <= 1) w += 3;
      if (ctx.weeklyDaysLeft !== null && ctx.weeklyDaysLeft <= 1) w += 2;
      return w;
    },
    hasBaseline: false
  }
];

const TEXTURES_BY_ID = new Map(TEXTURES.map((t) => [t.id, t]));

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

export function ensureDayTextureState(state) {
  if (!state) return null;

  if (!state.dayTexture || typeof state.dayTexture !== "object") {
    state.dayTexture = { current: null, history: [] };
  }

  if (!Array.isArray(state.dayTexture.history)) {
    state.dayTexture.history = [];
  }

  return state.dayTexture;
}

/**
 * Rozwiązuje teksturę dla state.day — IDEMPOTENTNE: jeśli
 * current.day === state.day, nic nie robi. Bezpieczne do wołania
 * wielokrotnie w ciągu dnia (agenda, weighting, weekly summary).
 */
export function resolveDayTextureForToday(state) {
  const texture = ensureDayTextureState(state);
  if (!texture) return null;

  const day = typeof state.day === "number" ? state.day : 0;
  if (texture.current && texture.current.day === day) {
    return texture.current;
  }

  const ctx = buildContext(state, texture);
  const chosen = pickWeightedTexture(ctx);
  const def = TEXTURES_BY_ID.get(chosen);

  const current = {
    day,
    id: def.id,
    title: def.title,
    tone: def.tone,
    intensity: computeIntensity(def, ctx),
    line: def.line,
    weightTags: def.weightTags,
    createdFrom: ctx.reasons
  };

  texture.current = current;
  texture.history.push({ day, id: def.id, intensity: current.intensity });
  if (texture.history.length > MAX_HISTORY) {
    texture.history = texture.history.slice(texture.history.length - MAX_HISTORY);
  }

  return current;
}

/**
 * Odczyt "na dziś" — samowystarczalny (rozwiązuje teksturę, jeśli
 * jeszcze nie istnieje dla state.day), więc bezpieczny do wołania z
 * dowolnego miejsca bez pilnowania kolejności wywołań.
 */
export function getCurrentDayTexture(state) {
  return resolveDayTextureForToday(state);
}

// --------------------------------------------------------------------
// Kontekst do ważenia — jeden odczyt stanu, używany i przez wybór
// tekstury, i przez jej bonusy.
// --------------------------------------------------------------------

function buildContext(state, textureState) {
  const fatigue = state.resources && state.resources.fatigue && typeof state.resources.fatigue.current === "number"
    ? state.resources.fatigue.current
    : 0;
  const spoons = state.resources && state.resources.spoons && typeof state.resources.spoons.current === "number"
    ? state.resources.spoons.current
    : 10;
  const maskingDebt = state.player && state.player.maskingDebt && typeof state.player.maskingDebt.current === "number"
    ? state.player.maskingDebt.current
    : 0;
  const npc = state.partner && state.npcs ? state.npcs[state.partner.id] || null : null;
  const trust = npc && typeof npc.trust === "number" ? npc.trust : null;
  const frustration = npc && typeof npc.frustration === "number" ? npc.frustration : null;
  const conflictState = state.partner && state.partner.conflict ? state.partner.conflict.state : "calm";

  const weeklyChallenge = getCurrentWeeklyChallenge(state);
  const weeklyDaysLeft = weeklyChallenge ? getWeeklyChallengeCountdown(state) : null;
  const criticalEvent = getCurrentCriticalEvent(state);
  const criticalDaysLeft = criticalEvent ? getCriticalEventCountdown(state) : null;
  const workContext = getWorkPressureContext(state);
  const metamourContext = getMetamourContext(state);
  const hasScars = hasRepairableScars(state);
  const memoryTypes = new Set(getActiveNarrativeMemories(state).map((m) => m.type));
  const modelFlags = getRelationshipModelWeightTags(state);

  const history = Array.isArray(textureState.history) ? textureState.history : [];
  const yesterday = history.length > 0 ? history[history.length - 1] : null;
  const yesterdayId = yesterday ? yesterday.id : null;
  const yesterdayHadHighFatigue = yesterday ? yesterday.intensity >= 3 : false;

  const recentPressureSpikeDays = history
    .filter((h) => h.id === PRESSURE_SPIKE_ID)
    .map((h) => h.day);
  const lastPressureSpikeDay = recentPressureSpikeDays.length > 0
    ? Math.max(...recentPressureSpikeDays)
    : null;
  const day = typeof state.day === "number" ? state.day : 0;
  const pressureSpikeOnCooldown = lastPressureSpikeDay !== null && (day - lastPressureSpikeDay) < PRESSURE_SPIKE_COOLDOWN_DAYS;

  const reasons = [];
  if (fatigue >= 4) reasons.push("high-fatigue");
  if (spoons <= 2) reasons.push("low-spoons");
  if (workContext && workContext.pressure >= 60) reasons.push("work-pressure");
  if (metamourContext && metamourContext.tension >= 50) reasons.push("metamour-tension");
  if (hasScars) reasons.push("repairable-scar");
  if (criticalDaysLeft !== null && criticalDaysLeft <= 3) reasons.push("critical-event-close");
  if (conflictState === "critical" || conflictState === "fight") reasons.push("conflict-critical");

  return {
    fatigue, spoons, maskingDebt, trust, frustration, conflictState,
    weeklyDaysLeft, criticalDaysLeft, workContext, metamourContext,
    hasScars, memoryTypes, modelFlags,
    yesterdayId, yesterdayHadHighFatigue,
    pressureSpikeOnCooldown, criticalIsUrgent: criticalDaysLeft !== null && criticalDaysLeft <= 3,
    reasons
  };
}

// --------------------------------------------------------------------
// Wybór — weighted random, z pacingiem jako modyfikatorem wagi (NIGDY
// twardym wykluczeniem — brief: "nie blokuj całkowicie żadnej
// tekstury").
// --------------------------------------------------------------------

function pickWeightedTexture(ctx) {
  const weighted = TEXTURES.map((def) => {
    const base = typeof def.baseWeightOverride === "number"
      ? def.baseWeightOverride
      : def.hasBaseline === false ? 0 : 3;
    let weight = base + def.bonus(ctx);

    // Pacing: ta sama tekstura dzień po dniu — mocno stłumiona, ale
    // nigdy do zera, chyba że to pressure_spike z silnym powodem
    // (wtedy pacing celowo NIE działa — kryzys może trwać 2 dni).
    if (def.id === ctx.yesterdayId && !(def.id === PRESSURE_SPIKE_ID && ctx.criticalIsUrgent)) {
      weight = Math.max(0.3, weight * 0.15);
    }

    // pressure_spike: cooldown 4 dni, chyba że powód jest naprawdę
    // pilny (Wielki Test <=3 dni albo konflikt critical/fight).
    if (def.id === PRESSURE_SPIKE_ID && ctx.pressureSpikeOnCooldown && !ctx.criticalIsUrgent && ctx.conflictState !== "critical" && ctx.conflictState !== "fight") {
      weight = Math.min(weight, 0.3);
    }

    return { id: def.id, weight: Math.max(0.05, weight) };
  });

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.id;
  }
  return weighted[weighted.length - 1].id;
}

function computeIntensity(def, ctx) {
  const rawBonus = def.bonus(ctx);
  if (rawBonus >= 6) return 3;
  if (rawBonus >= 3) return 2;
  return 1;
}

// --------------------------------------------------------------------
// Ważenie eventów — lekki odczyt, bez importu ciężkich systemów
// (dayTexture sam już zebrał sygnały; eventWeightSystem dostaje
// gotowy zestaw weightTags do porównania z tagami eventu).
// --------------------------------------------------------------------

export function getDayTextureWeightTags(state) {
  const current = getCurrentDayTexture(state);
  if (!current || !Array.isArray(current.weightTags)) return [];
  return current.weightTags;
}

// --------------------------------------------------------------------
// Poranek — WYŁĄCZNIE jako dopisek do istniejącej linii Stawki Dnia,
// zero nowej karteczki.
// --------------------------------------------------------------------

export function buildDayTextureFrameLine(state) {
  const current = getCurrentDayTexture(state);
  if (!current || !current.line) return null;
  return current.line;
}

// --------------------------------------------------------------------
// Weekly summary — maks. jedno-dwa zdania, budowane z
// state.dayTexture.history (bez osobnego summary state).
// --------------------------------------------------------------------

const WEEKLY_PHRASES = {
  body_tax: "ciała",
  admin_swarm: "administracji życia",
  relationship_weather: "pogody w relacji",
  work_squeeze: "pracy",
  network_weather: "sieci relacji",
  repair_window: "prób naprawy",
  quiet_pressure: "cichego nacisku",
  recovery_window: "odzyskiwania oddechu",
  strange_day: "dni, które robiły dziwne miny",
  pressure_spike: "rosnącego nacisku"
};

export function buildWeeklyTextureSummary(state) {
  const texture = ensureDayTextureState(state);
  if (!texture || texture.history.length === 0) return null;

  const window = texture.history.slice(-7);
  const counts = {};
  for (const h of window) {
    counts[h.id] = (counts[h.id] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;

  const [topId, topCount] = ranked[0];
  const uniqueCount = ranked.length;

  // Tydzień wyraźnie zdominowany przez 1-2 tekstury.
  if (topCount >= 3 || (uniqueCount <= 2 && window.length >= 3)) {
    const second = ranked.length > 1 ? ranked[1][0] : null;
    const topPhrase = WEEKLY_PHRASES[topId] || "jednego, powracającego napięcia";
    if (second && ranked[1][1] >= 2) {
      const secondPhrase = WEEKLY_PHRASES[second] || "";
      return `Ten tydzień najczęściej wracał do ${topPhrase} i ${secondPhrase}. Nie wszystko mieściło się w jednym worku.`;
    }
    return `Ten tydzień najczęściej wracał do ${topPhrase}.`;
  }

  // Tydzień różnorodny — żadna tekstura nie zdominowała.
  if (uniqueCount >= 4) {
    return "Dni nie układały się w jeden wzór. Bardziej w serię różnych, cichych napięć.";
  }

  return "Ten tydzień nie miał jednego centrum ciężkości — napięcie przemieszczało się z miejsca na miejsce.";
}

// --------------------------------------------------------------------
// DevTools (wołane wyłącznie z js/dev/devTools.js)
// --------------------------------------------------------------------

export function getDayTextureDebugSummary(state) {
  const texture = ensureDayTextureState(state);
  if (!texture) return null;
  return {
    current: texture.current,
    history: texture.history.slice(-7)
  };
}

export function forceDayTexture(state, id) {
  const texture = ensureDayTextureState(state);
  if (!texture) return null;
  const def = TEXTURES_BY_ID.get(id);
  if (!def) return null;

  const day = typeof state.day === "number" ? state.day : 0;
  const current = {
    day,
    id: def.id,
    title: def.title,
    tone: def.tone,
    intensity: 2,
    line: def.line,
    weightTags: def.weightTags,
    createdFrom: ["dev-tools"]
  };
  texture.current = current;
  texture.history = texture.history.filter((h) => h.day !== day);
  texture.history.push({ day, id: def.id, intensity: current.intensity });
  if (texture.history.length > MAX_HISTORY) {
    texture.history = texture.history.slice(texture.history.length - MAX_HISTORY);
  }
  return current;
}

export function clearDayTextureHistory(state) {
  const texture = ensureDayTextureState(state);
  if (!texture) return null;
  texture.history = [];
  return texture;
}
