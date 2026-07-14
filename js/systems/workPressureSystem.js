// workPressureSystem.js
//
// v0.29: Work / Life Pressure System.
//
// Praca, terminy i obowiązki wchodzą do relacji, zanim ktokolwiek
// zacznie rozmowę. To fundament, nie pełny system kariery: zero
// pieniędzy, awansów, zwolnień i osobnego ekranu. W v0.29 presja pracy
// pojawia się jako dailySignal, kilka eventów oraz workEffect działający
// wyłącznie na state.player.work.
//
// Work pressure NIE zmienia automatycznie trust, frustration, scars,
// repair, metamour, Static, Pattern Pressure ani dostępności kart.
// Liczby są tylko w stanie i devTools. UI dostaje krótkie zdania.

const MAX_HISTORY = 30;
const RECENT_WINDOW_DAYS = 7;

const DAILY_SIGNALS = [
  {
    type: "deadline",
    weightTag: "work-pressure",
    text:
      "W pracy coś ma dziś termin. Twoje ciało już o tym wie, nawet jeśli kalendarz jeszcze milczy."
  },
  {
    type: "after-hours",
    weightTag: "work-pressure",
    text:
      "Ktoś zakłada, że “to tylko pięć minut po pracy”. Pięć minut ma dziś duże zęby."
  },
  {
    type: "money-pressure",
    weightTag: "work-pressure",
    text:
      "Nie chodzi tylko o pracę. Chodzi o to, że rachunki też mają głos."
  },
  {
    type: "low-stability",
    weightTag: "work-pressure",
    text:
      "Stabilność zawodowa brzmi dziś bardziej jak życzenie niż fakt."
  },
  {
    type: "none",
    weightTag: null,
    text: null
  }
];

const REFLECTION_TEXTS = [
  "Praca nie była dziś tłem. Była trzecią osobą przy stole.",
  "Nie wszystko, co zabiera relacji miejsce, wygląda jak konflikt.",
  "Granica została postawiona albo przesunięta. Ciało zapamięta różnicę."
];

const WEEKLY_NOTES = [
  "W tym tygodniu praca częściej wchodziła w relację bocznymi drzwiami.",
  "Kilka decyzji nie dotyczyło pracy, dopóki okazało się, że jednak dotyczyły."
];

export function ensureWorkPressureState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.player.work) {
    state.player.work = {
      pressure: 0,
      stability: 60,
      burnout: 0,
      lastRolledDay: null,
      dailySignal: null,
      history: []
    };
  }

  const work = state.player.work;

  if (typeof work.pressure !== "number") {
    work.pressure = 0;
  }
  if (typeof work.stability !== "number") {
    work.stability = 60;
  }
  if (typeof work.burnout !== "number") {
    work.burnout = 0;
  }
  if (!Array.isArray(work.history)) {
    work.history = [];
  }

  work.pressure = clamp(work.pressure, 0, 100);
  work.stability = clamp(work.stability, 0, 100);
  work.burnout = clamp(work.burnout, 0, 100);

  return work;
}

export function rollDailyWorkSignal(state) {
  const work = ensureWorkPressureState(state);
  if (!work) {
    return null;
  }

  if (work.lastRolledDay === state.day) {
    return work.dailySignal;
  }

  work.lastRolledDay = state.day;

  const signal = pickDailySignal(work);
  work.dailySignal = signal.type === "none"
    ? null
    : {
        day: state.day,
        type: signal.type,
        text: signal.text,
        weightTag: signal.weightTag
      };

  work.history.push({
    day: state.day,
    type: signal.type,
    source: "daily-signal"
  });
  trimHistory(work);

  return work.dailySignal;
}

export function getWorkPressureContext(state) {
  const work = ensureWorkPressureState(state);
  if (!work) {
    return null;
  }

  return {
    pressure: work.pressure,
    stability: work.stability,
    burnout: work.burnout,
    dailySignal: work.dailySignal,
    hasSignal: Boolean(work.dailySignal && work.dailySignal.type)
  };
}

export function hasWorkSignal(state) {
  const work = ensureWorkPressureState(state);
  return Boolean(work && work.dailySignal && work.dailySignal.type);
}

export function buildMorningWorkLine(state) {
  const work = ensureWorkPressureState(state);
  if (!work || !work.dailySignal || !work.dailySignal.text) {
    return null;
  }

  return work.dailySignal.text;
}

export function applyWorkEffectFromChoice(state, event, choice) {
  const work = ensureWorkPressureState(state);
  if (!work || !choice || !choice.workEffect) {
    return { applied: false };
  }

  const pressureChange = Number(choice.workEffect.pressureChange) || 0;
  const stabilityChange = Number(choice.workEffect.stabilityChange) || 0;
  const burnoutChange = Number(choice.workEffect.burnoutChange) || 0;

  if (pressureChange === 0 && stabilityChange === 0 && burnoutChange === 0) {
    return { applied: false };
  }

  work.pressure = clamp(work.pressure + pressureChange, 0, 100);
  work.stability = clamp(work.stability + stabilityChange, 0, 100);
  work.burnout = clamp(work.burnout + burnoutChange, 0, 100);

  const entry = {
    day: state.day,
    source: "event",
    eventId: event ? event.id : null,
    pressureChange,
    stabilityChange,
    burnoutChange,
    pressureAfter: work.pressure,
    stabilityAfter: work.stability,
    burnoutAfter: work.burnout
  };

  work.history.push(entry);
  trimHistory(work);

  return {
    applied: true,
    pressureChange,
    stabilityChange,
    burnoutChange,
    pressureAfter: work.pressure,
    stabilityAfter: work.stability,
    burnoutAfter: work.burnout
  };
}

export function buildWorkReflection(state, workEffect) {
  if (!workEffect || !workEffect.applied) {
    return null;
  }

  return pickRandom(REFLECTION_TEXTS);
}

export function buildWeeklyWorkNote(state) {
  const work = ensureWorkPressureState(state);
  if (!work || !Array.isArray(work.history)) {
    return null;
  }

  const recent = work.history.filter((entry) => entry.day > state.day - RECENT_WINDOW_DAYS);
  const meaningful = recent.filter((entry) =>
    entry.source === "event" ||
    entry.type === "deadline" ||
    entry.type === "after-hours" ||
    entry.type === "money-pressure" ||
    entry.type === "low-stability"
  );

  if (meaningful.length === 0) {
    return null;
  }

  return pickRandom(WEEKLY_NOTES);
}

export function getWorkPressureDebugSummary(state) {
  const work = ensureWorkPressureState(state);
  if (!work) {
    return null;
  }

  return {
    pressure: work.pressure,
    stability: work.stability,
    burnout: work.burnout,
    dailySignal: work.dailySignal,
    recentHistory: work.history.slice(-7)
  };
}

export function setWorkPressureHigh(state) {
  const work = ensureWorkPressureState(state);
  if (!work) {
    return null;
  }

  work.pressure = 85;
  work.burnout = 70;
  work.dailySignal = {
    day: state.day,
    type: "deadline",
    text:
      "W pracy coś ma dziś termin. Twoje ciało już o tym wie, nawet jeśli kalendarz jeszcze milczy.",
    weightTag: "work-pressure"
  };
  work.lastRolledDay = state.day;

  work.history.push({
    day: state.day,
    type: "deadline",
    source: "debug"
  });
  trimHistory(work);

  return work;
}

export function clearWorkSignal(state) {
  const work = ensureWorkPressureState(state);
  if (!work) {
    return null;
  }

  work.dailySignal = null;
  return work;
}

function pickDailySignal(work) {
  const weighted = DAILY_SIGNALS.map((signal) => {
    let weight = signal.type === "none" ? 4 : 1;

    if ((signal.type === "deadline" || signal.type === "after-hours") && work.pressure >= 60) {
      weight += 3;
    }

    if (signal.type === "low-stability" && work.stability <= 35) {
      weight += 4;
    }

    if (signal.type === "after-hours" && work.burnout >= 60) {
      weight += 3;
    }

    if (signal.type === "money-pressure" && work.stability <= 45) {
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

function trimHistory(work) {
  if (work.history.length > MAX_HISTORY) {
    work.history = work.history.slice(work.history.length - MAX_HISTORY);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
