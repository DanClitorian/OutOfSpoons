// agendaScreen.js
//
// v0.14: Choose Agenda Order.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js).
// v0.19: Weekly Stakes — teaser aktywnego wyzwania w narracji.
//
// v0.19.1: Choice UX Polish. Karty agendy NIE pokazują już Ryzyka ani
// Napięcia (buildSlotPressure/buildSlotRiskLabel/buildSlotOrderHint
// zostały usunięte razem z całą tą warstwą) — to były przewidywane
// efekty mechaniczne, a wybór ma wyglądać jak decyzja/dialog, nie jak
// kalkulator. Karta pokazuje tylko: ikonę, tytuł, status (wybierz /
// ukończone) i krótki opis tonu decyzji.
//
// The player chooses which remaining daily agenda slot to handle next.
//
// v0.26: Repair Events. Ten plik NIE ZMIENIŁ SIĘ funkcjonalnie — nowe
// eventy naprawcze i ich ważenie nie mają osobnego UI na agendzie
// (zwykłe karty slotów). Import dayAgendaSystem.js dostał ?v=260, bo
// dayAgendaSystem.js zmienił WŁASNE importy eventData.js/
// eventWeightSystem.js (oba faktycznie zmieniły zawartość) — a to
// WŁAŚNIE TEN plik (przez ensureDailyAgenda) faktycznie wybiera event
// dla każdego slotu agendy, więc jego świeżość jest krytyczna dla
// realnego działania ważenia eventów naprawczych, nie tylko kosmetyczna.
//
// v0.31: Content Expansion Pack 1. dayAgendaSystem.js znowu zmienił
// WŁASNY import eventData.js (9 nowych eventów) — import podbity do
// ?v=310. Przy okazji naprawiony zaległy, przestarzały ?v=260 (ten
// import nie był bustowany od v0.26, mimo że dayAgendaSystem.js
// zmieniał się od tamtej pory kilkukrotnie — czysta korekta, zero
// zmian funkcjonalnych tego ekranu).
//
// v0.32: Game Feel / Daily Stakes Pass. Mały badge napięcia dnia
// (label + jedno zdanie, ZERO liczb) wstawiony jako PIERWSZY element
// WEWNĄTRZ istniejącej sekcji .oos-narrative (przed paragrafem tekstu)
// — NIE jako nowe dziecko .oos-stage ani .oos-game, więc główny grid
// v0.18 zostaje całkowicie nietknięty. Stylowanie w osobnym, nowym
// pliku css/daily-stakes-v0-32.css, scope'owanym do
// body[data-game-screen="agenda"], więc nie wpływa na żaden inny ekran.
//
// v0.34: Relationship Model Foundation. Linia modelu relacji dodana do
// NARRACJI agendy (buildAgendaNarrative), NIE do karty relationship
// slotu — świadomy wybór: teksty modelu relacji są dłuższe niż
// standardowe, krótkie opisy kart (SLOT_DESCRIPTIONS), a wszystkie 3
// karty muszą zachować spójną wysokość. Narracja już ma miejsce na
// zmienną długość tekstu (patrz Weekly Stake teaser powyżej), więc to
// zero dodatkowego ryzyka strukturalnego, zgodnie z instrukcją
// ticketu ("jeśli to zbyt ryzykowne strukturalnie, dodaj tylko do
// narracji agendy, nie do kart").

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureDailyAgenda,
  getAvailableAgendaItems,
  selectAgendaItem,
  getAgendaSlotLabel
} from "../../systems/dayAgendaSystem.js?v=601";
import {
  ensureWeeklyChallengeState,
  getCurrentWeeklyChallenge,
  buildWeeklyChallengeNarrativeHint
} from "../../systems/weeklyChallengeSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js?v=530";
import { buildAgendaStakesBadge } from "../../systems/dailyStakesSystem.js?v=601";
import { ensureRelationshipModelState, buildRelationshipModelAgendaLine } from "../../systems/relationshipModelSystem.js?v=340";

const SLOT_ICONS = {
  obligation: "📌",
  relationship: "💬",
  inner: "🧠"
};

const SLOT_DESCRIPTIONS = {
  obligation: "Sprawy, które i tak trzeba załatwić.",
  relationship: "Bliskość i napięcie między Tobą a partnerem.",
  inner: "To, jak się dziś czujesz i ile jeszcze masz w sobie."
};

export function renderAgendaScreen(container) {
  const state = getState();
  const agenda = ensureDailyAgenda(state);
  const availableItems = getAvailableAgendaItems(state);

  if (availableItems.length === 0) {
    state.phase = "evening";
    saveGame(state);
    showScreen("evening");
    return;
  }

  // v0.34: Relationship Model Foundation. Wyłącznie lazy-init — brak
  // dziennego przeliczenia/rolla, patrz komentarz w gameScreen.js.
  ensureRelationshipModelState(state);

  const topbar = createTopBar(state, "agenda");
  const sidebar = createSidebar(state, "agenda");

  const scene = createScenePanel({
    modifier: "agenda",
    title: "Plan dnia"
  });

  const narrative = createNarrativeStrip(buildAgendaNarrative(state, availableItems));

  // v0.32: Game Feel / Daily Stakes Pass. Badge wstawiony jako
  // PIERWSZE dziecko WEWNĄTRZ .oos-narrative (przed paragrafem tekstu)
  // — nie dodaje nowego dziecka do .oos-stage/.oos-game, więc grid
  // v0.18 pozostaje nietknięty.
  const stakesBadgeEl = buildStakesBadgeElement(state);
  if (stakesBadgeEl) {
    narrative.insertBefore(stakesBadgeEl, narrative.firstChild);
  }

  const cards = agenda.slots.map((item, index) => buildAgendaCard(item, index, state));

  const shell = createGameShell({
    screenClass: "agenda",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "triple"
  });

  container.appendChild(shell);
}

// v0.19: Weekly Stakes. Krótki teaser aktywnego wyzwania — jak w
// gameScreen.js, drugie zdanie w tym samym akapicie narracji, bez
// nowych elementów DOM ani zmian w layoucie v0.18.
//
// v0.19.1: separator warunków zamieniony na "·" (zamiast " i ") tylko
// w tym miejscu — trochę krócej, mniejsze ryzyko ucinania długiego
// teasera w wąskim pasku narracji. weeklySummaryScreen.js nadal używa
// pełnego " i " (tam jest więcej miejsca).
//
// v0.34: Relationship Model Foundation. Jeśli slot "relationship" jest
// dziś JESZCZE DOSTĘPNY (nieukończony), dopisujemy jedno zdanie o
// modelu relacji na końcu — znika samo, gdy gracz już zajmie się
// relationship slotem tego dnia, więc nie robi się nachalne po fakcie.
function buildAgendaNarrative(state, availableItems) {
  const base = "Wybierz, czym zajmiesz się teraz. Kolejność ma znaczenie.";

  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  let text = base;
  if (challenge) {
    const hint = buildWeeklyChallengeNarrativeHint(challenge);
    text = `${base} W tle wisi: ${challenge.title}. ${hint}`;
  }

  const hasOpenRelationshipSlot = Array.isArray(availableItems) && availableItems.some((item) => item.slot === "relationship");
  if (hasOpenRelationshipSlot) {
    const relationshipModelLine = buildRelationshipModelAgendaLine(state);
    if (relationshipModelLine) {
      text = `${text} ${relationshipModelLine}`;
    }
  }

  return text;
}

function buildAgendaCard(item, index, state) {
  return createDecisionCard({
    icon: item.completed ? "✓" : SLOT_ICONS[item.slot] || "•",
    title: getAgendaSlotLabel(item.slot),
    statusText: item.completed ? "ukończone" : "wybierz",
    description: SLOT_DESCRIPTIONS[item.slot] || "",
    disabled: item.completed,
    onClick: () => {
      selectAgendaItem(state, index);
      saveGame(state);
      showScreen("event");
    }
  });
}

// v0.32: Game Feel / Daily Stakes Pass. Mały, namespaced badge
// (.oos-daily-stakes) — TYLKO label + jedno zdanie, ZERO liczb, ZERO
// listy powodów. Zwraca null, jeśli z jakiegoś powodu nie da się
// zbudować (bezpiecznik — agenda ma wtedy wyglądać dokładnie tak jak
// przed v0.32).
function buildStakesBadgeElement(state) {
  const badge = buildAgendaStakesBadge(state);
  if (!badge) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = `oos-daily-stakes oos-daily-stakes--${badge.level}`;

  const labelEl = document.createElement("span");
  labelEl.className = "oos-daily-stakes__label";
  labelEl.textContent = badge.label;
  wrapper.appendChild(labelEl);

  const textEl = document.createElement("span");
  textEl.className = "oos-daily-stakes__text";
  textEl.textContent = badge.text;
  wrapper.appendChild(textEl);

  return wrapper;
}
