// achievementSystem.js
//
// v0.40: Achievements / Milestones Foundation.
//
// Osiągnięcia w Out of Spoons nie mają mówić graczowi "dobrze / źle".
// Mają zauważać ważne momenty rozgrywki: przetrwanie tygodnia,
// nazwanie zasad, ujawnienie fascynacji, przejście przez konflikt,
// naprawę relacji, życie z ograniczonymi zasobami.
//
// Ten moduł:
// - NIE zmienia spoons,
// - NIE zmienia trust/frustration,
// - NIE blokuje wyborów,
// - NIE kończy gry.
// To czysty system rozpoznawania kamieni milowych.

const MAX_HISTORY = 60;

const ACHIEVEMENTS = [
  {
    id: "first-week",
    title: "Pierwszy tydzień",
    text: "Siedem dni to nie epicka saga. Czasem to wystarczy, żeby zobaczyć wzór.",
    condition: (state) => Number(state.day || 0) >= 7
  },
  {
    id: "still-here",
    title: "Nadal tu jesteś",
    text: "Relacja nie stała się łatwa. Po prostu jeszcze ma dokąd wracać.",
    condition: (state) => Number(state.day || 0) >= 14 && !hasActiveRelationshipEnd(state)
  },
  {
    id: "named-the-map",
    title: "Nazwana mapa",
    text: "Ustalenia przestały być tylko domysłem.",
    condition: (state) => {
      const model = state.relationshipModel;
      return model && Number(model.clarity || 0) >= 80;
    }
  },
  {
    id: "said-it-out-loud",
    title: "Powiedziane na głos",
    text: "Nie wszystko zrobiło się proste. Ale część rzeczy wyszła z ukrycia.",
    condition: (state) => hasLogEffect(state, "agreementEffect", (effect) => effect.applied && Number(effect.clarityChange || 0) > 0)
  },
  {
    id: "not-a-secret",
    title: "Nie jako sekret",
    text: "Fascynacja została nazwana, zanim zaczęła udawać coś mniejszego.",
    condition: (state) => hasLogEffect(state, "romanceEffect", (effect) => effect.applied && effect.disclosed === true)
  },
  {
    id: "secret-has-weight",
    title: "Sekret ma ciężar",
    text: "Nic nie wybuchło. To nie znaczy, że nic się nie stało.",
    condition: (state) => {
      const secrecy = state.player && state.player.secrecy;
      return secrecy && Number(secrecy.current || 0) >= 5;
    }
  },
  {
    id: "after-the-fight",
    title: "Po kłótni",
    text: "Kłótnia nie skończyła historii. Zostawiła ślad, z którym trzeba żyć.",
    condition: (state) => {
      const conflict = state.partner && state.partner.conflict;
      return conflict && conflict.state === "fight" && !hasActiveRelationshipEnd(state);
    }
  },
  {
    id: "repair-attempt",
    title: "Próba naprawy",
    text: "Naprawa nie jest cofnięciem czasu. Jest decyzją, że historia nie kończy się tylko na pęknięciu.",
    condition: (state) => hasLogEffect(state, "relationshipRepairEffect", (effect) => effect.applied)
  },
  {
    id: "low-spoons-morning",
    title: "Poranek bez zapasu",
    text: "Dzień zaczął się z pustymi kieszeniami, a jednak się zaczął.",
    condition: (state) => {
      const spoons = state.resources && state.resources.spoons ? Number(state.resources.spoons.current) : 0;
      return spoons <= 1 && Number(state.day || 0) >= 3;
    }
  },
  {
    id: "end-of-a-relationship",
    title: "Koniec relacji",
    text: "To nie był ekran porażki. To był koniec jednej historii.",
    condition: (state) => hasActiveRelationshipEnd(state)
  }
];

export function ensureAchievementState(state) {
  if (!state) {
    return null;
  }

  if (!state.achievements) {
    state.achievements = {
      unlocked: [],
      history: [],
      lastCheckedDay: null,
      lastUnlockedDay: null,
      lastUnlockedId: null
    };
  }

  if (!Array.isArray(state.achievements.unlocked)) {
    state.achievements.unlocked = [];
  }

  if (!Array.isArray(state.achievements.history)) {
    state.achievements.history = [];
  }

  return state.achievements;
}

export function evaluateAchievements(state) {
  const achievementState = ensureAchievementState(state);
  if (!achievementState) {
    return { changed: false, unlocked: [] };
  }

  if (achievementState.lastCheckedDay === state.day) {
    return { changed: false, unlocked: [] };
  }

  const unlockedNow = [];
  const alreadyUnlocked = new Set(achievementState.unlocked.map((entry) => entry.id));

  for (const achievement of ACHIEVEMENTS) {
    if (alreadyUnlocked.has(achievement.id)) {
      continue;
    }

    let passed = false;
    try {
      passed = achievement.condition(state) === true;
    } catch (error) {
      passed = false;
    }

    if (!passed) {
      continue;
    }

    const entry = {
      id: achievement.id,
      title: achievement.title,
      text: achievement.text,
      day: state.day
    };

    achievementState.unlocked.push(entry);
    achievementState.history.push({
      day: state.day,
      source: "achievement-unlocked",
      id: achievement.id,
      title: achievement.title
    });
    achievementState.lastUnlockedDay = state.day;
    achievementState.lastUnlockedId = achievement.id;
    unlockedNow.push(entry);
  }

  achievementState.lastCheckedDay = state.day;
  cleanupHistory(achievementState);

  return {
    changed: unlockedNow.length > 0,
    unlocked: unlockedNow
  };
}

export function buildMorningAchievementLine(state) {
  const achievementState = ensureAchievementState(state);
  if (!achievementState || achievementState.lastUnlockedDay !== state.day || !achievementState.lastUnlockedId) {
    return null;
  }

  const unlocked = achievementState.unlocked.find((entry) => entry.id === achievementState.lastUnlockedId);
  if (!unlocked) {
    return null;
  }

  return `Osiągnięcie: ${unlocked.title}.`;
}

export function getAchievementDebugSummary(state) {
  const achievementState = ensureAchievementState(state);
  if (!achievementState) {
    return null;
  }

  return {
    count: achievementState.unlocked.length,
    lastCheckedDay: achievementState.lastCheckedDay,
    lastUnlockedDay: achievementState.lastUnlockedDay,
    lastUnlockedId: achievementState.lastUnlockedId,
    unlocked: achievementState.unlocked,
    recentHistory: achievementState.history.slice(-10)
  };
}

export function unlockTestAchievement(state) {
  const achievementState = ensureAchievementState(state);
  if (!achievementState) {
    return null;
  }

  const id = "devtools-test-achievement";
  const existing = achievementState.unlocked.find((entry) => entry.id === id);
  if (existing) {
    achievementState.lastUnlockedDay = state.day;
    achievementState.lastUnlockedId = id;
    return achievementState;
  }

  achievementState.unlocked.push({
    id,
    title: "Testowy kamień milowy",
    text: "To osiągnięcie istnieje tylko po to, żeby sprawdzić system.",
    day: state.day
  });
  achievementState.history.push({
    day: state.day,
    source: "devtools-unlock-test",
    id
  });
  achievementState.lastUnlockedDay = state.day;
  achievementState.lastUnlockedId = id;
  cleanupHistory(achievementState);

  return achievementState;
}

export function clearAchievements(state) {
  const achievementState = ensureAchievementState(state);
  if (!achievementState) {
    return null;
  }

  achievementState.unlocked = [];
  achievementState.history.push({
    day: state.day,
    source: "devtools-clear"
  });
  achievementState.lastCheckedDay = null;
  achievementState.lastUnlockedDay = null;
  achievementState.lastUnlockedId = null;
  cleanupHistory(achievementState);

  return achievementState;
}

function hasLogEffect(state, effectName, predicate) {
  const log = Array.isArray(state.log) ? state.log : [];
  return log.some((entry) => {
    const effect = entry ? entry[effectName] : null;
    return effect && predicate(effect);
  });
}

function hasActiveRelationshipEnd(state) {
  return state.relationshipEnd && state.relationshipEnd.active === true;
}

function cleanupHistory(achievementState) {
  if (achievementState.history.length > MAX_HISTORY) {
    achievementState.history = achievementState.history.slice(achievementState.history.length - MAX_HISTORY);
  }
}
