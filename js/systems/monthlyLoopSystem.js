// monthlyLoopSystem.js
//
// v0.30: Month One Complete Loop.
//
// Rozpoznaje domknięcie pierwszego miesięcznego cyklu po wyniku
// Wielkiego Testu i przygotowuje krótkie podsumowanie miesiąca.
// Nie zmienia mechaniki testu, saveVersion ani zasobów.

const FIRST_MONTH_NUMBER = 1;
const FIRST_MONTH_TARGET_DAY = 28;

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

export function evaluateMonthlyLoopAfterWeeklySummary(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  if (!monthlyLoop) {
    return null;
  }

  const lastCriticalResult = state.criticalEvent ? state.criticalEvent.lastResult : null;
  if (!lastCriticalResult || !lastCriticalResult.completedDay) {
    return null;
  }

  const alreadyCompleted = monthlyLoop.completedMonths.some(
    (entry) => entry.monthNumber === FIRST_MONTH_NUMBER
  );

  if (alreadyCompleted || monthlyLoop.lastSummaryShownForMonth === FIRST_MONTH_NUMBER) {
    return null;
  }

  if (lastCriticalResult.completedDay < FIRST_MONTH_TARGET_DAY) {
    return null;
  }

  const summary = buildMonthSummary(state, lastCriticalResult);
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

export function buildMonthSummary(state, criticalResult) {
  const log = Array.isArray(state.log) ? state.log : [];
  const upperDay = Math.max(28, state.day || 28);
  const monthLog = log.filter((entry) => entry.day >= 1 && entry.day <= upperDay);

  const repairCount = monthLog.filter(
    (entry) => entry.relationshipRepairEffect && entry.relationshipRepairEffect.applied
  ).length;

  const scarCount = state.partner && Array.isArray(state.partner.scars)
    ? state.partner.scars.length
    : 0;

  const metamourCount = monthLog.filter(
    (entry) => entry.metamourEffect && entry.metamourEffect.applied
  ).length;

  const workCount = monthLog.filter(
    (entry) => entry.workEffect && entry.workEffect.applied
  ).length;

  const patternCount = state.patterns && Array.isArray(state.patterns.active)
    ? state.patterns.active.length
    : 0;

  const outcome = criticalResult && criticalResult.success ? "success" : "failure";

  return {
    monthNumber: FIRST_MONTH_NUMBER,
    completedDay: criticalResult ? criticalResult.completedDay : state.day,
    outcome,
    title: outcome === "success" ? "Pierwszy miesiąc nie rozpadł się" : "Pierwszy miesiąc zostawił ślad",
    body: buildBodyText(outcome, repairCount, scarCount, workCount, metamourCount),
    stats: {
      decisions: monthLog.length,
      repairs: repairCount,
      scars: scarCount,
      metamourMoments: metamourCount,
      workMoments: workCount,
      activePatterns: patternCount
    }
  };
}

export function getMonthlyLoopDebugSummary(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  if (!monthlyLoop) {
    return null;
  }

  return {
    completedMonths: monthlyLoop.completedMonths,
    pendingSummary: monthlyLoop.pendingSummary,
    lastSummaryShownForMonth: monthlyLoop.lastSummaryShownForMonth,
    latest: getLatestMonthSummary(state)
  };
}

export function forceMonthSummaryPending(state) {
  const monthlyLoop = ensureMonthlyLoopState(state);
  if (!monthlyLoop) {
    return null;
  }

  const criticalResult =
    state.criticalEvent && state.criticalEvent.lastResult
      ? state.criticalEvent.lastResult
      : {
          completedDay: Math.max(28, state.day || 28),
          success: true
        };

  const summary = buildMonthSummary(state, criticalResult);
  monthlyLoop.pendingSummary = summary;

  const exists = monthlyLoop.completedMonths.some(
    (entry) => entry.monthNumber === summary.monthNumber
  );
  if (!exists) {
    monthlyLoop.completedMonths.push(summary);
  }

  return summary;
}

function buildBodyText(outcome, repairCount, scarCount, workCount, metamourCount) {
  const fragments = [];

  if (outcome === "success") {
    fragments.push("Nie dlatego, że wszystko było lekkie. Raczej dlatego, że nie wszystko zostało zostawione bez odpowiedzi.");
  } else {
    fragments.push("Nie jako kara. Bardziej jako zapis tego, ile małych kosztów da się schować, zanim zaczną mówić własnym językiem.");
  }

  if (repairCount > 0) {
    fragments.push("Coś zostało naprawione nie przez wielki gest, tylko przez powrót do trudnego miejsca.");
  }

  if (scarCount > 0) {
    fragments.push("Część decyzji nie zniknęła po evencie. Została w relacji jako pamięć.");
  }

  if (metamourCount > 0) {
    fragments.push("Relacja częściej była siecią niż linią między dwiema osobami.");
  }

  if (workCount > 0) {
    fragments.push("Praca nie była tylko tłem. Kilka razy usiadła przy stole bez zaproszenia.");
  }

  return fragments.join(" ");
}
