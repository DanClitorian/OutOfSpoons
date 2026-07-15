// maskingDebtSystem.js
//
// v0.33: Masking Debt.
//
// Decyzje typu "udaję, że jest okej", "wymuszam funkcjonowanie",
// "gram normalność", "zgadzam się automatycznie" nie zawsze bolą od
// razu — ale wracają następnego dnia jako koszt ciała. TO NIE JEST
// SYSTEM MORALNEJ KARY: maskowanie bywa strategią przetrwania, gra ma
// pokazywać koszt, nie oceniać gracza. Zero diagnoz, zero
// terapiomowy — tylko: dziś przetrwałeś/aś dzięki maskowaniu, jutro
// ciało wystawia rachunek.
//
// Ważne zasady projektowe:
//   - dług NIE boli od razu — applyMaskingDebtFromChoice() nigdy nie
//     zmienia spoons, tylko zwiększa state.player.maskingDebt.current
//     (max 6). Koszt przychodzi dopiero rano, przez
//     resolveMorningMaskingDebt(),
//   - wykrywanie jest CELOWO ostrożne (patrz detectMaskingChoice) —
//     nie każda trudna decyzja to masking,
//   - zero liczb w UI gracza — tylko krótkie zdania na poranku i w
//     reflection.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w
// state.player.maskingDebt. eventSystem.js woła
// applyMaskingDebtFromChoice() po wyborze; gameScreen.js woła
// resolveMorningMaskingDebt() raz dziennie, PRZED Static (Static ma
// czytać już obniżone spoons, jeśli rachunek zaszedł tego ranka).

const MAX_DEBT = 6;
const MAX_HISTORY = 30;

// Ticket podaje dokładnie te frazy jako sygnał maskowania w tekście
// wyboru (label albo resultText, sprawdzane razem, małymi literami).
const MASKING_PHRASES = [
  "udawać",
  "wymusić",
  "zgodzić się automatycznie",
  "trzymać formę",
  "nie pokazać",
  "przemilczeć",
  "jakoś to będzie"
];

// v0.33 (kalibracja po sprawdzeniu realnych danych): "Przestać udawać
// produktywność" (choice stop_performing_productivity w
// inner_masking_receipt) to REALNY, już istniejący wybór w grze — i
// jest to DOKŁADNIE PRZECIWIEŃSTWO maskowania (świadome przestanie
// udawania). Bez tej listy wykluczeń, samo słowo "udawać" w tej
// etykiecie + tag "masking" na evencie sprawiłyby, że NAJBARDZIEJ
// uczciwy wybór w tym evencie zostałby błędnie oznaczony jako
// dodający dług — dokładnie to, przed czym ostrzega ticket ("Nie rób
// zbyt szerokiego wykrywania"). Ta lista MA PIERWSZEŃSTWO nad
// wszystkimi innymi sygnałami, włącznie z tagiem eventu.
const ANTI_MASKING_PHRASES = ["przestać udawać", "przestać grać", "powiedzieć wprost", "przyznać, że", "nazwać, co"];

// Używane TYLKO gdy event.tags zawiera "avoidance" — dodatkowy,
// węższy sygnał "wybór wygląda jak ukrywanie/ucieczka", żeby nie
// oznaczać każdego wyboru w evencie o unikaniu jako maskowanie.
const AVOIDANCE_ESCAPE_PHRASES = ["zniknąć", "uciec", "unikać", "uniknąć", "odłożyć", "schować się", "milczeć"];

const CHOICE_REFLECTION_TEXTS = [
  "To pomogło przetrwać teraz. Nie znaczy, że było darmowe.",
  "Na zewnątrz wyglądało spokojnie. W środku ktoś dopisał kreskę.",
  "Udało się utrzymać formę. Forma coś zabrała.",
  "To nie był błąd. Bardziej pożyczka."
];

const MORNING_LINES = {
  noticeable: ["Wczorajsze trzymanie formy przyszło po odbiór.", "Ciało pamięta to, co twarz wczoraj ukryła."],
  heavy: ["Maskowanie zadziałało. Rachunek też.", "Nie wszystko, co przetrwane, znika po śnie."]
};

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.player.maskingDebt istnieje. Bezpieczne dla
 * starych zapisów (sprzed v0.33). Zwraca null, jeśli w ogóle nie ma
 * gracza w stanie. Nie zmienia saveVersion.
 */
export function ensureMaskingDebtState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.player.maskingDebt) {
    state.player.maskingDebt = {
      current: 0,
      lastAppliedDay: null,
      lastChoiceDay: null,
      lastMorningResolvedDay: null,
      lastMorningEffect: null,
      history: []
    };
  }

  if (!Array.isArray(state.player.maskingDebt.history)) {
    state.player.maskingDebt.history = [];
  }

  return state.player.maskingDebt;
}

// --------------------------------------------------------------------
// Wykrywanie
// --------------------------------------------------------------------

/**
 * Wykrywa, czy dany wybór jest decyzją maskującą. CELOWO ostrożne —
 * nie każda trudna decyzja to masking. Kolejność sprawdzania ma
 * znaczenie: wykluczenia (ANTI_MASKING_PHRASES) sprawdzane są
 * NAJPIERW i mają pierwszeństwo nad wszystkim innym, włącznie z
 * tagiem eventu — patrz komentarz przy ANTI_MASKING_PHRASES.
 */
export function detectMaskingChoice(event, choice) {
  if (!choice) {
    return false;
  }

  const combinedText = `${choice.label || ""} ${choice.resultText || ""}`.toLowerCase();

  if (ANTI_MASKING_PHRASES.some((phrase) => combinedText.includes(phrase))) {
    return false;
  }

  if (MASKING_PHRASES.some((phrase) => combinedText.includes(phrase))) {
    return true;
  }

  const eventTags = Array.isArray(event && event.tags) ? event.tags : [];

  if (eventTags.includes("masking")) {
    return true;
  }

  if (eventTags.includes("avoidance") && AVOIDANCE_ESCAPE_PHRASES.some((phrase) => combinedText.includes(phrase))) {
    return true;
  }

  return false;
}

// --------------------------------------------------------------------
// Efekt mechaniczny
// --------------------------------------------------------------------

/**
 * Wywoływane z eventSystem.js#applyChoice PO Pattern Pressure /
 * Relationship Scars / Repair / Metamour / Work. Jeśli
 * detectMaskingChoice() zwróci true, dodaje +1 do
 * maskingDebt.current (max 6, nigdy więcej) i zapisuje wpis do
 * historii. NIGDY nie zmienia spoons/trust/frustration — dług boli
 * dopiero rano, przez resolveMorningMaskingDebt().
 */
export function applyMaskingDebtFromChoice(state, event, choice) {
  if (!detectMaskingChoice(event, choice)) {
    return { applied: false };
  }

  const debtState = ensureMaskingDebtState(state);
  if (!debtState) {
    return { applied: false };
  }

  const amount = 1;
  const currentAfter = Math.min(MAX_DEBT, debtState.current + amount);

  debtState.current = currentAfter;
  debtState.lastAppliedDay = state.day;
  debtState.lastChoiceDay = state.day;

  const text = pickRandom(CHOICE_REFLECTION_TEXTS);

  debtState.history.push({
    day: state.day,
    eventId: event ? event.id : null,
    choiceId: choice ? choice.id : null,
    amount,
    currentAfter,
    text
  });
  cleanupHistory(debtState);

  return { applied: true, amount, currentAfter, text };
}

/**
 * Wywoływane RAZ dziennie na poranku (gameScreen.js), PRZED Static.
 * IDEMPOTENTNE: jeśli lastMorningResolvedDay === state.day, zwraca
 * ostatni efekt (albo null, jeśli tego dnia nic się nie zdarzyło) bez
 * ponownego liczenia.
 *
 * Jeśli current < 3: brak kary, tylko oznaczenie dnia jako
 * rozwiązanego. Jeśli current >= 3: zabiera 1 spoon (current 3-4) albo
 * 2 spoons (current >= 5), nigdy poniżej 0, i zmniejsza dług o 2
 * (nigdy poniżej 0). To NIE jest regeneracja ani reset — to koszt
 * wynikający z długu, odejmowany od AKTUALNYCH (persystentnych) spoons.
 */
export function resolveMorningMaskingDebt(state) {
  const debtState = ensureMaskingDebtState(state);
  if (!debtState) {
    return null;
  }

  if (debtState.lastMorningResolvedDay === state.day) {
    return debtState.lastMorningEffect;
  }

  if (debtState.current < 3) {
    debtState.lastMorningResolvedDay = state.day;
    return null;
  }

  const level = debtState.current >= 5 ? "heavy" : "noticeable";
  const spoonsChange = level === "heavy" ? -2 : -1;

  const spoons = state.resources && state.resources.spoons ? state.resources.spoons : null;
  if (spoons && typeof spoons.current === "number") {
    spoons.current = Math.max(0, spoons.current + spoonsChange);
  }

  debtState.current = Math.max(0, debtState.current - 2);

  const effect = {
    day: state.day,
    level,
    spoonsChange,
    debtAfter: debtState.current,
    text: pickRandom(MORNING_LINES[level])
  };

  debtState.lastMorningEffect = effect;
  debtState.lastMorningResolvedDay = state.day;

  return effect;
}

function cleanupHistory(debtState) {
  if (debtState.history.length > MAX_HISTORY) {
    debtState.history = debtState.history.slice(debtState.history.length - MAX_HISTORY);
  }
}

// --------------------------------------------------------------------
// Odczyt / prezentacja (nigdy liczb, nigdy "masking debt +1" do UI gracza)
// --------------------------------------------------------------------

/**
 * Zwraca krótką linię na poranek, TYLKO jeśli resolveMorningMaskingDebt
 * DZIŚ faktycznie coś zrobiło (level noticeable/heavy). Zwraca null,
 * jeśli current był < 3 (brak kary tego ranka) albo jeszcze nie
 * przeliczono — normalny, częsty przypadek.
 */
export function buildMorningMaskingDebtLine(state) {
  const debtState = ensureMaskingDebtState(state);
  if (!debtState) {
    return null;
  }

  if (!debtState.lastMorningEffect || debtState.lastMorningEffect.day !== state.day) {
    return null;
  }

  return debtState.lastMorningEffect.text;
}

/**
 * Zwraca JEDNO krótkie zdanie do ekranu Reflection, JEŚLI ostatni
 * wybór faktycznie dodał masking debt (lastLogEntry.maskingDebtEffect.
 * applied === true) — reużywa tego samego zdania, które zostało
 * wylosowane w momencie wyboru (zapisane w logu), zamiast losować
 * drugi raz, żeby tekst w reflection był spójny z tym, co trafiło do
 * historii. Zwraca null w normalnym przypadku (wybór niemaskujący).
 */
export function buildReflectionMaskingDebtLine(state, lastLogEntry) {
  if (!lastLogEntry || !lastLogEntry.maskingDebtEffect || !lastLogEntry.maskingDebtEffect.applied) {
    return null;
  }

  return lastLogEntry.maskingDebtEffect.text || pickRandom(CHOICE_REFLECTION_TEXTS);
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie długu
 * maskowania — current, dni, ostatni efekt poranny, ostatnie 7 wpisów
 * historii. Te dane NIGDY nie trafiają do UI gracza.
 */
export function getMaskingDebtDebugSummary(state) {
  const debtState = ensureMaskingDebtState(state);
  if (!debtState) {
    return null;
  }

  return {
    current: debtState.current,
    lastAppliedDay: debtState.lastAppliedDay,
    lastChoiceDay: debtState.lastChoiceDay,
    lastMorningResolvedDay: debtState.lastMorningResolvedDay,
    lastMorningEffect: debtState.lastMorningEffect,
    recentHistory: debtState.history.slice(-7)
  };
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
