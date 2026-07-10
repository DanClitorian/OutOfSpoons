// gameHud.js
//
// v0.15: RPG Gameplay Shell.
//
// Globalny HUD dodawany automatycznie przez uiManager.js na wszystkich
// ekranach gameplayowych (nie na menu głównym ani w kreatorze postaci).
// Ma dawać graczowi stały widok na to, kim jest, jaki jest dzień/faza,
// ile ma zasobów i jaki jest stan relacji z partnerem — feedback
// testerów mówił, że gra wygląda jak quiz, bo statystyki nie są stale
// widoczne. Ten moduł to naprawia, nie zmieniając żadnej mechaniki gry.
//
// UWAGA: logika "stanu emocjonalnego relacji" (buildRelationshipMood)
// jest tu celowo zduplikowana z js/ui/screens/gameScreen.js zamiast
// importowana stamtąd — uiManager.js już importuje gameScreen.js, więc
// dodatkowy import z powrotem do gameScreen.js pogłębiałby istniejący
// cykl importów (gameScreen.js <-> uiManager.js). Jeśli progi nastroju
// relacji się kiedyś zmienią, trzeba zaktualizować obie kopie.

import { getState } from "../state/gameState.js";

const HUD_VISIBLE_SCREENS = new Set([
  "game",
  "morning",
  "agenda",
  "event",
  "reflection",
  "evening",
  "weeklySummary"
]);

const SCREEN_PHASE_LABELS = {
  game: "Poranek",
  morning: "Poranek",
  agenda: "Plan dnia",
  event: "Wydarzenie",
  reflection: "Refleksja",
  evening: "Wieczór",
  weeklySummary: "Podsumowanie tygodnia"
};

/**
 * Dołącza globalny HUD na początku kontenera ekranu (nad kartą ekranu),
 * jeśli aktualny ekran jest ekranem gameplayowym i istnieje aktywna gra
 * z graczem. Bezpieczne do wywołania na każdym ekranie — samo decyduje,
 * czy ma się pokazać.
 */
export function appendGameHud(container, screenName) {
  if (!container || !HUD_VISIBLE_SCREENS.has(screenName)) {
    return;
  }

  const state = getState();
  if (!state || !state.player) {
    return;
  }

  const hud = buildHud(state, screenName);
  container.insertBefore(hud, container.firstChild);
}

function buildHud(state, screenName) {
  const hud = document.createElement("div");
  hud.className = "gameplay-hud";

  hud.appendChild(buildMainSection(state, screenName));
  hud.appendChild(buildStatsSection(state));

  const npc = getPartnerNpc(state);
  if (npc) {
    hud.appendChild(buildRelationshipSection(npc));
  }

  const dayProgress = buildDayProgress(state);
  if (dayProgress) {
    hud.appendChild(dayProgress);
  }

  return hud;
}

function buildMainSection(state, screenName) {
  const main = document.createElement("div");
  main.className = "gameplay-hud-main";

  const name = document.createElement("p");
  name.className = "gameplay-hud-name";
  name.textContent = state.player.name;
  main.appendChild(name);

  const meta = document.createElement("p");
  meta.className = "gameplay-hud-meta";
  meta.textContent = `Dzień ${state.day} · ${getPhaseLabel(screenName)}`;
  main.appendChild(meta);

  return main;
}

function getPhaseLabel(screenName) {
  return SCREEN_PHASE_LABELS[screenName] || "";
}

function getPartnerNpc(state) {
  if (!state.partner || !state.npcs) {
    return null;
  }

  return state.npcs[state.partner.id] || null;
}

function buildStatsSection(state) {
  const stats = document.createElement("div");
  stats.className = "gameplay-hud-stats";

  const spoons = state.resources ? state.resources.spoons : null;
  if (spoons) {
    stats.appendChild(
      buildStatBar("Spoons", `${spoons.current}/${spoons.max}`, percentage(spoons.current, spoons.max), "spoons")
    );
  }

  return stats;
}

function buildStatBar(label, valueText, percent, modifier) {
  const stat = document.createElement("div");
  stat.className = "gameplay-hud-stat";

  const labelRow = document.createElement("div");
  labelRow.className = "gameplay-hud-label";

  const labelText = document.createElement("span");
  labelText.textContent = label;
  labelRow.appendChild(labelText);

  const valueEl = document.createElement("span");
  valueEl.className = "gameplay-hud-value";
  valueEl.textContent = valueText;
  labelRow.appendChild(valueEl);

  stat.appendChild(labelRow);

  const bar = document.createElement("div");
  bar.className = "gameplay-hud-bar";

  const fill = document.createElement("div");
  fill.className = `gameplay-hud-bar-fill gameplay-hud-bar-fill--${modifier}`;
  fill.style.width = `${percent}%`;
  bar.appendChild(fill);

  stat.appendChild(bar);

  return stat;
}

function buildRelationshipSection(npc) {
  const section = document.createElement("div");
  section.className = "gameplay-hud-relationship";

  section.appendChild(
    buildStatBar("Zaufanie", `${clampPercent(npc.trust)}`, clampPercent(npc.trust), "trust")
  );
  section.appendChild(
    buildStatBar("Frustracja", `${clampPercent(npc.frustration)}`, clampPercent(npc.frustration), "frustration")
  );

  const mood = buildRelationshipMoodLabel(npc);
  const moodLine = document.createElement("p");
  moodLine.className = "gameplay-hud-mood";
  moodLine.textContent = `Relacja: ${mood}`;
  section.appendChild(moodLine);

  return section;
}

// Duplikat progów z gameScreen.js#buildRelationshipMood — patrz komentarz
// na górze pliku, dlaczego to nie jest współdzielony import.
function buildRelationshipMoodLabel(npc) {
  const trust = clampPercent(npc.trust);
  const frustration = clampPercent(npc.frustration);

  if (trust >= 70 && frustration <= 25) {
    return "Bezpiecznie";
  }

  if (trust >= 50 && frustration <= 45) {
    return "Stabilnie";
  }

  if (frustration >= 70 && trust >= 40) {
    return "Napięcie";
  }

  if (trust < 35 && frustration >= 55) {
    return "Krucho";
  }

  if (trust < 35) {
    return "Niepewnie";
  }

  if (frustration >= 55) {
    return "Przeciążenie";
  }

  return "Niejasno";
}

function buildDayProgress(state) {
  if (!state.dailyAgenda || !Array.isArray(state.dailyAgenda.slots)) {
    return null;
  }

  const total = state.dailyAgenda.slots.length;
  const completed = state.dailyAgenda.slots.filter((item) => item.completed).length;

  const progress = document.createElement("p");
  progress.className = "gameplay-hud-day-progress";
  progress.textContent = `Dzień: ${completed}/${total} wydarzeń`;
  return progress;
}

function percentage(current, max) {
  if (!max) {
    return 0;
  }

  return clampPercent((current / max) * 100);
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}
