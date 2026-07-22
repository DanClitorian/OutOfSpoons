// narrativeMemorySystem.js
//
// v0.55: Narrative Consequence Memory.
//
// Miękki system pamięci konsekwencji. Po wyraźniejszych decyzjach
// zapisuje krótki, wygasający ślad ("memory"). Ślady:
//   - nie są questami ani zadaniami do zrobienia,
//   - nie mają liczbowego UI,
//   - dają co najwyżej JEDEN literacki callback na poranku,
//   - dają lekki (nigdy wymuszony) bonus wagi w losowaniu eventów,
//   - i mały, ciche podsumowanie w weekly summary.
//
// Stan jest w pełni lazy-init (state.narrativeMemory), więc stare
// save'y (bez tego pola) działają bez żadnej migracji i bez zmiany
// saveVersion — patrz ensureNarrativeMemoryState().

const MAX_ACTIVE_MEMORIES = 8;

// Skala 1–3. Czas życia rośnie z intensywnością.
const LIFESPAN_BY_INTENSITY = { 1: 3, 2: 5, 3: 7 };

// Próg "mocnego śladu" — jedyny poziom, który może przebić się do
// porannego callbacku i do weekly summary jako coś realnie ważnego.
const STRONG_INTENSITY = 2;

// Frazy używane WYŁĄCZNIE do rozpoznania tonu decyzji z tekstu, który
// gracz i tak już widział (label/resultText) — nigdy nowy, ukryty
// osąd. Krótkie, częste w naturalnym polskim, celowo nieliczne.
const AVOIDANCE_PHRASES = ["udawa", "zniknąć", "znikasz", "przemilcz", "unik", "wymyk"];
const HONESTY_PHRASES = ["wprost", "uczciwie", "nazwać", "nazywasz", "powiedzieć", "mówisz to, co"];

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

export function ensureNarrativeMemoryState(state) {
  if (!state) return null;

  if (!state.narrativeMemory || typeof state.narrativeMemory !== "object") {
    state.narrativeMemory = { memories: [], lastDecayedDay: null };
  }

  if (!Array.isArray(state.narrativeMemory.memories)) {
    state.narrativeMemory.memories = [];
  }

  if (typeof state.narrativeMemory.lastDecayedDay !== "number") {
    state.narrativeMemory.lastDecayedDay = null;
  }

  return state.narrativeMemory;
}

/**
 * Aktywne memories na DZISIAJ. Defensywnie filtruje po expiresDay,
 * nawet jeśli decayNarrativeMemory() z jakiegoś powodu jeszcze nie
 * odpaliło się dla bieżącego dnia (np. bardzo stary save wczytany
 * w środku dnia) — nigdy nie pokazujemy wygasłego śladu.
 */
export function getActiveNarrativeMemories(state) {
  const mem = ensureNarrativeMemoryState(state);
  if (!mem) return [];
  const today = typeof state.day === "number" ? state.day : 0;
  return mem.memories.filter((m) => m.expiresDay >= today);
}

// --------------------------------------------------------------------
// Powstawanie śladu
// --------------------------------------------------------------------

/**
 * Wywoływane z eventSystem.js#applyChoice, PO policzeniu efektywnych
 * konsekwencji, PRZED completeCurrentAgendaItem. Tworzy memory TYLKO
 * jeśli decyzja była wyraźna — neutralne wybory nie zostawiają śladu.
 *
 * `consequences` to ten sam obiekt, który eventSystem i tak buduje do
 * state.log (spoonsChange/trustChange/frustrationChange) — memory
 * czyta efektywne wartości, nie surowe pola choice, żeby ślad
 * odpowiadał temu, co faktycznie się wydarzyło (po presji wzorców i
 * bliznach relacyjnych).
 */
export function recordNarrativeMemoryFromChoice(state, event, choice, consequences) {
  const mem = ensureNarrativeMemoryState(state);
  if (!mem || !event || !choice || !consequences) return null;

  const candidate = pickStrongestCandidate(event, choice, consequences);
  if (!candidate) return null;

  const day = typeof state.day === "number" ? state.day : 0;
  const lifespan = LIFESPAN_BY_INTENSITY[candidate.intensity] || LIFESPAN_BY_INTENSITY[1];
  const texts = buildMemoryTexts(candidate.type, candidate.intensity);

  const memory = {
    id: `mem_${day}_${event.id}_${choice.id}`,
    createdDay: day,
    expiresDay: day + lifespan,
    type: candidate.type,
    intensity: candidate.intensity,
    title: texts.title,
    note: texts.note,
    tags: candidate.tags,
    sourceEventId: event.id,
    sourceChoiceId: choice.id
  };

  // Uniknij duplikatu tego samego id (praktycznie niemożliwe w jeden
  // dzień — agenda nie powtarza eventu tego samego dnia — ale
  // defensywnie, żeby recordNarrativeMemoryFromChoice było bezpieczne
  // do wywołania więcej niż raz na ten sam wybór).
  mem.memories = mem.memories.filter((m) => m.id !== memory.id);
  mem.memories.push(memory);

  trimToLimit(mem);

  return memory;
}

/**
 * Ocenia wybór wg kilku niezależnych reguł i zwraca NAJSILNIEJSZY
 * pasujący kandydat (typ + intensity). Reguły o wyższym priorytecie
 * wygrywają remisy intensywności — kolejność w tablicy ma znaczenie.
 * Brak dopasowania = brak memory (neutralna decyzja).
 */
function pickStrongestCandidate(event, choice, consequences) {
  const text = `${choice.label || ""} ${choice.resultText || ""}`.toLowerCase();
  const isAvoidant = AVOIDANCE_PHRASES.some((p) => text.includes(p));
  const isHonest = HONESTY_PHRASES.some((p) => text.includes(p));
  const eventTags = Array.isArray(event.tags) ? event.tags : [];
  const eventWeightTags = Array.isArray(event.weightTags) ? event.weightTags : [];
  const choiceTags = Array.isArray(choice.tags) ? choice.tags : [];
  const allTags = [...eventTags, ...eventWeightTags, ...choiceTags];

  const candidates = [];
  const push = (type, intensity, tags) => {
    if (intensity >= 1) candidates.push({ type, intensity: Math.min(3, intensity), tags });
  };

  // 1. Naprawa (repairAction) — najbardziej jednoznaczny sygnał, jaki mamy.
  if (choice.repairAction && choice.repairAction.type === "scar-repair") {
    const strength = Number(choice.repairAction.strength) || 1;
    push("repair", strength >= 2 ? 3 : 2, ["repair"]);
  }

  // 2. Metamour — napięcie rośnie albo opada wyraźnie.
  if (choice.metamourEffect && typeof choice.metamourEffect.tensionChange === "number") {
    const t = choice.metamourEffect.tensionChange;
    if (t >= 2) push("metamour", t >= 4 ? 3 : 2, ["metamour-signal"]);
    else if (t <= -2) push("metamour", 2, ["metamour-signal", "repair"]);
  }

  // 3. Praca — burnout rośnie (przeciążenie) albo spada (granica).
  if (choice.workEffect && typeof choice.workEffect.burnoutChange === "number") {
    const b = choice.workEffect.burnoutChange;
    if (b >= 2) push(b >= 4 ? "overextension" : "work", b >= 4 ? 3 : 2, ["work-pressure", "obligation"]);
    else if (b <= -2) push("work", 1, ["work-pressure"]);
  }

  // 4. Duży koszt łyżeczek jednorazowo — ciało to zapamiętuje.
  const spoonsCost = -(Number(consequences.spoonsChange) || 0);
  if (spoonsCost >= 3) {
    push("overextension", spoonsCost >= 4 ? 3 : 2, ["low-spoons"]);
  }

  // 5. Zaufanie — wyraźny skok w górę albo w dół.
  const trustChange = Number(consequences.trustChange) || 0;
  if (trustChange >= 3) {
    push(isHonest ? "honesty" : "connection", trustChange >= 4 ? 3 : 2, ["repair", "tension"]);
  } else if (trustChange <= -3) {
    push(isAvoidant ? "avoidance" : "conflict", Math.abs(trustChange) >= 4 ? 3 : 2, ["avoidance", "tension"]);
  }

  // 6. Frustracja — wyraźny wzrost (konflikt) albo spadek (ulga/naprawa).
  const frustrationChange = Number(consequences.frustrationChange) || 0;
  if (frustrationChange >= 4) {
    push("conflict", frustrationChange >= 6 ? 3 : 2, ["tension"]);
  } else if (frustrationChange <= -3) {
    push("repair", 2, ["repair"]);
  }

  // 7. Sama treść wyboru — unik albo szczerość, nawet bez dużych liczb.
  if (isAvoidant) push("avoidance", 1, ["avoidance"]);
  if (isHonest) push("honesty", 1, ["repair"]);

  // 8. Maskowanie i ciało/odpoczynek — po tagach tematycznych eventu.
  if (allTags.includes("masking")) push("masking", 1, ["high-masking-debt"]);
  if (allTags.includes("body")) push("body", 1, ["low-spoons"]);
  if (allTags.includes("recovery") || allTags.includes("rest")) push("rest", 1, ["low-spoons"]);
  if ((allTags.includes("admin") || allTags.includes("obligation")) && spoonsCost >= 2) {
    push("admin", 1, ["obligation"]);
  }

  if (candidates.length === 0) return null;

  // Najsilniejszy wygrywa; przy remisie wygrywa PIERWSZY (czyli
  // reguła o wyższym priorytecie tematycznym z listy powyżej).
  let best = candidates[0];
  for (const c of candidates) {
    if (c.intensity > best.intensity) best = c;
  }
  return best;
}

// --------------------------------------------------------------------
// Wygasanie
// --------------------------------------------------------------------

/**
 * Wywoływane raz dziennie z dayCycle.js#advanceToNextDay, PO
 * inkrementacji state.day. Guard lastDecayedDay chroni przed
 * podwójnym odpaleniem, gdyby poranek renderował się kilka razy
 * (identyczny wzorzec co recordWeeklyTrackingMark z v0.52).
 */
export function decayNarrativeMemory(state) {
  const mem = ensureNarrativeMemoryState(state);
  if (!mem) return;

  const today = typeof state.day === "number" ? state.day : 0;
  if (mem.lastDecayedDay === today) return;

  mem.memories = mem.memories.filter((m) => m.expiresDay >= today);
  trimToLimit(mem);
  mem.lastDecayedDay = today;
}

function trimToLimit(mem) {
  if (mem.memories.length <= MAX_ACTIVE_MEMORIES) return;

  // Usuń najstarsze/najsłabsze najpierw: sortuj rosnąco po
  // (intensity, createdDay), zetnij nadmiar od początku.
  const sorted = [...mem.memories].sort((a, b) => {
    if (a.intensity !== b.intensity) return a.intensity - b.intensity;
    return a.createdDay - b.createdDay;
  });
  const toRemove = new Set(sorted.slice(0, mem.memories.length - MAX_ACTIVE_MEMORIES).map((m) => m.id));
  mem.memories = mem.memories.filter((m) => !toRemove.has(m.id));
}

// --------------------------------------------------------------------
// Poranek — maks. JEDEN subtelny callback, tylko dla mocnych śladów
// --------------------------------------------------------------------

/**
 * Zwraca sygnał gotowy do wpięcia w gameScreen.js#buildMorningSignals
 * (id "narrative-memory", żeby dało się go dopisać do whitelisty
 * v0.52.1), albo null. Pokazuje WYŁĄCZNIE najsilniejszy aktywny ślad
 * (intensity >= 2) — nigdy listę, nigdy więcej niż jeden.
 */
export function buildMorningMemorySignal(state) {
  const active = getActiveNarrativeMemories(state).filter((m) => m.intensity >= STRONG_INTENSITY);
  if (active.length === 0) return null;

  const strongest = pickMostRelevant(active);
  return {
    id: "narrative-memory",
    title: "Ślad",
    type: "memory",
    priority: 62,
    text: strongest.note
  };
}

function pickMostRelevant(memories) {
  return [...memories].sort((a, b) => {
    if (a.intensity !== b.intensity) return b.intensity - a.intensity;
    return b.createdDay - a.createdDay;
  })[0];
}

// --------------------------------------------------------------------
// Reflection — jedno krótkie zdanie, tylko zaraz po powstaniu śladu
// --------------------------------------------------------------------

/**
 * Zwraca krótką linię TYLKO jeśli decyzja z `lastEntry` faktycznie
 * właśnie zostawiła wyraźny ślad (intensity >= 2) — nie za każdym
 * razem, nigdy jako liczba czy "memory added".
 */
export function buildReflectionMemoryLine(state, lastEntry) {
  if (!lastEntry) return null;
  const mem = ensureNarrativeMemoryState(state);
  const justCreated = mem.memories.find(
    (m) =>
      m.sourceEventId === lastEntry.eventId &&
      m.sourceChoiceId === lastEntry.choiceId &&
      m.createdDay === state.day &&
      m.intensity >= STRONG_INTENSITY
  );
  if (!justCreated) return null;
  return justCreated.intensity >= 3
    ? "To nie znika po zamknięciu dnia."
    : "Zostaje na kilka dni, cicho.";
}

// --------------------------------------------------------------------
// Weekly summary — mały blok "Co wracało w tle"
// --------------------------------------------------------------------

/**
 * Zwraca { leadText, items } (items: max 3 krótkie tytuły) albo null,
 * jeśli w tygodniu nie było nic wartego wzmianki. weeklySummaryScreen
 * renderuje to istniejącymi klasami sekcji konsekwencji — bez nowego
 * CSS, bez tabeli, bez listy 7 dni, bez id eventów.
 */
export function buildWeeklyMemorySummary(state) {
  const active = getActiveNarrativeMemories(state).filter((m) => m.intensity >= 1);
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => {
    if (a.intensity !== b.intensity) return b.intensity - a.intensity;
    return b.createdDay - a.createdDay;
  });
  const top = sorted.slice(0, 3);

  const leadText = top.length === 1
    ? "Jedna decyzja wracała ciszej niż wydarzenie, które ją wywołało."
    : "Kilka decyzji wracało ciszej niż wydarzenia, które je wywołały.";

  const items = top.map((m) => m.title);

  return { leadText, items };
}

// --------------------------------------------------------------------
// Lekkie ważenie eventów — bez forced spawn, bez efektu spirali
// --------------------------------------------------------------------

/**
 * Zwraca Set aktywnych TYPÓW memory (intensity >= 2) do lekkiego
 * bonusowania w eventWeightSystem.js. Nigdy nie gwarantuje pojawienia
 * się eventu — tylko podnosi jego szansę wśród reszty puli.
 */
export function getNarrativeMemoryWeightTags(state) {
  const active = getActiveNarrativeMemories(state).filter((m) => m.intensity >= STRONG_INTENSITY);
  return new Set(active.map((m) => m.type));
}

// --------------------------------------------------------------------
// Teksty — krótkie, literackie, bez języka technicznego
// --------------------------------------------------------------------

function buildMemoryTexts(type, intensity) {
  const table = {
    repair: {
      title: "Naprawa",
      note: intensity >= 3
        ? "Coś zostało odkręcone. Nie od razu, ale realnie."
        : "To wróci jeszcze przez kilka dni, tylko ciszej."
    },
    avoidance: {
      title: "Unik",
      note: intensity >= 3
        ? "Ten unik ułatwi kolejny — droga w dół jest zawsze gładsza."
        : "Nie zniknęło. Po prostu przestało świecić."
    },
    honesty: {
      title: "Szczerość",
      note: intensity >= 3
        ? "Wczorajsza szczerość nadal zmienia temperaturę pokoju."
        : "Powiedziane na głos, zostaje powiedziane."
    },
    overextension: {
      title: "Przeciążenie",
      note: intensity >= 3
        ? "Ciało pamięta ostatnie przeciągnięcie bardziej niż kalendarz."
        : "To był koszt, który dogania z opóźnieniem."
    },
    body: {
      title: "Ciało",
      note: "Ciało prowadzi własny rejestr ostatnich dni."
    },
    work: {
      title: "Praca",
      note: intensity >= 2
        ? "Praca nie zniknęła po zamknięciu laptopa. Czeka cierpliwie."
        : "Postawiona wczoraj granica nadal stoi. Trochę krzywo, ale stoi."
    },
    admin: {
      title: "Admin życia",
      note: "Nie wszystko, co załatwione, jest domknięte."
    },
    masking: {
      title: "Maska",
      note: "Twarz z wczoraj jeszcze nie do końca zeszła."
    },
    metamour: {
      title: "Sieć relacji",
      note: intensity >= 3
        ? "To napięcie z metamour nie rozpłynęło się przez noc."
        : "Coś między wami zostało trochę inaczej ustawione niż wcześniej."
    },
    rest: {
      title: "Odpoczynek",
      note: "Ten odpoczynek wciąż trochę procentuje."
    },
    conflict: {
      title: "Napięcie",
      note: intensity >= 3
        ? "Wczorajsze napięcie nie spadło do zera. Pokój je pamięta."
        : "Coś w powietrzu zostaje nieodhaczone."
    },
    connection: {
      title: "Bliskość",
      note: "Coś dobrego z wczoraj wciąż tu jest, nienazwane, ale obecne."
    }
  };

  return table[type] || { title: "Ślad", note: "To nie znika po zamknięciu dnia." };
}
