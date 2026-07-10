// weeklySummarySystem.js
//
// v0.11: weekly summary logic.
// This module only reads existing state and aggregates existing log entries.
// It does not create or store new state.

export function shouldShowWeeklySummary(completedDay) {
  return completedDay > 0 && completedDay % 7 === 0;
}

export function buildWeeklySummary(state) {
  const endDay = state.day - 1;
  const startDay = Math.max(1, endDay - 6);
  const weekNumber = Math.ceil(endDay / 7);

  const entries = Array.isArray(state.log)
    ? state.log.filter((entry) => entry.day >= startDay && entry.day <= endDay)
    : [];

  const totals = sumConsequences(entries);
  const npc = state.partner && state.npcs ? state.npcs[state.partner.id] : null;
  const mood = npc ? buildRelationshipMood(npc) : null;

  const summary = {
    weekNumber,
    startDay,
    endDay,
    eventCount: entries.length,

    spoonsChange: totals.spoonsChange,
    trustChange: totals.trustChange,
    frustrationChange: totals.frustrationChange,
    fatigueChange: totals.fatigueChange,
    hasFatigueData: totals.hasFatigueData,

    currentSpoons: state.resources.spoons.current,
    maxSpoons: state.resources.spoons.max,
    currentTrust: npc ? npc.trust : null,
    currentFrustration: npc ? npc.frustration : null,
    relationshipMoodLabel: mood ? mood.label : null,
    relationshipMoodDescription: mood ? mood.description : null
  };

  summary.summaryText = buildSummaryText(summary);

  return summary;
}

function sumConsequences(entries) {
  const totals = {
    spoonsChange: 0,
    trustChange: 0,
    frustrationChange: 0,
    fatigueChange: 0,
    hasFatigueData: false
  };

  entries.forEach((entry) => {
    if (!entry.consequences) {
      return;
    }

    const consequences = entry.consequences;

    totals.spoonsChange += Number(consequences.spoonsChange) || 0;
    totals.trustChange += Number(consequences.trustChange) || 0;
    totals.frustrationChange += Number(consequences.frustrationChange) || 0;

    if (typeof consequences.fatigueChange === "number") {
      totals.fatigueChange += consequences.fatigueChange;
      totals.hasFatigueData = true;
    }
  });

  return totals;
}

function buildSummaryText(summary) {
  if (summary.frustrationChange >= 10) {
    return "Ten tydzień zostawił w relacji więcej napięcia niż odpowiedzi. Nie wszystko pękło, ale coś zaczęło wymagać ostrożniejszego dotyku.";
  }

  if (summary.trustChange >= 8) {
    return "Ten tydzień nie był lekki, ale kilka decyzji zbudowało więcej bezpieczeństwa niż było go na początku.";
  }

  if (summary.spoonsChange <= -12) {
    return "Ten tydzień kosztował dużo pojemności. Nie jako jedna wielka katastrofa, raczej jako suma małych obciążeń, które przestały być małe.";
  }

  return "To nie był tydzień spektakularnych rozstrzygnięć. Raczej siedem dni drobnych kosztów, małych ulg i decyzji, które zaczynają układać się w wzór.";
}

function buildRelationshipMood(npc) {
  const trust = clampToPercentage(Number(npc.trust) || 0);
  const frustration = clampToPercentage(Number(npc.frustration) || 0);

  if (trust >= 70 && frustration <= 25) {
    return {
      label: "Bezpiecznie",
      description: "W tej relacji jest dużo zaufania i niewiele napięcia."
    };
  }

  if (trust >= 50 && frustration <= 45) {
    return {
      label: "Stabilnie",
      description: "Relacja trzyma się dobrze, choć nadal wymaga uważności."
    };
  }

  if (frustration >= 70 && trust >= 40) {
    return {
      label: "Napięcie",
      description: "Zaufanie jeszcze istnieje, ale napięcie zaczyna dominować."
    };
  }

  if (trust < 35 && frustration >= 55) {
    return {
      label: "Krucho",
      description: "Relacja może źle znosić kolejne uniki albo niejasne sygnały."
    };
  }

  if (trust < 35) {
    return {
      label: "Niepewnie",
      description: "W relacji brakuje poczucia bezpieczeństwa."
    };
  }

  if (frustration >= 55) {
    return {
      label: "Przeciążenie",
      description: "Nagromadzone napięcie zaczyna być trudne do ignorowania."
    };
  }

  return {
    label: "Niejasno",
    description: "Relacja jest w ruchu. Jeszcze nie wiadomo, w którą stronę pójdzie."
  };
}

function clampToPercentage(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
