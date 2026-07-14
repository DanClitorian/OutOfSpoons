// relationshipScarsSystem.js
//
// v0.25: Relationship Scars / Blizny relacyjne.
//
// Do tej pory porażka w Wielkim Teście (criticalEventSystem.js) była
// tylko chwilowym spadkiem trust/frustration/spoons — kilka dobrych
// wyborów i da się to odrobić, jakby nic się nie stało. Ten moduł
// dodaje coś, co NIE odrabia się tak łatwo: bliznę relacyjną.
//
// To FUNDAMENT, nie system terapii/naprawy: blizny w v0.25 się nie
// usuwają, nie ma jeszcze "repair events", nie ma przebaczenia. Jest
// tylko jeden, bardzo subtelny efekt: jeśli aktywna blizna tematycznie
// pasuje do sytuacji, przyszłe DODATNIE zyski trust są pomniejszone o
// dokładnie 1 (nigdy poniżej 0). To nie kara — to po prostu
// "zaufanie wraca wolniej, kiedy raz musiało iść pieszo".
//
// Ważne zasady projektowe:
//   - blizny powstają WYŁĄCZNIE po porażce w Wielkim Teście — nigdy po
//     zwykłym evencie, nigdy po Weekly Stake, nigdy po pojedynczym
//     złym wyborze,
//   - efekt jest maksymalnie -1 trust gain na wybór, tylko przy
//     trustChange > 0, tylko przy tematycznym dopasowaniu,
//   - blizny NIE zmieniają frustration ani spoons, NIE blokują
//     wyborów, NIE są widoczne przed wyborem — tylko jako jedno zdanie
//     w reflection PO fakcie i krótka wzmianka w weekly summary,
//   - zero liczb w UI gracza.
//
// Ten moduł NIE renderuje UI — tylko zarządza stanem w
// state.partner.scars. Ekrany (reflectionScreen.js,
// weeklySummaryScreen.js) i eventSystem.js/criticalEventSystem.js
// czytają/zapisują przez ten moduł.

const MAX_SCARS = 3;
const TRUST_PENALTY = 1;

// --------------------------------------------------------------------
// Szablony blizn — mapowane po id Wielkiego Testu, z fallbackiem
// --------------------------------------------------------------------

const SCAR_TEMPLATES = {
  future_conversation: {
    id: "broken-promises",
    title: "Pęknięte obietnice",
    description: "Deklaracje brzmią ciszej, odkąd jedna z nich nie utrzymała ciężaru.",
    tags: ["trust", "promises", "repair", "transparency"]
  },
  trip_together: {
    id: "unsafe-closeness",
    title: "Niepewna bliskość",
    description: "Bliskość nadal jest możliwa, ale przestała być oczywista.",
    tags: ["trust", "closeness", "repair"]
  },
  family_visit: {
    id: "exposed-without-cover",
    title: "Bez osłony",
    description: "Coś zostało odsłonięte w złym momencie i relacja to zapamiętała.",
    tags: ["trust", "safety", "family"]
  },
  work_deadline: {
    id: "work-takes-everything",
    title: "Praca zabiera wszystko",
    description: "Relacja nauczyła się, że w krytycznym momencie może przegrać z obowiązkiem.",
    tags: ["trust", "availability", "work"]
  },
  moving_house: {
    id: "shared-weight",
    title: "Ciężar przeniesiony nierówno",
    description: "Nie chodzi tylko o zadanie. Chodzi o to, kto je niósł.",
    tags: ["trust", "responsibility", "overextension"]
  },
  public_event: {
    id: "public-loneliness",
    title: "Samotność przy ludziach",
    description: "Najtrudniejsze było nie to, że inni widzieli. Najtrudniejsze było to, kto nie zobaczył.",
    tags: ["trust", "visibility", "support"]
  }
};

const FALLBACK_SCAR_TEMPLATE = {
  id: "unresolved-crisis",
  title: "Niedomknięty kryzys",
  description: "Coś minęło, ale nie zostało naprawdę zakończone.",
  tags: ["trust", "repair"]
};

// Jeśli żaden tag blizny (poza ogólnym "trust") nie pasuje wprost do
// tagów eventu, ale event jest wyraźnie relacyjny/naprawczy, blizna
// wciąż może zadziałać — to zabezpiecza system przed tym, żeby był
// martwy przy obecnej, małej puli eventData.js (żaden istniejący event
// nie ma jeszcze np. tagu "promises" czy "availability").
const FALLBACK_MATCH_EVENT_TAGS = ["relationship", "communication", "repair"];

const REFLECTION_TEXTS = [
  "Nie wszystko, co pękło, od razu krzyczy.",
  "Relacja przyjęła ten gest, ale nie całkiem bez pamięci.",
  "To było dobre. Tylko nie trafiało już w zupełnie czyste miejsce.",
  "Zaufanie wraca wolniej, kiedy raz musiało iść pieszo.",
  "Nie zaczynacie od zera. To dobra i zła wiadomość."
];

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

/**
 * Upewnia się, że state.partner.scars istnieje jako tablica. Bezpieczne
 * dla starych zapisów (sprzed v0.25). Zwraca samą tablicę (nie
 * wrapper) — to jest cały "lazy state" tego systemu. Zwraca null, jeśli
 * w ogóle nie ma partnera w stanie (bezpiecznik). Nie zmienia
 * saveVersion.
 */
export function ensureRelationshipScarsState(state) {
  if (!state || !state.partner) {
    return null;
  }

  if (!Array.isArray(state.partner.scars)) {
    state.partner.scars = [];
  }

  return state.partner.scars;
}

/**
 * Dodaje bliznę PO porażce w Wielkim Teście. IDEMPOTENTNE: jeśli
 * criticalResult.scarId jest już ustawione, nic nie robi (ten sam
 * wynik nie może dodać blizny dwa razy po refreshu — criticalResult to
 * ten sam obiekt zapisany w state.criticalEvent.lastResult, więc
 * sprawdzenie tego pola na nim samym jest wystarczającym zabezpieczeniem).
 * Sukces w Wielkim Teście nigdy nie dodaje blizny.
 *
 * Jeśli ta sama blizna (po id szablonu) już istnieje, NIE dubluje jej —
 * zamiast tego zwiększa intensity (max 3). Jeśli osiągnięto MAX_SCARS
 * (3) i to byłaby nowa, inna blizna, nic nie dodaje (v0.25 nie usuwa
 * starych blizn, więc to jedyny bezpiecznik przed nieograniczonym
 * wzrostem).
 */
export function applyScarFromCriticalResult(state, criticalResult) {
  if (!criticalResult || criticalResult.success) {
    return { applied: false };
  }

  if (criticalResult.scarId) {
    return { applied: false, scarId: criticalResult.scarId, alreadyApplied: true };
  }

  const scars = ensureRelationshipScarsState(state);
  if (!scars) {
    return { applied: false };
  }

  const template = SCAR_TEMPLATES[criticalResult.id] || FALLBACK_SCAR_TEMPLATE;
  const existing = scars.find((scar) => scar.id === template.id);

  if (existing) {
    existing.intensity = Math.min(3, existing.intensity + 1);
    criticalResult.scarId = existing.id;
    return { applied: true, scarId: existing.id, wasNew: false };
  }

  if (scars.length >= MAX_SCARS) {
    criticalResult.scarId = null;
    return { applied: false, reason: "max-scars-reached" };
  }

  const newScar = {
    id: template.id,
    title: template.title,
    description: template.description,
    source: "critical-event",
    sourceEventId: criticalResult.id,
    createdDay: state.day,
    intensity: 1,
    trustRecoveryPenalty: TRUST_PENALTY,
    tags: template.tags
  };

  scars.push(newScar);
  criticalResult.scarId = newScar.id;

  return { applied: true, scarId: newScar.id, wasNew: true };
}

// --------------------------------------------------------------------
// Efekt mechaniczny na wyborach
// --------------------------------------------------------------------

/**
 * Sprawdza, czy jakaś aktywna blizna wpływa na TEN konkretny wybór, i
 * jeśli tak, zwraca zmniejszony (efektywny) trustChange. CZYSTA
 * FUNKCJA — nic nie mutuje. Wywoływana z eventSystem.js#applyChoice, PO
 * zbudowaniu bazowych consequences, PRZED zastosowaniem trust do stanu.
 *
 * Efekt tylko gdy:
 *   - consequences.trustChange > 0 (blizny nigdy nie pogłębiają już
 *     ujemnego trustChange — to nie jest dodatkowa kara),
 *   - istnieje przynajmniej jedna aktywna blizna,
 *   - ta blizna tematycznie pasuje do eventu (przez wspólny tag, z
 *     pominięciem ogólnego "trust", albo przez fallback: event ma tag
 *     relationship/communication/repair).
 *
 * Maksymalny wpływ: -1 trust gain, NIEZALEŻNIE od intensity blizny (w
 * v0.25 celowo bez skalowania — to ma być bardzo subtelne). Scars
 * NIGDY nie zmieniają frustration ani spoons, NIGDY nie blokują
 * wyborów.
 */
export function applyRelationshipScarsToChoice(state, event, choice, consequences) {
  if (!consequences || typeof consequences.trustChange !== "number" || consequences.trustChange <= 0) {
    return { applied: false };
  }

  const scars = ensureRelationshipScarsState(state);
  if (!scars || scars.length === 0) {
    return { applied: false };
  }

  const matchingScar = findMatchingScar(scars, event);
  if (!matchingScar) {
    return { applied: false };
  }

  const effectiveTrustChange = Math.max(0, consequences.trustChange - TRUST_PENALTY);
  const trustDelta = effectiveTrustChange - consequences.trustChange;

  if (trustDelta === 0) {
    return { applied: false };
  }

  return {
    applied: true,
    scarId: matchingScar.id,
    trustDelta,
    effectiveTrustChange,
    note: matchingScar.title
  };
}

function findMatchingScar(scars, event) {
  const eventTags = Array.isArray(event && event.tags) ? event.tags : [];

  for (const scar of scars) {
    const scarTags = (scar.tags || []).filter((tag) => tag !== "trust");
    if (scarTags.some((tag) => eventTags.includes(tag))) {
      return scar;
    }
  }

  const genericMatch = eventTags.some((tag) => FALLBACK_MATCH_EVENT_TAGS.includes(tag));
  return genericMatch ? scars[0] : null;
}

// --------------------------------------------------------------------
// Odczyt / prezentacja
// --------------------------------------------------------------------

/**
 * Buduje JEDNO krótkie zdanie do ekranu Reflection, JEŚLI blizna
 * faktycznie wpłynęła na tę decyzję (scarEffect.applied). Zwraca null,
 * jeśli nic się nie zadziało (zwykły przypadek) — reflection wtedy
 * wygląda dokładnie tak samo jak bez tego systemu.
 */
export function buildRelationshipScarReflection(state, scarEffect) {
  if (!scarEffect || !scarEffect.applied) {
    return null;
  }

  return pickRandom(REFLECTION_TEXTS);
}

/**
 * Buduje krótką, naturalną notatkę o aktywnych bliznach do weekly
 * summary. Pokazuje maksymalnie 2 tytuły, nigdy tabelę ani listę.
 * Zwraca null, jeśli nie ma żadnych aktywnych blizn.
 */
export function buildWeeklyRelationshipScarsNote(state) {
  const scars = ensureRelationshipScarsState(state);
  if (!scars || scars.length === 0) {
    return null;
  }

  const titles = scars.slice(0, 2).map((scar) => scar.title);

  if (titles.length === 1) {
    return `W relacji zostało coś niedomkniętego: ${titles[0]}.`;
  }

  return `W relacji zostało coś niedomkniętego: ${titles.join(" i ")}.`;
}

/**
 * Wypisuje do konsoli (przez devTools) czytelne podsumowanie aktywnych
 * blizn — id, tytuł, intensity, createdDay, sourceEventId. Te dane
 * NIGDY nie trafiają do UI gracza — to wyłącznie narzędzie
 * deweloperskie.
 */
export function getRelationshipScarsDebugSummary(state) {
  const scars = ensureRelationshipScarsState(state);
  if (!scars) {
    return [];
  }

  return scars.map((scar) => ({
    id: scar.id,
    title: scar.title,
    intensity: scar.intensity,
    createdDay: scar.createdDay,
    sourceEventId: scar.sourceEventId
  }));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
