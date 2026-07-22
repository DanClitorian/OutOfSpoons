// reflectionSummarySystem.js
//
// v0.59: Reflection Screen Game Feel & Consequence Clarity.
//
// Warstwa SELEKCJI dla ekranu refleksji. Nie zmienia żadnej mechaniki,
// nie dotyka state.log — czyta to, co eventSystem.js już tam zapisał
// (patrz applyChoice), i wybiera co najwyżej kilka rzeczy do pokazania
// zamiast sklejać wszystko w jeden akapit.
//
// PRIORYTETY (od najważniejszych):
//   4 — najwyższy: konflikt fight/critical, ujawniony sekret, mocny
//       spadek zaufania, duża frustracja, spoons bliskie zeru po wyborze
//   3 — wysoki: relationship model, świeży ślad pamięci, naprawa,
//       blizna, duża zmiana metamour/pracy, maskowanie, romans, ustalenia
//   2 — średni: drobne trust/frustration, echo wzorca, mała zmiana
//       metamour/pracy
//   1 — niski: statyczne/systemowe dopełniacze (static, stakes,
//       pattern pressure narrative) — wypełniają miejsce TYLKO jeśli
//       nic ważniejszego się nie wydarzyło
//
// Maks. 3 karty. Jeśli nic nie przekracza progu — sam resultText +
// spokojna linia domknięcia. Jeden dodatkowy "cichy ślad" (pamięć /
// model relacji / konflikt / maska / zmęczenie) TYLKO jeśli nie
// zmieścił się już w kartach — żeby nic się nie powtarzało.
//
// Zero nowych pól state. Zero zmian w build*Reflection funkcjach,
// które już istnieją — ten plik je WOŁA i PORZĄDKUJE wynik, nigdy nie
// zastępuje ich logiki.

import { eventPool } from "../data/eventData.js?v=540";
import { recordPatternFromChoice } from "./patternSystem.js?v=300";
import { buildPatternPressureReflection } from "./patternPressureSystem.js?v=300";
import { buildRelationshipScarReflection } from "./relationshipScarsSystem.js?v=300";
import { buildRelationshipRepairReflection } from "./relationshipRepairSystem.js?v=300";
import { buildReflectionStaticLine } from "./staticSystem.js?v=300";
import { buildMetamourReflection } from "./metamourSystem.js?v=300";
import { buildWorkReflection } from "./workPressureSystem.js?v=300";
import { buildReflectionStakesLine } from "./dailyStakesSystem.js?v=320";
import { buildReflectionMaskingDebtLine } from "./maskingDebtSystem.js?v=330";
import { buildReflectionConflictLine } from "./conflictEscalationSystem.js?v=350";
import { buildReflectionSecrecyLine } from "./secrecyConsequenceSystem.js?v=380";
import { buildReflectionAgreementLine } from "./relationshipAgreementSystem.js?v=390";
import { buildReflectionMemoryLine } from "./narrativeMemorySystem.js?v=560";
import { buildRelationshipModelReflectionLine } from "./relationshipModelConsequenceSystem.js?v=560";

const MAX_CARDS = 3;

/**
 * Punkt wejścia. Zwraca null, jeśli nie ma jeszcze żadnej decyzji w
 * logu (np. bardzo wczesny stan gry) — reflectionScreen.js wtedy
 * pokazuje wyłącznie pusty fallback, tak jak dotąd.
 */
export function buildReflectionSummary(state, lastEntry) {
  if (!lastEntry) {
    return null;
  }

  const originalEvent = eventPool.find((event) => event.id === lastEntry.eventId);
  const originalChoice = originalEvent
    ? originalEvent.choices.find((choice) => choice.id === lastEntry.choiceId)
    : null;

  const outcome = pickPrimaryOutcome(lastEntry, originalChoice);
  const candidates = collectCandidates(state, lastEntry, originalEvent, originalChoice);
  const cards = pickTopCards(candidates);
  const usedKeys = new Set(cards.map((c) => c.key));
  const quietTrace = pickQuietTrace(candidates, usedKeys);
  const chips = buildChips(lastEntry.consequences);

  return {
    choiceLabel: outcome.choiceLabel,
    resultText: outcome.resultText,
    cards: cards.map((c) => ({ title: c.title, text: c.text })),
    quietTrace,
    chips
  };
}

/**
 * Hero — resultText jest zawsze najważniejszy; wybrany label wyboru
 * dokładamy jako krótką "eyebrow" linię, jeśli jest dostępny (nie jest
 * to nowa informacja — to dokładnie ten label, który gracz już widział
 * na kartach decyzji przed kliknięciem).
 */
export function pickPrimaryOutcome(lastEntry, originalChoice) {
  return {
    choiceLabel: originalChoice ? originalChoice.label : null,
    resultText: lastEntry.resultText || ""
  };
}

// --------------------------------------------------------------------
// Zbieranie kandydatów — jeden odczyt lastEntry, jedno wywołanie
// każdej istniejącej build*Reflection funkcji (bez duplikowania ich
// logiki), z przypisanym priorytetem i tytułem tematycznym.
// --------------------------------------------------------------------

function collectCandidates(state, lastEntry, originalEvent, originalChoice) {
  const c = lastEntry.consequences || {};
  const candidates = [];

  const push = (key, tier, title, text) => {
    if (text) {
      candidates.push({ key, tier, title, text });
    }
  };

  // --- Tier 4: najwyższy -------------------------------------------
  const conflict = lastEntry.conflictEffect || {};
  const conflictFightOrCritical =
    conflict.triggeredFight === true || conflict.stateAfter === "critical" || conflict.stateAfter === "fight";
  if (conflictFightOrCritical) {
    push("conflict", 4, "W napięciu", buildReflectionConflictLine(state, lastEntry) || "Napięcie w relacji przeszło w coś, co trudno teraz cofnąć.");
  }

  const secrecy = lastEntry.secrecyEffect || {};
  if (secrecy.applied && (secrecy.discovered === true || secrecy.breachRisk === "high")) {
    push("secrecy", 4, "W tle", buildReflectionSecrecyLine(state, lastEntry) || "Coś, co miało zostać ukryte, przestało być tylko Twoje.");
  }

  if (typeof c.trustChange === "number" && c.trustChange <= -4) {
    push("trust-critical", 4, "W relacji", "Zaufanie nie znika, ale zmienia temperaturę rozmowy.");
  }

  if (typeof c.frustrationChange === "number" && c.frustrationChange >= 5) {
    push("frustration-critical", 4, "W napięciu", "Napięcie rośnie wyraźniej, niż zwykle rosło po podobnych dniach.");
  }

  const spoonsAfter = state.resources && state.resources.spoons ? state.resources.spoons.current : null;
  if (typeof spoonsAfter === "number" && spoonsAfter <= 1 && typeof c.spoonsChange === "number" && c.spoonsChange < 0) {
    push("spoons-critical", 4, "W ciele", "Ciało zapisuje ten koszt szybciej niż kalendarz.");
  }

  // --- Tier 3: wysoki -------------------------------------------------
  const modelEffect = lastEntry.relationshipModelEffect || {};
  if (modelEffect.applied) {
    push("model", 3, "W ustaleniach", buildRelationshipModelReflectionLine(state, lastEntry));
  }

  const memoryText = buildReflectionMemoryLine(state, lastEntry);
  if (memoryText) {
    push("memory", 3, "W pamięci dnia", memoryText);
  }

  const repair = lastEntry.relationshipRepairEffect || {};
  if (repair.applied) {
    push("repair", 3, "W relacji", buildRelationshipRepairReflection(state, repair));
  }

  const scar = lastEntry.relationshipScarEffect || {};
  if (scar.applied && !candidates.some((x) => x.key === "repair")) {
    push("scar", 3, "W relacji", buildRelationshipScarReflection(state, scar));
  }

  const metamour = lastEntry.metamourEffect || {};
  const metamourBig = metamour.applied && typeof metamour.tensionChange === "number" && Math.abs(metamour.tensionChange) >= 3;
  if (metamourBig) {
    push("metamour-big", 3, "W sieci relacji", buildMetamourReflection(state, metamour));
  }

  const work = lastEntry.workEffect || {};
  const workBig = work.applied && (
    (typeof work.burnoutChange === "number" && Math.abs(work.burnoutChange) >= 3) ||
    (typeof work.pressureChange === "number" && Math.abs(work.pressureChange) >= 5)
  );
  if (workBig) {
    push("work-big", 3, "W pracy", buildWorkReflection(state, work));
  }

  const masking = lastEntry.maskingDebtEffect || {};
  if (masking.applied) {
    push("masking", 3, "W tle", buildReflectionMaskingDebtLine(state, lastEntry));
  }

  const romance = lastEntry.romanceEffect || {};
  if (romance.applied && romance.note) {
    push("romance", 3, "W relacji", romance.note);
  }

  const agreement = lastEntry.agreementEffect || {};
  if (agreement.applied) {
    push("agreement", 3, "W ustaleniach", buildReflectionAgreementLine(state, lastEntry));
  }

  // --- Tier 2: średni --------------------------------------------------
  if (typeof c.trustChange === "number" && c.trustChange !== 0 && Math.abs(c.trustChange) < 4) {
    push(
      "trust-small",
      2,
      "W relacji",
      c.trustChange > 0
        ? "Coś w relacji przesunęło się odrobinę na lepsze, mało zauważalnie z zewnątrz."
        : "Coś w relacji zrobiło się odrobinę trudniejsze do przejścia."
    );
  }

  if (typeof c.frustrationChange === "number" && c.frustrationChange !== 0 && Math.abs(c.frustrationChange) < 5) {
    push(
      "frustration-small",
      2,
      "W napięciu",
      c.frustrationChange > 0
        ? "Napięcie podniosło się o odrobinę, nawet jeśli nikt tego głośno nie nazwał."
        : "Napięcie trochę opadło, choć nic nie zostało formalnie rozwiązane."
    );
  }

  if (lastEntry.patternPressure && lastEntry.patternPressure.applied) {
    const pressureText = buildPatternPressureReflection(state, originalEvent, originalChoice, lastEntry.patternPressure);
    push("pattern-pressure", 2, "W tle", pressureText);
  }

  if (metamour.applied && !metamourBig) {
    push("metamour-small", 2, "W sieci relacji", buildMetamourReflection(state, metamour));
  }

  if (work.applied && !workBig) {
    push("work-small", 2, "W pracy", buildWorkReflection(state, work));
  }

  // --- Tier 1: niski — dopełniacze, tylko gdy brakuje ważniejszych ----
  const triggered = recordPatternFromChoice(state, {
    day: lastEntry.day,
    eventId: lastEntry.eventId,
    choiceId: lastEntry.choiceId,
    choiceLabel: originalChoice ? originalChoice.label : null,
    choiceDescription: lastEntry.resultText,
    consequences: lastEntry.consequences
  });
  if (triggered.length > 0) {
    push("pattern-echo", 1, "W relacji", triggered[0].text);
  }

  push("static", 1, "W tle", buildReflectionStaticLine(state, lastEntry));
  push("stakes", 1, "W tle", buildReflectionStakesLine(state, lastEntry));

  if (typeof c.fatigueChange === "number" && c.fatigueChange > 0) {
    push("fatigue", 1, "W ciele", "Jutro może zacząć się ciężej niż dziś.");
  }

  return candidates;
}

// --------------------------------------------------------------------
// Wybór — top 3 wg tier (malejąco), stabilny sort (kolejność wstawienia
// jako tie-break, więc wyższe priorytety tematyczne z listy powyżej
// wygrywają remisy).
// --------------------------------------------------------------------

function pickTopCards(candidates) {
  return [...candidates]
    .sort((a, b) => b.tier - a.tier)
    .slice(0, MAX_CARDS);
}

/**
 * Cichy ślad — jedna dodatkowa linia z WĄSKIEGO zestawu (pamięć / model
 * relacji / konflikt / maska / zmęczenie), TYLKO jeśli nie zmieściła
 * się już w kartach. Zwraca null, jeśli nic w tym zestawie nie
 * wystąpiło albo wszystko już pokazano.
 */
function pickQuietTrace(candidates, usedKeys) {
  const priorityOrder = ["memory", "model", "conflict", "masking", "fatigue"];
  const byKey = new Map(candidates.map((c) => [c.key, c]));

  for (const key of priorityOrder) {
    if (usedKeys.has(key)) continue;
    const candidate = byKey.get(key);
    if (candidate) {
      return candidate.text;
    }
  }

  return null;
}

// --------------------------------------------------------------------
// Chipy — 2-3 krótkie etykiety tekstowe, NIGDY liczby.
// --------------------------------------------------------------------

function buildChips(consequences) {
  if (!consequences) return [];
  const chips = [];

  if (typeof consequences.trustChange === "number" && consequences.trustChange !== 0) {
    chips.push(consequences.trustChange > 0 ? "trochę więcej zaufania" : "zaufanie trudniej oddycha");
  }

  if (typeof consequences.frustrationChange === "number" && consequences.frustrationChange !== 0) {
    chips.push(consequences.frustrationChange > 0 ? "więcej napięcia" : "mniej napięcia");
  }

  if (typeof consequences.spoonsChange === "number" && consequences.spoonsChange < 0) {
    chips.push("koszt odczuwalny w ciele");
  }

  if (typeof consequences.fatigueChange === "number" && consequences.fatigueChange > 0 && chips.length < 3) {
    chips.push("cięższe jutro");
  }

  return chips.slice(0, 3);
}

// --------------------------------------------------------------------
// Linia domknięcia — spokojna, TYLKO gdy nie ma żadnych kart (żeby
// ekran nigdy nie kończył się bez niczego po resultText).
// --------------------------------------------------------------------

export function buildReflectionClosingLine(summary) {
  if (!summary || summary.cards.length > 0) {
    return null;
  }
  return "Nie każda decyzja musi zostawić widoczny ślad. Ta po prostu się wydarzyła, i dzień idzie dalej.";
}
