// eveningScreen.js
//
// v0.9: evening recovery screen.
//
// v0.51: Contextual Evening Recovery. Wieczor pokazuje 3-4 opcje
// DOBRANE do stanu dnia (eveningRecoverySystem#getEveningRecoveryOptions
// jest teraz kontekstowy) + jedna linie ramujaca zalezna od stanu
// (buildEveningFrameLine). Karty dostaja klase typu
// oos-evening-card--{type} (style: css/contextual-evening-v0-51.css,
// paper-first, zgodne z .oos-game--evening). Flow, mechanika kliku
// (apply -> pattern -> advanceToNextDay -> save) NIETKNIETE — fatigue
// v0.49 rozlicza sie w advanceToNextDay dokladnie jak dotad.
// Flow:
//   morning -> event -> reflection -> evening -> next morning
//
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Jest 5 opcji wieczornych
// (eveningRecoveryData.js) — panel akcji dostaje wariant
// "evening-{liczba}", żeby CSS mogło dobrać odpowiednią siatkę (5
// równych kolumn w jednym rzędzie, jeśli mieszczą się na 1366px, w
// przeciwnym razie 3+2) BEZ ucinania tytułów.
//
// v0.19.1: Choice UX Polish. USUNIĘTE: widoczne "Spoons +3 · Frustracja
// -1" przed wyborem (dawna funkcja formatEffects). Karty pokazują teraz
// wyłącznie tytuł i istniejący opis z eveningRecoveryData.js — a te
// opisy już SĄ napisane jako flavor tekst decyzji (np. "Nie rozwiązuje
// wszystkiego, ale przynajmniej przestajesz dziś dokładać kolejne
// warstwy zmęczenia."), więc nie trzeba było niczego dopisywać.
// Mechaniczne efekty (applyEveningRecovery) nadal działają dokładnie
// tak samo — po prostu nie są już pokazywane przed kliknięciem.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
// v0.49: cache-bust — advanceToNextDay wykonuje teraz pełny cykl
// fatigue (rozliczenie końca dnia + nocna regeneracja minus dług).
import { advanceToNextDay } from "../../systems/dayCycle.js?v=570";
import { saveGame } from "../../state/saveManager.js";
import {
  getEveningRecoveryOptions,
  applyEveningRecovery,
  buildEveningFrameLine
} from "../../systems/eveningRecoverySystem.js?v=510";
import { shouldShowWeeklySummary } from "../../systems/weeklySummarySystem.js";
import { recordPatternFromEveningRecovery } from "../../systems/patternSystem.js";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createDecisionCard
} from "../oosLayout.js?v=530";

export function renderEveningScreen(container) {
  const state = getState();

  const topbar = createTopBar(state, "evening");
  const sidebar = createSidebar(state, "evening");

  const scene = createScenePanel({
    modifier: "evening",
    title: "Koniec dnia"
  });

  // v0.51: jedna linia ramujaca zalezna od stanu dnia (konwencja
  // spójna z buildMorningFrameLine z v0.50).
  const narrative = createNarrativeStrip(buildEveningFrameLine(state));

  const options = getEveningRecoveryOptions(state);
  const cards = options.map((option) => buildEveningCard(option, state));

  const shell = createGameShell({
    screenClass: "evening",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: cards,
    actionsVariant: `evening-${cards.length}`
  });

  container.appendChild(shell);
}

function buildEveningCard(option, state) {
  const card = createDecisionCard({
    title: replacePlaceholders(option.label, state),
    description: replacePlaceholders(option.description, state),
    onClick: () => {
      const currentState = getState();
      const completedDay = currentState.day;

      applyEveningRecovery(option.id, currentState);
      // v0.22: Pattern Foundation. Zapisuje wpis do historii wzorców z
      // tej decyzji wieczornej. state.lastEveningRecovery jest już
      // ustawiane przez eveningRecoverySystem.js (zero zmian w tym
      // module). Nie zmienia działania evening recovery.
      recordPatternFromEveningRecovery(currentState, currentState.lastEveningRecovery);
      advanceToNextDay();
      saveGame(currentState);

      if (shouldShowWeeklySummary(completedDay)) {
        showScreen("weeklySummary");
      } else {
        showScreen("game");
      }
    }
  });

  // v0.51: typ opcji jako klasa — wylacznie do stylowania (lewa linia
  // tuszu, patrz contextual-evening-v0-51.css). Zero debug UI.
  if (option.type) {
    card.className += ` oos-evening-card oos-evening-card--${option.type}`;
  }

  return card;
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  const metamourName = state.partner && state.partner.metamour && state.partner.metamour.name
    ? state.partner.metamour.name
    : "ta druga osoba";

  return text
    .replace(/\{partnerName\}/g, partnerName)
    .replace(/\{metamourName\}/g, metamourName);
}
