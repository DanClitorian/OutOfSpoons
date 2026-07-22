// monthlyLoopSystem.js
//
// v0.30: Month One Complete Loop (fundament: trigger po Wielkim
// Teście, guard przed powtórką, pending/consumed handshake z
// ekranem).
//
// v0.58: Month End Payoff & Run Continuity. Uogólnienie z "tylko
// miesiąc 1" na DOWOLNY miesiąc N — gra przechodzi dalej zamiast
// zatrzymywać się po pierwszym cyklu. Podsumowanie przestaje być
// tabelą liczb (usunięte "stats": decisions/repairs/scars/...) i
// staje się narracyjną rekapitulacją: hero + outcome + do 3 sekcji
// "co najbardziej niosło miesiąc" (wybierane wg realnego stanu, nie
// wszystkie naraz) + opcjonalna sekcja Wielkiego Testu + linia o
// relacji + linia o zasobach + linia ciągłości + CTA, które realnie
// przechodzi do kolejnego miesiąca (advanceToNextMonth) BEZ resetu
// gracza/partnera/fatigue/modelu relacji/pamięci/blizn.
//
// Integruje v0.55 (narrative memory), v0.56 (relationship model
// consequence), v0.57 (day texture) WYŁĄCZNIE przez bezpieczny odczyt
// ich publicznych getterów — zero zmian w tamtych plikach.

import { getActiveNarrativeMemories } from "./narrativeMemorySystem.js?v=560";
import { ensureRelationshipModelState } from "./relationshipModelSystem.js?v=340";
import { ensureRelationshipModelConsequenceState } from "./relationshipModelConsequenceSystem.js?v=560";
import { getWorkPressureContext } from "./workPressureSystem.js?v=300";
import { getMetamourContext } from "./metamourSystem.js?v=300";
import { hasRepairableScars } from "./relationshipRepairSystem.js?v=300";
import { ensureRelationshipScarsState } from "./relationshipScarsSystem.js?v=300";

const MONTH_LENGTH_DAYS = 28;

const MONTH_ORDINALS = {
  1: "pierwszy",
  2: "drugi",
  3: "trzeci",
  4: "czwarty",
  5: "piąty",
  6: "szósty"
};

// --------------------------------------------------------------------
// Stan: monthlyLoop (podsumowania) + monthProgress (licznik miesięcy).
// Oba lazy-init, oba bez zmiany saveVersion, oba działają na starych
// save'ach (v0.30 miał tylko monthlyLoop — monthProgress dolicza się
// niezależnie, bez migracji istniejących danych).
// --------------------------------------------------------------------

export function ensureMonthlyLoopState(state) {
  if (!state) {
    return null;
  }

  if (!state.monthlyLoop) {
    state.monthlyLoop = {
      completedMonths: [],
      pendingSummary: null,
      lastSummaryShownForMonth: null
    };
  }

  if (!Array.isArray(state.monthlyLoop.completedMonths)) {
    state.monthlyLoop.completedMonths = [];
  }

  return state.monthlyLoop;
}

export function ensureMonthProgressState(state) {
  if (!state) {
    return null;
  }

  if (!state.monthProgress || typeof state.monthProgress !== "object") {
    state.monthProgress = {
      currentMonth: 1,
      lastSummaryMonth: null,
      monthStartDay: 1
    };
  }

  if (typeof state.monthProgress.currentMonth !== "number") {
    state.monthProgress.currentMonth = 1;
  }

  if (typeof state.monthProgress.monthStartDay !== "number") {
    state.monthProgress.monthStartDay = 1;
  }

  return state.monthProgress;
}

export function getMonthNumber(state) {
  const progress = ensureMonthProgressState(state);
  return progress ? progress.currentMonth : 1;
}

// --------------------------------------------------------------------
// Trigger — wołane z weeklySummaryScreen.js, PO evaluateCriticalEvent/
// generateNextCriticalEvent (tak jak w v0.30). Uogólnione: nie
// zakłada, że to miesiąc 1 — czyta ensureMonthProgressState, więc
// działa identycznie dla miesiąca 2, 3, 4...
// --------------------------------------------------------------------

export function evaluateMonthlyLoopAfterWeeklySummary(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  const monthProgress = ensureMonthProgressState(state);
  if (!monthlyLoop || !monthProgress) {
    return null;
  }

  const monthNumber = monthProgress.currentMonth;

  const alreadyCompleted = monthlyLoop.completedMonths.some(
    (entry) => entry.monthNumber === monthNumber
  );
  if (alreadyCompleted || monthlyLoop.lastSummaryShownForMonth === monthNumber) {
    return null;
  }

  const lastCriticalResult = state.criticalEvent ? state.criticalEvent.lastResult : null;
  const expectedEndDay = monthProgress.monthStartDay + (MONTH_LENGTH_DAYS - 1);

  // Preferowany trigger: Wielki Test TEGO miesiąca faktycznie się
  // rozliczył (ten sam mechanizm co v0.30, tylko bez sztywnego "28").
  const criticalClosedThisMonth =
    lastCriticalResult &&
    typeof lastCriticalResult.completedDay === "number" &&
    lastCriticalResult.completedDay >= expectedEndDay;

  // Bezpiecznik: gdyby z jakiegoś powodu dane Wielkiego Testu nie
  // były dostępne (nie powinno się zdarzyć — gameScreen.js gwarantuje
  // istnienie testu od pierwszego poranka), miesiąc i tak się domyka
  // po przekroczeniu 28 dni jego trwania.
  const dayFallback = typeof state.day === "number" && state.day > expectedEndDay + 1;

  if (!criticalClosedThisMonth && !dayFallback) {
    return null;
  }

  const summary = buildMonthSummary(state, monthNumber, lastCriticalResult);
  monthlyLoop.completedMonths.push(summary);
  monthlyLoop.pendingSummary = summary;

  return summary;
}

export function hasPendingMonthSummary(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  return Boolean(monthlyLoop && monthlyLoop.pendingSummary);
}

export function consumePendingMonthSummary(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  if (!monthlyLoop || !monthlyLoop.pendingSummary) {
    return null;
  }

  const summary = monthlyLoop.pendingSummary;
  monthlyLoop.pendingSummary = null;
  monthlyLoop.lastSummaryShownForMonth = summary.monthNumber;
  return summary;
}

export function getLatestMonthSummary(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  if (!monthlyLoop || monthlyLoop.completedMonths.length === 0) {
    return null;
  }

  return monthlyLoop.completedMonths[monthlyLoop.completedMonths.length - 1];
}

/**
 * v0.58: Wołane z CTA ekranu miesięcznego podsumowania. Aktualizuje
 * WYŁĄCZNIE monthProgress — żadnego resetu gracza/partnera/npcs/
 * fatigue/modelu relacji/pamięci/blizn/pracy/osiągnięć. Miesiąc
 * przechodzi dalej, gra nie zaczyna się od nowa.
 */
export function advanceToNextMonth(state) {
  const monthProgress = ensureMonthProgressState(state);
  if (!monthProgress) {
    return null;
  }

  const finishedMonth = monthProgress.currentMonth;
  monthProgress.currentMonth = finishedMonth + 1;
  // state.day jest już dniem PIERWSZYM nowego miesiąca — eveningScreen.js
  // inkrementuje dzień PRZED pokazaniem weekly/month summary (patrz
  // nagłówek weeklySummaryScreen.js), więc to jest poprawny punkt startu.
  monthProgress.monthStartDay = typeof state.day === "number" ? state.day : monthProgress.monthStartDay + MONTH_LENGTH_DAYS;
  monthProgress.lastSummaryMonth = finishedMonth;

  return monthProgress;
}

export function getMonthlyLoopDebugSummary(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  const monthProgress = ensureMonthProgressState(state);
  if (!monthlyLoop || !monthProgress) {
    return null;
  }

  return {
    monthProgress: { ...monthProgress },
    completedMonths: monthlyLoop.completedMonths,
    pendingSummary: monthlyLoop.pendingSummary,
    lastSummaryShownForMonth: monthlyLoop.lastSummaryShownForMonth,
    latest: getLatestMonthSummary(state)
  };
}

export function forceMonthSummaryPending(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  const monthProgress = ensureMonthProgressState(state);
  if (!monthlyLoop || !monthProgress) {
    return null;
  }

  const monthNumber = monthProgress.currentMonth;
  const criticalResult =
    state.criticalEvent && state.criticalEvent.lastResult
      ? state.criticalEvent.lastResult
      : {
          completedDay: Math.max(monthProgress.monthStartDay + MONTH_LENGTH_DAYS - 1, state.day || 28),
          success: true
        };

  const summary = buildMonthSummary(state, monthNumber, criticalResult);
  monthlyLoop.pendingSummary = summary;

  const exists = monthlyLoop.completedMonths.some(
    (entry) => entry.monthNumber === summary.monthNumber
  );
  if (!exists) {
    monthlyLoop.completedMonths.push(summary);
  }

  return summary;
}

// --------------------------------------------------------------------
// Tytuł
// --------------------------------------------------------------------

export function buildMonthTitle(monthNumber) {
  const ordinal = MONTH_ORDINALS[monthNumber];
  return ordinal ? `Miesiąc ${ordinal}` : `Miesiąc ${monthNumber}`;
}

// --------------------------------------------------------------------
// Outcome — jeden wyraźny werdykt narracyjny, NIGDY punktacja.
// Kolejność reguł ma znaczenie: pierwsza dopasowana wygrywa (od
// najbardziej dramatycznej do najspokojniejszej), matching stylu
// pickStrongestCandidate z narrativeMemorySystem.js.
// --------------------------------------------------------------------

function classifyMonthOutcome(ctx) {
  if (ctx.fatigue >= 5 || ctx.spoons <= 1) {
    return {
      id: "survival",
      label: "Ciało przejęło narrację",
      subtitle: "Ten miesiąc nie pytał, czy masz siłę. Pytał, co zrobisz, kiedy jej zabraknie.",
      text: "Większość decyzji przechodziła w końcu przez jedno pytanie: da się to jeszcze udźwignąć? Czasem odpowiedź brzmiała nie, i miesiąc i tak toczył się dalej."
    };
  }

  if (ctx.trust <= 30 || ctx.conflictState === "critical" || ctx.conflictState === "fight") {
    return {
      id: "relationship-fragile",
      label: "Relacja na granicy",
      subtitle: "Nie było jednego kryzysu. Było wiele małych ciężarów, które w końcu zaczęły się liczyć razem.",
      text: "Zaufanie nie zniknęło, ale przestało być czymś oczywistym. Rozmowy, które kiedyś były łatwe, zaczęły wymagać przygotowania."
    };
  }

  if ((ctx.workContext && ctx.workContext.pressure >= 65) || (ctx.workContext && ctx.workContext.burnout >= 60)) {
    return {
      id: "work-heavy",
      label: "Praca zjadła tlen",
      subtitle: "Nie wszystko zostało naprawione. Ale coś zostało przeżyte.",
      text: "Praca rzadko prosiła wprost — po prostu zajmowała miejsce, które miało być na coś innego. Reszta życia działa się w międzyczasie."
    };
  }

  if ((ctx.modelFlags.has("low-clarity") || ctx.model.clarity < 45) && ctx.recentFriction >= 2) {
    return {
      id: "ambiguity-heavy",
      label: "Miesiąc niedopowiedzeń",
      subtitle: "Niejasność pracowała ciszej niż konflikt, ale równie skutecznie.",
      text: "Najtrudniejsze nie były same decyzje, tylko to, co znaczyły wobec ustaleń, których nikt jeszcze do końca nie nazwał."
    };
  }

  if (ctx.avoidanceMemoryCount >= 2) {
    return {
      id: "avoidance-heavy",
      label: "Miesiąc unikania",
      subtitle: "Nie każdy unik był tchórzostwem. Ale ich suma zaczęła ważyć.",
      text: "Kilka rozmów zostało odłożonych. Żadna osobno nie wydawała się ważna. Razem złożyły się w ciszę, która ma swój własny ciężar."
    };
  }

  if (ctx.repairHonestyMemoryCount >= 1 && ctx.trust >= 50) {
    return {
      id: "repair-month",
      label: "Miesiąc naprawy",
      subtitle: "Nie przez wielki gest. Raczej przez powrót do trudnych miejsc, jedno po drugim.",
      text: "Coś, co wcześniej zostało zostawione bez odpowiedzi, w końcu ją dostało. Nie idealną — po prostu prawdziwą."
    };
  }

  if (ctx.recoveryTextureCount >= 3) {
    return {
      id: "recovery-month",
      label: "Miesiąc odzyskiwania oddechu",
      subtitle: "To nie był łatwy miesiąc. Był miesiącem, który dał trochę miejsca na to, żeby się nie dobić bardziej.",
      text: "Więcej dni niż zwykle było o tym, żeby przetrwać z rezerwą, nie bez niej. To też jest forma dbania o siebie, nawet jeśli nie wygląda efektownie."
    };
  }

  return {
    id: "steady",
    label: "Miesiąc, który się nie rozpadł",
    subtitle: "Nie było jednego kryzysu. Były trzydzieści dni, z których żaden nie musiał być bohaterski.",
    text: "Nic tu nie domaga się wielkiego podsumowania. Po prostu — dzień po dniu — to się jakoś trzymało."
  };
}

// --------------------------------------------------------------------
// "Co najbardziej niosło miesiąc" — do 3 kart, wybieranych wg realnego
// stanu (scoring), nie pokazujemy wszystkich naraz.
// --------------------------------------------------------------------

function buildCarryingSections(ctx) {
  const candidates = [
    {
      id: "body",
      title: "Ciało",
      score: (ctx.fatigue >= 4 ? 3 : 0) + (ctx.spoons <= 2 ? 3 : 0) + (ctx.bodyMemoryCount > 0 ? 2 : 0) + (ctx.bodyTextureCount >= 2 ? 2 : 0),
      text: "Ciało prowadziło własną księgowość niezależnie od tego, co mówił kalendarz. Część dni zaczynała się od gorszej pozycji, niż plan zakładał."
    },
    {
      id: "relationship",
      title: "Relacja",
      score: (ctx.trust <= 40 ? 3 : 0) + (ctx.frustration >= 55 ? 3 : 0) + (ctx.conflictState === "critical" || ctx.conflictState === "fight" ? 4 : ctx.conflictState === "volatile" || ctx.conflictState === "strained" ? 2 : 0),
      text: "Nie chodziło o jedną rozmowę. Chodziło o to, jak wiele zwyczajnych momentów niosło w sobie coś więcej, niż było na powierzchni."
    },
    {
      id: "work",
      title: "Praca",
      score: (ctx.workContext && ctx.workContext.pressure >= 55 ? 3 : 0) + (ctx.workContext && ctx.workContext.burnout >= 50 ? 3 : 0) + (ctx.workTextureCount >= 2 ? 2 : 0),
      text: "Praca nie została tłem. Kilka razy usiadła przy stole bez zaproszenia i zostawała dłużej, niż powinna."
    },
    {
      id: "network",
      title: "Sieć relacji",
      score: (ctx.metamourContext && ctx.metamourContext.tension >= 50 ? 4 : 0) + (ctx.metamourMemoryCount > 0 ? 2 : 0) + (ctx.networkTextureCount >= 2 ? 2 : 0),
      text: "Relacja częściej była siecią niż linią między dwiema osobami — z własną logistyką, czułością i momentami porównywania się."
    },
    {
      id: "recovery",
      title: "Odpoczynek",
      score: (ctx.restMemoryCount > 0 ? 2 : 0) + (ctx.recoveryTextureCount >= 2 ? 3 : 0),
      text: "Nie każdy spokojniejszy dzień był porażką towarzyską. Część z nich była po prostu decyzją, żeby nic nie robić."
    },
    {
      id: "agreements",
      title: "Ustalenia",
      score: (ctx.modelFlags.has("low-clarity") ? 3 : 0) + (ctx.recentFriction >= 2 ? 3 : 0) + (ctx.recentAlignment >= 2 ? 2 : 0),
      text: "Zasady tej relacji były testowane nie przez wielkie pytania, tylko przez to, co się dzieje, kiedy nikt nie ma czasu ich przypomnieć."
    },
    {
      id: "avoidance",
      title: "Unikanie",
      score: (ctx.avoidanceMemoryCount >= 1 ? 3 : 0) + (ctx.maskingDebt >= 4 ? 2 : 0) + (ctx.quietPressureTextureCount >= 2 ? 1 : 0),
      text: "Kilka rzeczy zostało odłożonych, nie z lenistwa, tylko dlatego że w danym dniu naprawdę nie było na nie miejsca."
    },
    {
      id: "repair",
      title: "Naprawa",
      score: (ctx.hasScars ? 2 : 0) + (ctx.repairHonestyMemoryCount > 0 ? 3 : 0) + (ctx.recentAlignment >= 2 ? 1 : 0),
      text: "Były momenty, w których dało się wrócić do czegoś trudnego bez udawania, że to nic nie kosztowało."
    }
  ];

  return candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => ({ title: c.title, text: c.text }));
}

// --------------------------------------------------------------------
// Wielki Test — tylko jeśli faktycznie się rozliczył.
// --------------------------------------------------------------------

function buildCriticalEventSection(criticalResult) {
  if (!criticalResult) {
    return null;
  }

  const scarred = Boolean(criticalResult.scarId);

  if (criticalResult.success) {
    return {
      title: "Wielki Test",
      text: "Przeszło. Koszt nie zniknął, tylko zmienił adres — na coś, co będzie działać w tle kolejnego miesiąca."
    };
  }

  return {
    title: "Wielki Test",
    text: scarred
      ? "To nie był egzamin z bycia dobrą osobą. To był moment, w którym zabrakło amortyzacji — i relacja to zapamiętała."
      : "Wielki Test nie rozstrzygnął wszystkiego. Ale ujawnił, co już było napięte, zanim jeszcze się zaczął."
  };
}

// --------------------------------------------------------------------
// Relacja / Zasoby / Ciągłość — stałe, pojedyncze linie.
// --------------------------------------------------------------------

function buildRelationshipLine(ctx) {
  if (ctx.conflictState === "critical" || ctx.conflictState === "fight") {
    return "Relacja przetrwała ten miesiąc, ale nie bez śladów, które będzie jeszcze czuć.";
  }
  if (ctx.modelFlags.has("low-clarity") || ctx.model.clarity < 45) {
    return "Niejasność pracowała ciszej niż konflikt — i dokładnie dlatego łatwo ją było przegapić.";
  }
  if (ctx.trust >= 60 && ctx.frustration <= 40) {
    return "Relacja nadal ma gdzie oddychać. Nie wszystko zostało nazwane, ale nic nie zostało też stłumione.";
  }
  return "Zaufanie nie pękło, ale nie wszystko ma już ten sam dźwięk co na początku miesiąca.";
}

function buildResourcesLine(ctx) {
  if (ctx.spoons <= 2 && ctx.fatigue >= 4) {
    return "Ciało kończy miesiąc z rachunkiem, który trzeba będzie w końcu spłacić, nie tylko odłożyć.";
  }
  if (ctx.fatigue >= 3) {
    return "Nie odzyskałeś/aś pełni sił, ale nauczyłeś/aś się nie wydawać wszystkiego naraz.";
  }
  return "Przetrwanie kosztowało więcej, niż kalendarz umie pokazać — ale rezerwa nie jest pusta.";
}

function buildContinuityLine(ctx) {
  const carryovers = [];

  if (ctx.activeMemoryCount > 0) {
    carryovers.push(ctx.activeMemoryCount === 1 ? "jedna niedomknięta sprawa" : "kilka niedomkniętych rozmów");
  }
  if (ctx.fatigue >= 3) {
    carryovers.push("zmęczenie");
  }
  if (ctx.model.clarity < 45) {
    carryovers.push("niejasność w ustaleniach");
  } else if (ctx.recentAlignment >= 2) {
    carryovers.push("jedna granica, która zaczęła działać");
  }
  if (ctx.hasScars) {
    carryovers.push("blizna, która jeszcze nie do końca zabliźniała");
  }
  if (ctx.workContext && ctx.workContext.pressure >= 50) {
    carryovers.push("presja pracy");
  }
  if (ctx.metamourContext && ctx.metamourContext.tension >= 40) {
    carryovers.push("napięcie w sieci relacji");
  }

  if (carryovers.length === 0) {
    return "Do kolejnego miesiąca nie przechodzi nic pilnego — tylko to, co zwykle przechodzi dalej, kiedy życie się toczy.";
  }

  const picked = carryovers.slice(0, 3);
  const joined = picked.length === 1
    ? picked[0]
    : `${picked.slice(0, -1).join(", ")} i ${picked[picked.length - 1]}`;

  return `Do kolejnego miesiąca przechodzi ${joined}.`;
}

// --------------------------------------------------------------------
// Kontekst — jeden odczyt stanu, używany przez outcome/sekcje/linie.
// --------------------------------------------------------------------

function buildMonthContext(state) {
  const fatigue = state.resources && state.resources.fatigue && typeof state.resources.fatigue.current === "number"
    ? state.resources.fatigue.current
    : 0;
  const spoons = state.resources && state.resources.spoons && typeof state.resources.spoons.current === "number"
    ? state.resources.spoons.current
    : 10;
  const maskingDebt = state.player && state.player.maskingDebt && typeof state.player.maskingDebt.current === "number"
    ? state.player.maskingDebt.current
    : 0;
  const npc = state.partner && state.npcs ? state.npcs[state.partner.id] || null : null;
  const trust = npc && typeof npc.trust === "number" ? npc.trust : 50;
  const frustration = npc && typeof npc.frustration === "number" ? npc.frustration : 0;
  const conflictState = state.partner && state.partner.conflict ? state.partner.conflict.state : "calm";

  const model = ensureRelationshipModelState(state) || { type: "polyamory", clarity: 60 };
  const modelConsequence = ensureRelationshipModelConsequenceState(state) || { recentFriction: 0, recentAlignment: 0 };
  const modelFlags = new Set();
  if (model.type === "ambiguous" || model.clarity < 45) modelFlags.add("low-clarity");

  const workContext = getWorkPressureContext(state);
  const metamourContext = getMetamourContext(state);
  const hasScars = hasRepairableScars(state) || (ensureRelationshipScarsState(state) || []).length > 0;

  const memories = getActiveNarrativeMemories(state);
  const memoryTypeCounts = {};
  for (const m of memories) {
    memoryTypeCounts[m.type] = (memoryTypeCounts[m.type] || 0) + 1;
  }

  const textureHistory = state.dayTexture && Array.isArray(state.dayTexture.history) ? state.dayTexture.history : [];
  const textureCount = (id) => textureHistory.filter((h) => h.id === id).length;

  return {
    fatigue, spoons, maskingDebt, trust, frustration, conflictState,
    model, modelFlags,
    recentFriction: modelConsequence.recentFriction || 0,
    recentAlignment: modelConsequence.recentAlignment || 0,
    workContext, metamourContext, hasScars,
    activeMemoryCount: memories.length,
    bodyMemoryCount: (memoryTypeCounts.body || 0) + (memoryTypeCounts.overextension || 0),
    restMemoryCount: memoryTypeCounts.rest || 0,
    metamourMemoryCount: memoryTypeCounts.metamour || 0,
    avoidanceMemoryCount: memoryTypeCounts.avoidance || 0,
    repairHonestyMemoryCount: (memoryTypeCounts.repair || 0) + (memoryTypeCounts.honesty || 0),
    bodyTextureCount: textureCount("body_tax"),
    workTextureCount: textureCount("work_squeeze"),
    networkTextureCount: textureCount("network_weather"),
    recoveryTextureCount: textureCount("recovery_window") + textureCount("body_tax"),
    quietPressureTextureCount: textureCount("quiet_pressure")
  };
}

// --------------------------------------------------------------------
// Punkt wejścia — buduje pełne podsumowanie miesiąca.
// --------------------------------------------------------------------

export function buildMonthSummary(state, monthNumber, criticalResult) {
  const ctx = buildMonthContext(state);
  const outcome = classifyMonthOutcome(ctx);
  const sections = buildCarryingSections(ctx);
  const criticalSection = buildCriticalEventSection(criticalResult);

  return {
    monthNumber,
    completedDay: criticalResult ? criticalResult.completedDay : state.day,
    outcome: { id: outcome.id, label: outcome.label },
    title: buildMonthTitle(monthNumber),
    subtitle: outcome.subtitle,
    outcomeText: outcome.text,
    sections,
    criticalSection,
    relationshipLine: buildRelationshipLine(ctx),
    resourcesLine: buildResourcesLine(ctx),
    continuityLine: buildContinuityLine(ctx)
  };
}

export function buildMonthOutcome(state) {
  return classifyMonthOutcome(buildMonthContext(state));
}

export function buildMonthContinuityLine(state) {
  return buildContinuityLine(buildMonthContext(state));
}
