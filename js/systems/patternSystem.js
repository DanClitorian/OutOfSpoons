// patternSystem.js
//
// v0.22: Pattern Foundation / Narrative Echoes.
//
// Zamiast pamiętać pojedyncze decyzje, gra zaczyna rozpoznawać
// POWTARZALNE STYLE zachowania gracza: "wybór → tag → powtarzalny
// wzorzec → echo". To jest FUNDAMENT — na v0.22 wzorce NIE wpływają
// jeszcze na koszty wyborów (zero zmian w spoons/trust/frustration
// poza tym, co i tak już powodowała dana decyzja). Wpływ mechaniczny
// aktywnych wzorców zostaje na v0.23.
//
// Architektura:
//   1. Każda znacząca decyzja dostaje TAGI (heurystyka z konsekwencji +
//      proste dopasowanie słów kluczowych w tekście decyzji).
//   2. Tagi trafiają do state.patterns.history (max 30 wpisów, 14 dni).
//   3. evaluatePatterns() liczy, ile razy dany tag pojawił się w
//      ostatnich 5 dniach. Jeśli >= 3 razy — wzorzec się aktywuje albo
//      odnawia (state.patterns.active).
//   4. Wzorzec wygasa, jeśli nie zostanie odnowiony przez 7 dni.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w state.patterns.
// Ekrany (gameScreen.js, reflectionScreen.js, eveningScreen.js,
// weeklySummaryScreen.js) czytają/zapisują przez ten moduł.

const MAX_HISTORY = 30;
const HISTORY_LIFETIME_DAYS = 14;
const PATTERN_WINDOW_DAYS = 5;
const PATTERN_ACTIVATION_THRESHOLD = 3;
const PATTERN_EXPIRY_DAYS = 7;

// --------------------------------------------------------------------
// Pierwsze 6 wzorców
// --------------------------------------------------------------------

const PATTERN_DEFINITIONS = {
  avoidance: {
    title: "Unik",
    description: "Coraz częściej wybierasz ciszę zamiast trudnej rozmowy.",
    echoes: [
      "Znowu to robisz. Wybierasz ciszę, żeby nie mącić wody.",
      "Unik nie eksplodował. Jeszcze.",
      "To, czego dziś nie dotykasz, nie znika. Tylko zmienia pokój."
    ]
  },
  "people-pleasing": {
    title: "Zadowalanie",
    description: "Częściej chronisz komfort innych niż własne zasoby.",
    echoes: [
      "Znowu jesteś wygodny dla świata i niewygodny dla siebie.",
      "Miło z twojej strony. Ciało odnotowało koszt.",
      "Wszyscy dostali kawałek ciebie. Ty też byłeś na liście, ale później."
    ]
  },
  overextension: {
    title: "Przeciążanie się",
    description: "Dowozisz rzeczy, na które nie masz już zasobów.",
    echoes: [
      "Dało się. Oczywiście, że się dało. Pytanie brzmi: co zapłaciło rachunek?",
      "Z zewnątrz: ogarnięte. W środku: system awaryjny.",
      "Przetrwanie czasem wygląda dokładnie jak funkcjonowanie."
    ]
  },
  repair: {
    title: "Naprawianie",
    description: "Wracasz do napięć zamiast zostawiać je pod dywanem.",
    echoes: [
      "Coś zostało naprawione, ale jeszcze nie zrobiło się lekkie.",
      "Ten gest nie rozwiązał wszystkiego. Ale relacja go zapamiętała.",
      "Czasem naprawa wygląda jak mała rzecz zrobiona mimo zmęczenia."
    ]
  },
  rest: {
    title: "Regeneracja",
    description: "Zaczynasz traktować odpoczynek jak decyzję, nie porażkę.",
    echoes: [
      "Odpoczynek nie naprawił życia. Ale przynajmniej nie pogorszył go dzisiaj.",
      "Ciało odnotowało, że tym razem nie zostało całkiem zignorowane.",
      "Małe domknięcie dnia. Mała odmowa dalszego spalania się."
    ]
  },
  transparency: {
    title: "Transparentność",
    description: "Wybierasz szczerość nawet wtedy, kiedy kosztuje.",
    echoes: [
      "Szczerość nie zawsze uspokaja sytuację. Ale przynajmniej przestaje ją fałszować.",
      "Powiedziane na głos waży inaczej.",
      "Nie było wygodnie. Było prawdziwiej."
    ]
  }
};

// Mapowanie konkretnych opcji wieczornych (eveningRecoveryData.js) na
// tagi — dokładnie jak w specyfikacji ("evening option to sleep/rest/
// ritual → rest", "pretend-fine → avoidance", "short-message → repair/
// transparency"). mindless-scroll dopisane analogicznie (przewijanie,
// żeby nie myśleć, to też forma uniku).
const EVENING_OPTION_TAGS = {
  "sleep-early": ["rest"],
  "small-ritual": ["rest"],
  "pretend-fine": ["avoidance"],
  "short-message": ["repair", "transparency"],
  "mindless-scroll": ["avoidance"]
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.patterns istnieje. Bezpieczne dla starych
 * zapisów (sprzed v0.22). CELOWO nie state.player.activePatterns —
 * to dynamiczny stan rozgrywki, nie cecha kreatora postaci. Nie
 * zmienia saveVersion.
 */
export function ensurePatternState(state) {
  if (!state.patterns) {
    state.patterns = {
      history: [],
      active: [],
      lastMorningPatternDay: null,
      lastWeeklyPatternDay: null
    };
  }

  if (!Array.isArray(state.patterns.history)) {
    state.patterns.history = [];
  }

  if (!Array.isArray(state.patterns.active)) {
    state.patterns.active = [];
  }

  return state.patterns;
}

/**
 * Usuwa wpisy historii starsze niż 14 dni i przycina do MAX_HISTORY
 * (30). Usuwa też wygasłe aktywne wzorce (expiresDay < state.day).
 */
export function cleanupPatterns(state) {
  const patternState = ensurePatternState(state);

  patternState.history = patternState.history.filter((entry) => {
    return entry.day >= state.day - (HISTORY_LIFETIME_DAYS - 1);
  });

  if (patternState.history.length > MAX_HISTORY) {
    patternState.history = patternState.history.slice(patternState.history.length - MAX_HISTORY);
  }

  patternState.active = patternState.active.filter((pattern) => pattern.expiresDay >= state.day);

  return patternState;
}

/**
 * Zapisuje pojedynczy wpis historii. IDEMPOTENTNE: jeśli wpis o tym
 * samym `key` już istnieje, nic nie robi (zwraca null).
 */
export function recordPatternEntry(state, entry) {
  const patternState = ensurePatternState(state);

  if (!entry || !entry.key || !Array.isArray(entry.tags) || entry.tags.length === 0) {
    return null;
  }

  const alreadyExists = patternState.history.some((existing) => existing.key === entry.key);
  if (alreadyExists) {
    return null;
  }

  patternState.history.push(entry);
  cleanupPatterns(state);

  return entry;
}

// --------------------------------------------------------------------
// Wyprowadzanie tagów (heurystyka — celowo prosta, nie AI-logika)
// --------------------------------------------------------------------

function deriveTagsFromConsequences(consequences) {
  const tags = new Set();

  const trust = Number(consequences && consequences.trustChange) || 0;
  const frustration = Number(consequences && consequences.frustrationChange) || 0;
  const spoons = Number(consequences && consequences.spoonsChange) || 0;

  // trustChange <= -2 → rupture albo avoidance (śledzimy tylko avoidance —
  // "rupture" nie ma wśród pierwszych 6 wzorców definicji).
  if (trust <= -2) {
    tags.add("avoidance");
  }

  // trustChange >= 2 → repair albo connection/transparency
  if (trust >= 2) {
    tags.add("repair");
    tags.add("transparency");
  }

  // frustrationChange >= 2 → tension / avoidance
  if (frustration >= 2) {
    tags.add("avoidance");
  }

  // frustrationChange <= -2 → repair
  if (frustration <= -2) {
    tags.add("repair");
  }

  // spoonsChange <= -3 → overextension
  if (spoons <= -3) {
    tags.add("overextension");
  }

  // spoonsChange >= 2 → rest
  if (spoons >= 2) {
    tags.add("rest");
  }

  // "choice ma duży koszt spoons i poprawia trust → overextension +
  // people-pleasing" — klasyczny wzór "dowożę kosztem siebie".
  if (spoons <= -3 && trust >= 2) {
    tags.add("people-pleasing");
  }

  return tags;
}

function deriveTagsFromText(textSources) {
  const tags = new Set();
  const text = (textSources || [])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text) {
    return tags;
  }

  if (/szczer|powiedz|rozmow|rozmaw|wyja[sś]n/.test(text)) {
    tags.add("transparency");
  }

  if (/unik|od[lł]o[żz]|milcz|p[oó][zź]niej|nie teraz|prze[lł]o[zż]/.test(text)) {
    tags.add("avoidance");
  }

  if (/zg[oó]dz|pom[oó][zż]|[sś]wi[eę]tego spokoju/.test(text)) {
    tags.add("people-pleasing");
  }

  return tags;
}

/**
 * Łączy heurystykę konsekwencji z prostym dopasowaniem słów kluczowych
 * w tekście decyzji. Zwraca tablicę tagów (może być pusta).
 *
 * v0.24: EKSPORTOWANE (wcześniej prywatne) — patternPressureSystem.js
 * reużywa DOKŁADNIE tej samej heurystyki, żeby klasyfikacja "czy ten
 * wybór pasuje do aktywnego wzorca" nigdy nie rozjechała się z
 * klasyfikacją, która tworzy same wzorce.
 */
export function deriveTags(consequences, textSources) {
  const tags = new Set([
    ...deriveTagsFromConsequences(consequences),
    ...deriveTagsFromText(textSources)
  ]);

  return Array.from(tags);
}

function pickPatternEcho(patternId) {
  const definition = PATTERN_DEFINITIONS[patternId];
  if (!definition) {
    return "";
  }

  const pool = definition.echoes;
  return pool[Math.floor(Math.random() * pool.length)];
}

// --------------------------------------------------------------------
// Zapis wpisów z konkretnych źródeł
// --------------------------------------------------------------------

/**
 * Zapisuje wpis historii z dziennej decyzji i od razu przelicza
 * wzorce. Zwraca tablicę nowo aktywowanych/odnowionych wzorców w TYM
 * wywołaniu (patrz evaluatePatterns) — pusta tablica, jeśli nic się
 * nie zmieniło (albo konsekwencja nie dała żadnego tagu).
 *
 * @param {object} context - { day, eventId, choiceId, choiceLabel,
 *   choiceDescription, consequences }
 */
export function recordPatternFromChoice(state, context) {
  ensurePatternState(state);

  if (!context || !context.consequences) {
    return [];
  }

  const tags = deriveTags(context.consequences, [context.choiceLabel, context.choiceDescription]);
  if (tags.length === 0) {
    return [];
  }

  const key = `daily-event:${context.day}:${context.eventId}:${context.choiceId}`;
  const recorded = recordPatternEntry(state, {
    key,
    day: context.day,
    source: "daily-event",
    tags,
    consequences: { ...context.consequences }
  });

  if (!recorded) {
    return [];
  }

  return evaluatePatterns(state);
}

/**
 * Zapisuje wpis historii z wieczornego wyboru regeneracji. `recovery`
 * to obiekt zwrócony przez applyEveningRecovery() (albo równoważny
 * state.lastEveningRecovery): { optionId, label, description, effects,
 * day }.
 */
export function recordPatternFromEveningRecovery(state, recovery) {
  ensurePatternState(state);

  if (!recovery) {
    return [];
  }

  const optionId = recovery.optionId || recovery.id;
  const explicitTags = EVENING_OPTION_TAGS[optionId] || [];
  const effectTags = recovery.effects
    ? deriveTags(recovery.effects, [recovery.label, recovery.description])
    : [];

  const tags = Array.from(new Set([...explicitTags, ...effectTags]));
  if (tags.length === 0) {
    return [];
  }

  const key = `evening:${recovery.day}:${optionId}`;
  const recorded = recordPatternEntry(state, {
    key,
    day: recovery.day,
    source: "evening",
    tags,
    consequences: recovery.effects ? { ...recovery.effects } : {}
  });

  if (!recorded) {
    return [];
  }

  return evaluatePatterns(state);
}

/**
 * Zapisuje wpis historii z oceny Weekly Stake. Weekly Stake ma tylko
 * efekt spoons (reward/penalty), bez trust/frustration, więc
 * klasyfikacja jest prostsza niż w dziennych decyzjach: sukces =
 * "repair" (coś się poprawiło), porażka = "overextension" (poczułeś
 * koszt).
 */
export function recordPatternFromWeeklyResult(state, result) {
  ensurePatternState(state);

  if (!result) {
    return [];
  }

  const tags = [result.success ? "repair" : "overextension"];
  const identifier = result.dueDay || result.day || result.title || result.id;
  const key = `weekly-stake:${identifier}`;

  const recorded = recordPatternEntry(state, {
    key,
    day: state.day,
    source: "weekly-stake",
    tags,
    consequences: {}
  });

  if (!recorded) {
    return [];
  }

  return evaluatePatterns(state);
}

/**
 * Zapisuje wpis historii z oceny Wielkiego Testu. Wielki Test ma pełny
 * efekt {trustChange, frustrationChange, spoonsChange}, dokładnie jak
 * dzienna decyzja, więc reużywamy tej samej heurystyki konsekwencji.
 */
export function recordPatternFromCriticalResult(state, result) {
  ensurePatternState(state);

  if (!result) {
    return [];
  }

  let tags = result.effect ? deriveTags(result.effect, []) : [];
  if (tags.length === 0) {
    tags = [result.success ? "repair" : "avoidance"];
  }

  const identifier = result.dueDay || result.title || result.id;
  const key = `critical-event:${identifier}`;

  const recorded = recordPatternEntry(state, {
    key,
    day: state.day,
    source: "critical-event",
    tags,
    consequences: result.effect ? { ...result.effect } : {}
  });

  if (!recorded) {
    return [];
  }

  return evaluatePatterns(state);
}

// --------------------------------------------------------------------
// Ocena wzorców
// --------------------------------------------------------------------

/**
 * Przelicza aktywne wzorce na podstawie historii z ostatnich 5 dni
 * (włącznie z dzisiejszym). Wzorzec aktywuje się/odnawia, jeśli jego
 * tag pojawił się >= 3 razy w tym oknie:
 *   - jeśli wzorzec jeszcze nieaktywny: tworzy nowy wpis w `active`,
 *   - jeśli już aktywny: odświeża lastRenewedDay i expiresDay
 *     (state.day + 7), aktualizuje countInWindow/intensity — BEZ
 *     duplikowania wpisu.
 * Wzorce, których expiresDay minął, są usuwane z `active`.
 *
 * Zwraca tablicę { pattern, isNew, text } dla wzorców, które w TYM
 * wywołaniu zostały świeżo aktywowane albo odnowione (nie dla tych,
 * które po prostu nadal trwają bez zmiany) — do jednorazowych echo w
 * reflection. Bezpieczne przy wielokrotnym wywołaniu w tym samym dniu
 * (nie zgłasza ponownie tego samego odnowienia).
 */
export function evaluatePatterns(state) {
  const patternState = ensurePatternState(state);
  cleanupPatterns(state);

  const windowStart = state.day - (PATTERN_WINDOW_DAYS - 1);
  const tagCounts = {};

  patternState.history.forEach((entry) => {
    if (entry.day < windowStart) {
      return;
    }

    (entry.tags || []).forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const triggered = [];
  const nextExpiresDay = state.day + PATTERN_EXPIRY_DAYS;

  Object.keys(PATTERN_DEFINITIONS).forEach((patternId) => {
    const count = tagCounts[patternId] || 0;

    if (count < PATTERN_ACTIVATION_THRESHOLD) {
      return;
    }

    const definition = PATTERN_DEFINITIONS[patternId];
    const intensity = Math.min(3, Math.floor(count / PATTERN_ACTIVATION_THRESHOLD));
    const existing = patternState.active.find((pattern) => pattern.id === patternId);

    if (existing) {
      const alreadyRenewedToday = existing.expiresDay === nextExpiresDay;
      existing.lastRenewedDay = state.day;
      existing.expiresDay = nextExpiresDay;
      existing.countInWindow = count;
      existing.intensity = intensity;

      if (!alreadyRenewedToday) {
        triggered.push({ pattern: existing, isNew: false, text: pickPatternEcho(patternId) });
      }
    } else {
      const newPattern = {
        id: patternId,
        title: definition.title,
        description: definition.description,
        activatedDay: state.day,
        lastRenewedDay: state.day,
        intensity,
        countInWindow: count,
        expiresDay: nextExpiresDay
      };

      patternState.active.push(newPattern);
      triggered.push({ pattern: newPattern, isNew: true, text: pickPatternEcho(patternId) });
    }
  });

  patternState.active = patternState.active.filter((pattern) => pattern.expiresDay >= state.day);

  return triggered;
}

// --------------------------------------------------------------------
// Odczyt / prezentacja
// --------------------------------------------------------------------

/**
 * Zwraca aktualnie aktywne wzorce (tablica, może być pusta).
 */
export function getActivePatterns(state) {
  const patternState = ensurePatternState(state);
  return patternState.active;
}

/**
 * Zwraca JEDNO echo do pokazania na poranku — najpóźniej odnowiony
 * aktywny wzorzec, z losowym tekstem z jego puli. Zwraca null, jeśli
 * nie ma żadnego aktywnego wzorca. Aktualizuje lastMorningPatternDay.
 */
export function getLatestPatternEcho(state) {
  const patternState = ensurePatternState(state);
  cleanupPatterns(state);

  if (patternState.active.length === 0) {
    return null;
  }

  const latest = [...patternState.active].sort((a, b) => b.lastRenewedDay - a.lastRenewedDay)[0];
  patternState.lastMorningPatternDay = state.day;

  return { pattern: latest, text: pickPatternEcho(latest.id) };
}

/**
 * Zwraca do `limit` (domyślnie 3) aktualnie aktywnych wzorców,
 * najpóźniej odnowione pierwsze — do bloku "Co zaczyna być wzorem" w
 * weekly summary. Aktualizuje lastWeeklyPatternDay.
 */
export function getWeeklyPatternEchoes(state, limit) {
  const patternState = ensurePatternState(state);
  cleanupPatterns(state);

  const max = typeof limit === "number" ? limit : 3;
  patternState.lastWeeklyPatternDay = state.day;

  return [...patternState.active]
    .sort((a, b) => b.lastRenewedDay - a.lastRenewedDay)
    .slice(0, max);
}
