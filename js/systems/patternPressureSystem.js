// patternPressureSystem.js
//
// v0.24: Pattern Pressure.
//
// Aktywne wzorce (patrz patternSystem.js) przestają być wyłącznie
// narracyjnym komentarzem. Zaczynają subtelnie wpływać na REALNY koszt
// wybranych decyzji:
//
//   - jeśli wybór PASUJE do aktywnego wzorca (te same tagi) —
//     "łatwiej wracać do tej samej reakcji" — koszt spada o 1,
//   - jeśli wybór jest wyraźnym PRZECIWIEŃSTWEM aktywnego wzorca —
//     "trudniej zrobić coś innego" — koszt rośnie o 1.
//
// To NIE jest kara ani moralizowanie. To NIE jest "zły build". To
// mechaniczne odzwierciedlenie prostej idei: powtarzany sposób
// przetrwania staje się wydeptaną ścieżką, a zejście z niej kosztuje
// trochę więcej.
//
// v0.24 (poprawka po review): modyfikator jest CELOWO PŁASKI (+/-1,
// bez skalowania po intensywności wzorca) — to ma być mały, bardzo
// ostrożny pierwszy krok, nie system, w którym silny wzorzec potrafi
// realnie zmienić ekonomię wyboru. Ewentualne skalowanie zostaje na
// przyszłą wersję, jeśli w ogóle.
//
// KRYTYCZNA ZASADA UX (poprawka po review): Pattern Pressure działa
// WYŁĄCZNIE PO kliknięciu, wewnątrz eventSystem.js#applyChoice.
// eventScreen.js (dostępność kart, disabled/forced) w ogóle NIE
// importuje tego modułu i liczy dostępność na surowym
// choice.spoonsCost — DOKŁADNIE tak jak przed v0.24. Pattern Pressure
// nie może:
//   - sprawić, że niedostępna karta stanie się dostępna,
//   - sprawić, że dostępna karta stanie się niedostępna,
//   - zmienić, która karta jest "forced cheapest choice".
// Gracz nie widzi ŻADNEJ zmiany przed kliknięciem. Jedyny ślad, jaki
// może zobaczyć, to jedno krótkie zdanie na ekranie Reflection, PO
// decyzji.
//
// Ten moduł jest w pełni deterministyczny (bez losowości) i CZYSTO
// FUNKCYJNY — applyPatternPressureToChoice() niczego nie mutuje, tylko
// oblicza i zwraca efektywne wartości.
//
// Ten moduł TYLKO CZYTA z patternSystem.js (getActivePatterns,
// deriveTags) — nie modyfikuje historii ani aktywnych wzorców.

import { getActivePatterns, deriveTags } from "./patternSystem.js?v=240";

// Które wzorce są wzajemnym przeciwieństwem — wybór otagowany tagiem z
// tej listy, podczas gdy dany wzorzec jest aktywny, liczy się jako
// "wyjście poza utarty ślad" (surcharge), nie jako wzmocnienie
// (discount). Celowo tylko najbardziej oczywiste, czytelne pary — to
// ma być mały, bezpieczny system, nie kompletna macierz relacji.
const OPPOSING_PATTERNS = {
  avoidance: ["transparency", "repair"],
  transparency: ["avoidance"],
  repair: ["avoidance"],
  overextension: ["rest"],
  rest: ["overextension", "people-pleasing"],
  "people-pleasing": ["rest"]
};

// v0.24: modyfikator jest STAŁY i PŁASKI — zawsze dokładnie 1 spoon,
// niezależnie od intensity wzorca (1-3). Żadnego skalowania w tej
// wersji.
const PRESSURE_MODIFIER = 1;

const ALIGNED_REFLECTION_TEXTS = [
  "Łatwość tego wyboru nie wzięła się znikąd.",
  "To nie była tylko decyzja. To był wydeptany skrót.",
  "Ta reakcja przyszła szybciej, niż zdążyłeś/aś ją przemyśleć."
];

const OPPOSED_REFLECTION_TEXTS = [
  "Zrobienie tego inaczej kosztowało więcej, niż powinno.",
  "Wyjście poza utarty ślad nigdy nie jest tanie.",
  "Ten wybór szedł pod górę — dosłownie."
];

/**
 * Zwraca lekki, czytelny kontekst aktywnych wzorców do użytku przez
 * inne moduły (np. devTools) — id + intensity, bez żadnej logiki.
 */
export function getPatternPressureContext(state) {
  return getActivePatterns(state).map((pattern) => ({
    id: pattern.id,
    title: pattern.title,
    intensity: pattern.intensity
  }));
}

/**
 * Oblicza EFEKTYWNY koszt danego wyboru po uwzględnieniu presji
 * aktywnych wzorców. CZYSTA FUNKCJA — nic nie mutuje, nic nie zapisuje
 * do stanu.
 *
 * v0.24: WYŁĄCZNIE do użytku przez eventSystem.js#applyChoice, PO
 * kliknięciu. eventScreen.js NIE wywołuje tej funkcji — dostępność
 * kart przed wyborem liczona jest na surowym choice.spoonsCost, bez
 * żadnego udziału Pattern Pressure.
 *
 * @returns {{
 *   spoonsCost: number,
 *   trustChange: number,
 *   frustrationChange: number,
 *   applied: boolean,
 *   alignedPatternId: string|null,
 *   opposedPatternId: string|null
 * }}
 */
export function applyPatternPressureToChoice(state, event, choice) {
  const baseline = {
    spoonsCost: choice.spoonsCost,
    trustChange: choice.trustChange,
    frustrationChange: choice.frustrationChange,
    applied: false,
    alignedPatternId: null,
    opposedPatternId: null
  };

  const activePatterns = getActivePatterns(state);
  if (!activePatterns || activePatterns.length === 0) {
    return baseline;
  }

  const choiceTags = deriveTags(
    {
      trustChange: choice.trustChange,
      frustrationChange: choice.frustrationChange,
      spoonsChange: -choice.spoonsCost
    },
    [choice.label, choice.resultText]
  );

  if (choiceTags.length === 0) {
    return baseline;
  }

  const alignedPattern = activePatterns.find((pattern) => choiceTags.includes(pattern.id));

  if (alignedPattern) {
    return {
      ...baseline,
      spoonsCost: Math.max(0, choice.spoonsCost - PRESSURE_MODIFIER),
      applied: true,
      alignedPatternId: alignedPattern.id
    };
  }

  const opposedPattern = findOpposingPattern(activePatterns, choiceTags);

  if (opposedPattern) {
    return {
      ...baseline,
      spoonsCost: choice.spoonsCost + PRESSURE_MODIFIER,
      applied: true,
      opposedPatternId: opposedPattern.id
    };
  }

  return baseline;
}

function findOpposingPattern(activePatterns, choiceTags) {
  for (const pattern of activePatterns) {
    const opposingTags = OPPOSING_PATTERNS[pattern.id] || [];
    if (choiceTags.some((tag) => opposingTags.includes(tag))) {
      return pattern;
    }
  }

  return null;
}

/**
 * Buduje JEDNO krótkie zdanie do ekranu Reflection, JEŚLI presja
 * wzorca faktycznie wpłynęła na tę decyzję (pressureResult.applied).
 * Zwraca null, jeśli nic się nie zadziało — reflection wtedy wygląda
 * dokładnie tak samo jak bez tego systemu.
 */
export function buildPatternPressureReflection(state, event, choice, pressureResult) {
  if (!pressureResult || !pressureResult.applied) {
    return null;
  }

  if (pressureResult.alignedPatternId) {
    return pickRandom(ALIGNED_REFLECTION_TEXTS);
  }

  if (pressureResult.opposedPatternId) {
    return pickRandom(OPPOSED_REFLECTION_TEXTS);
  }

  return null;
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie aktualnej
 * presji wzorców — id, tytuł, intensity, stały modyfikator (+/-1),
 * jakie tagi przeciwstawia. Te liczby NIGDY nie trafiają do UI gracza
 * — to wyłącznie narzędzie deweloperskie.
 */
export function getPatternPressureDebugSummary(state) {
  return getActivePatterns(state).map((pattern) => ({
    id: pattern.id,
    title: pattern.title,
    intensity: pattern.intensity,
    modifier: PRESSURE_MODIFIER,
    opposes: OPPOSING_PATTERNS[pattern.id] || []
  }));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
