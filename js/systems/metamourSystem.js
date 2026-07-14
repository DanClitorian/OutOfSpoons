// metamourSystem.js
//
// v0.28: Metamour / Sieć relacji.
//
// Fundament sieci relacji. Metamour nie jest partnerem gracza, nie
// trafia do state.npcs jako zwykły partner, nie ma osobnego ekranu i
// nie dostaje pasków w UI. To neutralny element świata: ktoś ważny w
// życiu partnera, którego obecność może pojawić się w narracji i kilku
// specjalnych eventach.
//
// v0.28 nie zmienia automatycznie spoons/trust/frustration, Static,
// blizn, naprawy, Pattern Pressure ani dostępności kart. Jedyny efekt
// mechaniczny z eventów metamour dotyczy state.partner.metamour:
// familiarity/tension. Liczby są tylko w stanie i devTools, nigdy w UI.

const MAX_HISTORY = 30;
const RECENT_WINDOW_DAYS = 7;

const METAMOUR_NAMES = ["Maja", "Nika", "Olek", "Mirek", "Sara", "Iwo", "Lena", "Tymek"];

const ROLE_LABELS = [
  "metamour",
  "osoba partnerska twojego partnera",
  "ktoś ważny w życiu twojego partnera"
];

const PRONOUNS = ["ona/jej", "on/jego", "ono/jej/jego"];

const DAILY_SIGNALS = [
  {
    type: "metamour-plan",
    weightTag: "metamour-signal",
    text:
      "{partnerName} ma dziś plan z {metamourName}. Niby normalne. Ciało i tak robi mały audyt zagrożeń."
  },
  {
    type: "metamour-mentioned",
    weightTag: "metamour-signal",
    text:
      "W rozmowie pojawia się {metamourName}. Samo imię. A jednak robi się trochę ciaśniej."
  },
  {
    type: "metamour-neutral",
    weightTag: "metamour-background",
    text:
      "Sieć relacji istnieje dziś w tle. Nie domaga się niczego. To też informacja."
  },
  {
    type: "metamour-boundary",
    weightTag: "metamour-signal",
    text:
      "Dzisiaj wraca temat granic, czasu i tego, kto o czym wie."
  },
  {
    type: "none",
    weightTag: null,
    text: null
  }
];

const REFLECTION_TEXTS = [
  "Sieć relacji nie zrobiła się prostsza. Ale ma dziś trochę wyraźniejsze kontury.",
  "To nie była rozmowa o rywalizacji. Twoje ciało jeszcze nie dostało tej notatki.",
  "Jedno imię przestało być tylko alarmem. Jeszcze nie stało się neutralne."
];

const WEEKLY_NOTES = [
  "W tym tygodniu relacja częściej przypominała sieć niż linię między dwiema osobami.",
  "Ktoś spoza waszej dwójki częściej pojawiał się na brzegu rozmów."
];

export function ensureMetamourState(state) {
  if (!state || !state.partner) {
    return null;
  }

  if (!state.partner.metamour) {
    state.partner.metamour = generateMetamour(state);
  }

  const metamour = state.partner.metamour;

  if (!Array.isArray(metamour.history)) {
    metamour.history = [];
  }

  if (typeof metamour.closeness !== "number") {
    metamour.closeness = randomInt(45, 80);
  }

  if (typeof metamour.tension !== "number") {
    metamour.tension = randomInt(15, 45);
  }

  if (typeof metamour.familiarity !== "number") {
    metamour.familiarity = randomInt(0, 35);
  }

  return metamour;
}

export function generateMetamour(state) {
  const name = pickRandom(METAMOUR_NAMES);
  const roleLabel = pickRandom(ROLE_LABELS);
  const pronouns = pickRandom(PRONOUNS);

  return {
    id: `metamour-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`,
    name,
    pronouns,
    roleLabel,
    closeness: randomInt(45, 80),
    tension: randomInt(15, 45),
    familiarity: randomInt(0, 35),
    lastRolledDay: null,
    dailySignal: null,
    history: []
  };
}

export function rollDailyMetamourSignal(state) {
  const metamour = ensureMetamourState(state);
  if (!metamour) {
    return null;
  }

  if (metamour.lastRolledDay === state.day) {
    return metamour.dailySignal;
  }

  metamour.lastRolledDay = state.day;

  const signal = pickDailySignal(metamour);
  metamour.dailySignal = signal.type === "none"
    ? null
    : {
        day: state.day,
        type: signal.type,
        text: formatWithMetamourPlaceholders(signal.text, state),
        weightTag: signal.weightTag
      };

  metamour.history.push({
    day: state.day,
    type: signal.type,
    source: "daily-signal"
  });

  trimHistory(metamour);
  return metamour.dailySignal;
}

export function getMetamourContext(state) {
  const metamour = ensureMetamourState(state);
  if (!metamour) {
    return null;
  }

  return {
    id: metamour.id,
    name: metamour.name,
    pronouns: metamour.pronouns,
    roleLabel: metamour.roleLabel,
    closeness: metamour.closeness,
    tension: metamour.tension,
    familiarity: metamour.familiarity,
    dailySignal: metamour.dailySignal,
    hasSignal: Boolean(metamour.dailySignal && metamour.dailySignal.type)
  };
}

export function hasMetamourSignal(state) {
  const metamour = ensureMetamourState(state);
  return Boolean(metamour && metamour.dailySignal && metamour.dailySignal.type);
}

export function buildMorningMetamourLine(state) {
  const metamour = ensureMetamourState(state);
  if (!metamour || !metamour.dailySignal || !metamour.dailySignal.text) {
    return null;
  }

  return metamour.dailySignal.text;
}

export function applyMetamourEffectFromChoice(state, event, choice) {
  const metamour = ensureMetamourState(state);
  if (!metamour || !choice || !choice.metamourEffect) {
    return { applied: false };
  }

  const familiarityChange = Number(choice.metamourEffect.familiarityChange) || 0;
  const tensionChange = Number(choice.metamourEffect.tensionChange) || 0;

  if (familiarityChange === 0 && tensionChange === 0) {
    return { applied: false };
  }

  metamour.familiarity = clamp(metamour.familiarity + familiarityChange, 0, 100);
  metamour.tension = clamp(metamour.tension + tensionChange, 0, 100);

  const entry = {
    day: state.day,
    source: "event",
    eventId: event ? event.id : null,
    familiarityChange,
    tensionChange,
    familiarityAfter: metamour.familiarity,
    tensionAfter: metamour.tension
  };

  metamour.history.push(entry);
  trimHistory(metamour);

  return {
    applied: true,
    familiarityChange,
    tensionChange,
    familiarityAfter: metamour.familiarity,
    tensionAfter: metamour.tension
  };
}

export function buildMetamourReflection(state, metamourEffect) {
  if (!metamourEffect || !metamourEffect.applied) {
    return null;
  }

  return pickRandom(REFLECTION_TEXTS);
}

export function buildWeeklyMetamourNote(state) {
  const metamour = ensureMetamourState(state);
  if (!metamour || !Array.isArray(metamour.history)) {
    return null;
  }

  const recent = metamour.history.filter((entry) => entry.day > state.day - RECENT_WINDOW_DAYS);
  const meaningful = recent.filter((entry) =>
    entry.type === "metamour-plan" ||
    entry.type === "metamour-mentioned" ||
    entry.type === "metamour-boundary" ||
    entry.source === "event"
  );

  if (meaningful.length === 0) {
    return null;
  }

  return pickRandom(WEEKLY_NOTES);
}

export function getMetamourDebugSummary(state) {
  const metamour = ensureMetamourState(state);
  if (!metamour) {
    return null;
  }

  return {
    name: metamour.name,
    roleLabel: metamour.roleLabel,
    pronouns: metamour.pronouns,
    closeness: metamour.closeness,
    tension: metamour.tension,
    familiarity: metamour.familiarity,
    dailySignal: metamour.dailySignal,
    recentHistory: metamour.history.slice(-7)
  };
}

export function setMetamourTensionHigh(state) {
  const metamour = ensureMetamourState(state);
  if (!metamour) {
    return null;
  }

  metamour.tension = 85;
  metamour.lastRolledDay = state.day;
  metamour.dailySignal = {
    day: state.day,
    type: "metamour-boundary",
    text: formatWithMetamourPlaceholders("Dzisiaj wraca temat granic, czasu i tego, kto o czym wie.", state),
    weightTag: "metamour-signal"
  };

  metamour.history.push({
    day: state.day,
    type: "metamour-boundary",
    source: "debug"
  });

  trimHistory(metamour);
  return metamour;
}

export function clearMetamourSignal(state) {
  const metamour = ensureMetamourState(state);
  if (!metamour) {
    return null;
  }

  metamour.dailySignal = null;
  return metamour;
}

export function formatWithMetamourPlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state && state.partner ? state.partner.name : "partner";
  const metamour = ensureMetamourState(state);
  const metamourName = metamour ? metamour.name : "ta osoba";

  return String(text)
    .replace(/\{partnerName\}/g, partnerName)
    .replace(/\{metamourName\}/g, metamourName);
}

function pickDailySignal(metamour) {
  const weighted = DAILY_SIGNALS.map((signal) => {
    let weight = 1;

    if (signal.type === "none") {
      weight = 3;
    }

    if (signal.type === "metamour-boundary" && metamour.tension >= 55) {
      weight += 3;
    }

    if (signal.type === "metamour-mentioned" && metamour.familiarity <= 25) {
      weight += 2;
    }

    if (signal.type === "metamour-plan" && metamour.closeness >= 60) {
      weight += 2;
    }

    if (signal.type === "metamour-neutral" && metamour.tension <= 30) {
      weight += 2;
    }

    return { signal, weight };
  });

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.signal;
    }
  }

  return DAILY_SIGNALS[DAILY_SIGNALS.length - 1];
}

function trimHistory(metamour) {
  if (metamour.history.length > MAX_HISTORY) {
    metamour.history = metamour.history.slice(metamour.history.length - MAX_HISTORY);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
