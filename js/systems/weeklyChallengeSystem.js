// weeklyChallengeSystem.js
//
// v0.19: Weekly Stakes / Stawka Tygodnia.
//
// Lekka mechanika tygodniowej presji zbudowana na istniejących spoons —
// CELOWO bez osobnego zasobu "fatigue" (ten system był wcześniej
// odrzucony na rzecz persistent spoons i nie wraca tutaj).
//
// Na każdy tydzień gry przypisane jest jedno wyzwanie (challenge) z
// warunkiem sukcesu opartym o zaufanie / frustrację / spoons. Na
// weekly summary wyzwanie jest oceniane:
//   - sukces  -> +1 do maksymalnych spoons (cap 14),
//   - porażka -> -2 do aktualnych spoons (nie poniżej 0),
// a zaraz potem generowane jest nowe wyzwanie na kolejny tydzień.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem wyzwania w
// state.weeklyChallenge. Ekrany (weeklySummaryScreen.js, gameScreen.js,
// agendaScreen.js) czytają z niego dane do wyświetlenia.

// --------------------------------------------------------------------
// Pula wyzwań
// --------------------------------------------------------------------

// v0.19.1: Weekly Stakes Expansion. Pula rozbudowana z 6 do 17 wyzwań
// (min. wymagane: 14), wybranych/zaadaptowanych z
// assets/content/weekly-stakes/weekly-stakes-content-pack.md pod kątem
// różnorodności kategorii (poliamoria, relacja, praca, logistyka,
// masking/public event, self-regulation, metamour/calendar tension).
// Większość ma warunki MIESZANE (2 statystyki naraz), nie
// jednowymiarowe — to celowe, żeby "sukces" nie sprowadzał się do
// pilnowania jednej liczby.
const CHALLENGE_POOL = [
  {
    id: "family_visit",
    title: "Wizyta rodziny",
    description: "Za kilka dni trzeba będzie utrzymać spokój w sytuacji pełnej niewypowiedzianych oczekiwań.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 60 },
        { stat: "frustration", operator: "<=", value: 45 }
      ]
    }
  },
  {
    id: "work_deadline",
    title: "Deadline w pracy",
    description: "Nadchodzi tydzień, w którym praca nie zostawi wiele miejsca na odpoczynek.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 5 }
      ]
    }
  },
  {
    id: "trip_together",
    title: "Wspólny wyjazd",
    description: "Zaplanowany wyjazd wymaga i bliskości, i energii, żeby dobrze go przejść.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 65 },
        { stat: "spoons", operator: ">=", value: 4 }
      ]
    }
  },
  {
    id: "hard_conversation",
    title: "Trudna rozmowa",
    description: "Coś, co odkładaliście, w końcu będzie trzeba powiedzieć na głos.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 50 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    }
  },
  {
    id: "stabilization_week",
    title: "Tydzień stabilizacji",
    description: "Nic dramatycznego się nie dzieje — pytanie, czy uda się to utrzymać.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "frustration", operator: "<=", value: 50 }
      ]
    }
  },
  {
    id: "logistics_crisis",
    title: "Kryzys logistyczny",
    description: "Coś się posypie organizacyjnie i trzeba będzie to ogarnąć bez zapasu sił.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 4 },
        { stat: "trust", operator: ">=", value: 45 }
      ]
    }
  },
  {
    id: "metamour_coffee",
    title: "Kawa z metamurem",
    description: "Spotkanie przy kawie z osobą, z którą dzielisz partnera, wymaga więcej dojrzałości niż kalendarz przewidywał.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 55 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    }
  },
  {
    id: "calendar_chaos",
    title: "Kalendarzowy chaos",
    description: "Zgrać trzy kalendarze, randkę i czas dla siebie to wyzwanie logistyczne godne architekta.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 5 },
        { stat: "trust", operator: ">=", value: 45 }
      ]
    }
  },
  {
    id: "public_masking",
    title: "Publiczne maskowanie",
    description: "Na wydarzeniu trzeba będzie wyglądać spokojnie, nawet jeśli w środku system operacyjny prosi o aktualizację.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "frustration", operator: "<=", value: 55 }
      ]
    }
  },
  {
    id: "budget_week",
    title: "Budżetowy tydzień",
    description: "Koniec miesiąca zmusza do radykalnych cięć i kreatywności w planowaniu bliskości.",
    condition: {
      requirements: [
        { stat: "frustration", operator: "<=", value: 50 },
        { stat: "trust", operator: ">=", value: 45 }
      ]
    }
  },
  {
    id: "boundaries_negotiation",
    title: "Negocjacje granic",
    description: "Trzeba będzie powiedzieć jasno, gdzie kończy się otwartość, a zaczyna przeciążenie.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 60 },
        { stat: "spoons", operator: ">=", value: 4 }
      ]
    }
  },
  {
    id: "relationship_checkin",
    title: "Check-in relacyjny",
    description: "Nie ma pożaru. Właśnie dlatego można wreszcie zapytać, co naprawdę działa.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 55 },
        { stat: "frustration", operator: "<=", value: 50 }
      ]
    }
  },
  {
    id: "shared_move",
    title: "Wspólna przeprowadzka",
    description: "Pakowanie pudeł to test na cierpliwość i umiejętność dzielenia przestrzeni z innymi.",
    condition: {
      requirements: [
        { stat: "spoons", operator: ">=", value: 6 },
        { stat: "trust", operator: ">=", value: 45 }
      ]
    }
  },
  {
    id: "self_distance",
    title: "Dystans do siebie",
    description: "Musisz odpuścić ambicje i po prostu przeżyć ten tydzień bez samobiczowania.",
    condition: {
      requirements: [
        { stat: "frustration", operator: "<=", value: 30 },
        { stat: "spoons", operator: ">=", value: 4 }
      ]
    }
  },
  {
    id: "trust_crisis",
    title: "Kryzys zaufania",
    description: "Musisz udowodnić swoją szczerość po serii nieporozumień.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 80 }
      ]
    }
  },
  {
    id: "weekend_recharge",
    title: "Weekendowy relaks",
    description: "Zaplanowałeś cały tydzień tak, by mieć czas na regenerację.",
    condition: {
      requirements: [
        { stat: "frustration", operator: "<=", value: 20 },
        { stat: "spoons", operator: ">=", value: 5 }
      ]
    }
  },
  {
    id: "unexpected_encounter",
    title: "Przypadkowe spotkanie",
    description: "Spotykasz byłego/ą partnera/kę, co wywołuje falę starych emocji.",
    condition: {
      requirements: [
        { stat: "trust", operator: ">=", value: 40 },
        { stat: "frustration", operator: "<=", value: 60 }
      ]
    }
  }
];

const REWARD = { type: "max_spoons", amount: 1, cap: 14 };
const PENALTY = { type: "spoons_current", amount: -2 };

const STAT_LABELS = {
  trust: "Zaufanie",
  frustration: "Frustracja",
  spoons: "Spoons"
};

const OPERATOR_SYMBOLS = {
  ">=": "≥",
  "<=": "≤",
  ">": ">",
  "<": "<",
  "==": "="
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.weeklyChallenge istnieje. Bezpieczne dla
 * starych zapisów (sprzed v0.19) — jeśli pole nie istnieje, tworzy je
 * od zera, nie nadpisuje istniejącego wyzwania.
 */
export function ensureWeeklyChallengeState(state) {
  if (!state.weeklyChallenge) {
    state.weeklyChallenge = {
      active: null,
      lastResult: null,
      lastEvaluatedDueDay: null,
      history: []
    };
  }

  if (!Array.isArray(state.weeklyChallenge.history)) {
    state.weeklyChallenge.history = [];
  }

  return state.weeklyChallenge;
}

/**
 * Generuje wyzwanie na nadchodzący tydzień, jeśli nie ma już aktywnego.
 * Unika (jeśli to możliwe) powtórzenia id ostatnio ocenionego wyzwania.
 * dueDay = koniec nadchodzącego tygodnia (7 dni licząc od aktualnego
 * dnia włącznie).
 */
export function generateNextWeekChallenge(state) {
  const weeklyState = ensureWeeklyChallengeState(state);

  if (weeklyState.active) {
    return weeklyState.active;
  }

  const weekStartDay = state.day;
  const dueDay = weekStartDay + 6;

  const previousId = weeklyState.lastResult ? weeklyState.lastResult.id : null;
  const candidates = previousId
    ? CHALLENGE_POOL.filter((template) => template.id !== previousId)
    : CHALLENGE_POOL;
  const pool = candidates.length > 0 ? candidates : CHALLENGE_POOL;

  const template = pool[Math.floor(Math.random() * pool.length)];

  const challenge = {
    id: template.id,
    title: template.title,
    description: template.description,
    weekStartDay,
    dueDay,
    condition: template.condition,
    reward: REWARD,
    penalty: PENALTY,
    status: "active"
  };

  weeklyState.active = challenge;
  return challenge;
}

/**
 * Ocenia aktywne wyzwanie, jeśli jego dueDay już minął (dueDay <=
 * ukończony dzień = state.day - 1, bo dzień jest już zaawansowany w
 * momencie renderowania weekly summary). Stosuje nagrodę albo karę,
 * zapisuje wynik do lastResult/history.
 *
 * IDEMPOTENTNE: jeśli wyzwanie dla danego dueDay zostało już ocenione
 * (weeklyState.lastEvaluatedDueDay === challenge.dueDay), zwraca
 * zapamiętany wynik i NIC nie zmienia w stanie — bezpieczne przy
 * wielokrotnym renderze weekly summary.
 *
 * Zwraca null, jeśli nie ma aktywnego wyzwania albo jeszcze nie minął
 * jego termin (np. pierwszy tydzień gry).
 */
export function evaluateWeeklyChallenge(state) {
  const weeklyState = ensureWeeklyChallengeState(state);
  const challenge = weeklyState.active;

  if (!challenge) {
    return null;
  }

  const completedDay = state.day - 1;
  if (challenge.dueDay > completedDay) {
    return null;
  }

  if (weeklyState.lastEvaluatedDueDay === challenge.dueDay) {
    return weeklyState.lastResult;
  }

  const success = checkChallengeSuccess(challenge, state);

  if (success) {
    applyReward(state, challenge.reward);
  } else {
    applyPenalty(state, challenge.penalty);
  }

  challenge.status = success ? "success" : "failed";

  const result = {
    id: challenge.id,
    title: challenge.title,
    dueDay: challenge.dueDay,
    success,
    reward: challenge.reward,
    penalty: challenge.penalty
  };

  weeklyState.lastResult = result;
  weeklyState.history.push(result);
  weeklyState.lastEvaluatedDueDay = challenge.dueDay;
  weeklyState.active = null;

  return result;
}

function checkChallengeSuccess(challenge, state) {
  const requirements = (challenge.condition && challenge.condition.requirements) || [];
  const context = buildEvaluationContext(state);
  return requirements.every((requirement) => checkRequirement(requirement, context));
}

function checkRequirement(requirement, context) {
  const actual = context[requirement.stat];

  switch (requirement.operator) {
    case ">=":
      return actual >= requirement.value;
    case "<=":
      return actual <= requirement.value;
    case ">":
      return actual > requirement.value;
    case "<":
      return actual < requirement.value;
    case "==":
      return actual === requirement.value;
    default:
      return false;
  }
}

function buildEvaluationContext(state) {
  const npc = getPartnerNpc(state);

  return {
    spoons: state.resources.spoons.current,
    trust: npc ? npc.trust : 0,
    frustration: npc ? npc.frustration : 0
  };
}

function applyReward(state, reward) {
  if (!reward || reward.type !== "max_spoons") {
    return;
  }

  const cap = typeof reward.cap === "number" ? reward.cap : 14;
  const amount = typeof reward.amount === "number" ? reward.amount : 1;
  const spoons = state.resources.spoons;

  spoons.max = Math.min(spoons.max + amount, cap);
  spoons.current = Math.min(spoons.current + amount, spoons.max);
}

function applyPenalty(state, penalty) {
  if (!penalty || penalty.type !== "spoons_current") {
    return;
  }

  const amount = typeof penalty.amount === "number" ? penalty.amount : -2;
  const spoons = state.resources.spoons;

  spoons.current = Math.max(0, spoons.current + amount);
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

// --------------------------------------------------------------------
// Odczyt / prezentacja
// --------------------------------------------------------------------

/**
 * Zwraca aktualnie aktywne wyzwanie (albo null, jeśli nie ma żadnego —
 * np. przed pierwszym weekly summary).
 */
export function getCurrentWeeklyChallenge(state) {
  const weeklyState = ensureWeeklyChallengeState(state);
  return weeklyState.active;
}

/**
 * Zwraca liczbę dni pozostałych do terminu aktywnego wyzwania,
 * licząc INKLUZYWNIE (dzień wygenerowania + dzień terminu też się
 * liczą) — dzięki temu świeżo wygenerowane wyzwanie na 7-dniowy
 * tydzień pokazuje "Pozostało: 7 dni", nie 6.
 */
export function getWeeklyChallengeCountdown(state) {
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return null;
  }

  return Math.max(0, challenge.dueDay - state.day + 1);
}

/**
 * Zamienia warunek wyzwania na czytelny tekst, np.
 * "Zaufanie ≥ 60 i Frustracja ≤ 45".
 */
export function formatWeeklyChallengeCondition(challenge) {
  if (!challenge || !challenge.condition || !Array.isArray(challenge.condition.requirements)) {
    return "";
  }

  return challenge.condition.requirements
    .map((requirement) => formatRequirement(requirement))
    .join(" i ");
}

function formatRequirement(requirement) {
  const label = STAT_LABELS[requirement.stat] || requirement.stat;
  const symbol = OPERATOR_SYMBOLS[requirement.operator] || requirement.operator;
  return `${label} ${symbol} ${requirement.value}`;
}

/**
 * Buduje gotowy do wyświetlenia zestaw danych dla weekly summary:
 * wynik ostatnio ocenionego wyzwania (jeśli jest) + nadchodzące
 * wyzwanie wraz z sformatowanym warunkiem i odliczaniem dni.
 */
export function buildWeeklyChallengeSummary(state) {
  const weeklyState = ensureWeeklyChallengeState(state);
  const upcoming = weeklyState.active;

  return {
    lastResult: weeklyState.lastResult,
    upcoming,
    upcomingConditionText: upcoming ? formatWeeklyChallengeCondition(upcoming) : "",
    upcomingDaysLeft: upcoming ? getWeeklyChallengeCountdown(state) : null
  };
}
