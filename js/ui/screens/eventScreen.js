// eventScreen.js
//
// Daily event screen.
// v0.8:
// - shows current spoons before choices,
// - disables choices that cost more spoons than the player has,
// - if every choice is too expensive, keeps the cheapest one clickable
//   as the final available option,
// - replaces {partnerName} in title, description and choice labels.
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js).
//
// v0.19.1: Choice UX Polish. Wcześniej (v0.16-v0.19) karty pokazywały
// jakościowy "Koszt: niskie/średnie/wysokie · Niepewność: ..." przed
// wyborem. To USUNIĘTE — wybór ma wyglądać jak decyzja/dialog, nie jak
// kalkulator mechaniki. Jedyne, co karta może pokazać przed kliknięciem,
// to dostępność (statusText: "niedostępne teraz" / "ostatnia dostępna
// opcja") — to nie jest przewidywanie efektu, tylko stan wyboru.
// choice availability by spoons (blokowanie zbyt drogich wyborów,
// forced cheapest choice) NADAL działa dokładnie tak samo — zmienia się
// tylko to, co widać, nie logika dostępności ani mechanika konsekwencji.
//
// v0.24/v0.25: Pattern Pressure i Relationship Scars działają WYŁĄCZNIE
// wewnątrz eventSystem.js#applyChoice, PO kliknięciu — ten plik
// funkcjonalnie się nie zmienił od v0.23. Import dayCycle.js dostał
// ?v=250 w v0.25, bo dayCycle.js zmienił WŁASNY import eventSystem.js
// (które faktycznie zmieniło zawartość) — to czysty cache-bust w dół
// łańcucha, żeby przeglądarka nigdy nie uruchomiła starego, cache'owanego
// dayCycle.js wskazującego na stare eventSystem.js. Dostępność kart
// nadal liczona jest wyłącznie na surowym choice.spoonsCost.
//
// v0.26: Repair Events. Ten plik CELOWO NIE importuje
// relationshipRepairSystem.js — repair działa wyłącznie wewnątrz
// eventSystem.js#applyChoice, PO kliknięciu, dokładnie jak Pattern
// Pressure i Relationship Scars. Importy dayCycle.js i
// dayAgendaSystem.js dostały ?v=260, bo oba zmieniły WŁASNE importy w
// dół łańcucha (eventSystem.js / eventData.js / eventWeightSystem.js).
//
// v0.27: The Static. Krótka linia szumu dopisywana do narracji eventu,
// TYLKO jeśli intensity >= 2 (patrz staticSystem.js — czyste odczyty,
// zero wpływu na dostępność kart czy tekst wyborów). Static jest
// liczony raz dziennie w gameScreen.js — tu tylko go CZYTAMY.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js?v=260";
import { getCurrentAgendaProgress } from "../../systems/dayAgendaSystem.js?v=260";
import { getPartnerCapacityContext } from "../../systems/partnerCapacitySystem.js";
import { buildEventStaticLine } from "../../systems/staticSystem.js?v=270";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();
  const currentSpoons = state.resources.spoons.current;
  const progress = getCurrentAgendaProgress(state);

  const topbar = createTopBar(
    state,
    "event",
    `Wydarzenie ${progress.current}/${progress.total} — ${progress.label}`
  );
  const sidebar = createSidebar(state, "event");

  const scene = createScenePanel({
    modifier: "event",
    title: replacePlaceholders(event.title, state)
  });

  const narrative = createNarrativeStrip(buildEventNarrative(event, state));

  const anyAffordable = event.choices.some((choice) => choice.spoonsCost <= currentSpoons);
  const forcedChoice = anyAffordable ? null : getCheapestChoice(event.choices);

  const cards = event.choices.map((choice) => buildChoiceCard(choice, state, currentSpoons, forcedChoice));

  const shell = createGameShell({
    screenClass: "event",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: "flow"
  });

  container.appendChild(shell);
}

function buildChoiceCard(choice, state, currentSpoons, forcedChoice) {
  const isForced = forcedChoice !== null && choice.id === forcedChoice.id;
  const canAfford = choice.spoonsCost <= currentSpoons;
  const isDisabled = !canAfford && !isForced;

  return createDecisionCard({
    title: replacePlaceholders(choice.label, state),
    statusText: isDisabled ? "niedostępne teraz" : isForced ? "ostatnia dostępna opcja" : null,
    disabled: isDisabled,
    onClick: () => {
      resolveEvent(choice.id);
      showScreen("reflection");
    }
  });
}

function getCheapestChoice(choices) {
  return choices.reduce((cheapest, choice) =>
    choice.spoonsCost < cheapest.spoonsCost ? choice : cheapest
  );
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

// v0.23: Partner Capacity Foundation. Jeśli aktualny event jest
// relacyjny (agendaSlots zawiera "relationship") i partner ma dziś
// niski capacity, dopisujemy JEDNO zdanie kontekstu do narracji eventu.
// Zero liczb, zero zmiany kart wyboru — tylko dodatkowa "temperatura"
// tekstu, dokładnie jak w specyfikacji.
//
// v0.27: The Static. Linia szumu dopisywana NIEZALEŻNIE od typu eventu
// (nie tylko relacyjnych — szum to sprawa gracza, nie partnera), TYLKO
// jeśli intensity >= 2. Dopisywana jako ostatnia, po ewentualnej
// notatce o partnerze.
function buildEventNarrative(event, state) {
  const base = replacePlaceholders(event.description, state);
  const isRelationshipEvent = Array.isArray(event.agendaSlots) && event.agendaSlots.includes("relationship");

  const partnerNote = isRelationshipEvent ? buildPartnerCapacityNote(state) : null;
  const staticLine = buildEventStaticLine(state, event);

  const parts = [base, partnerNote, staticLine].filter(Boolean);
  return parts.join(" ");
}

function buildPartnerCapacityNote(state) {
  const context = getPartnerCapacityContext(state);
  const partnerName = state.partner ? state.partner.name : "Partner";

  if (context.isCritical) {
    return `${partnerName} jest dziś dostępny/a tylko częściowo. To zmienia temperaturę rozmowy.`;
  }

  if (context.isLow) {
    return "Widać, że ta rozmowa nie trafia w pustą przestrzeń. Trafia w kogoś, kto też jest zmęczony.";
  }

  return null;
}
