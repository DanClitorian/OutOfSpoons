# ============================================================================
# OUT OF SPOONS - skrypt instalacyjny v0.1
#
# Tworzy pelna strukture folderow oraz wszystkie pliki prototypu gry.
# Uruchom ten skrypt z wnetrza folderu C:\OutOfSpoons w PowerShell:
#
#   cd C:\OutOfSpoons
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#
# (Jesli PowerShell blokuje uruchamianie skryptow, powyzsza flaga
# -ExecutionPolicy Bypass omija to tylko dla tego jednego uruchomienia.)
# ============================================================================

Write-Host "Tworzenie struktury folderow..." -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path "css" | Out-Null
New-Item -ItemType Directory -Force -Path "js\state" | Out-Null
New-Item -ItemType Directory -Force -Path "js\systems" | Out-Null
New-Item -ItemType Directory -Force -Path "js\data" | Out-Null
New-Item -ItemType Directory -Force -Path "js\ui" | Out-Null
New-Item -ItemType Directory -Force -Path "js\ui\screens" | Out-Null

Write-Host "Tworzenie plikow..." -ForegroundColor Cyan

Write-Host "  -> index.html"
@'
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Out of Spoons</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <!-- Cała gra renderuje się wewnątrz tego kontenera. -->
  <!-- UI Manager podmienia jego zawartość w zależności od aktywnego ekranu. -->
  <div id="app"></div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
'@ | Set-Content -Encoding UTF8 "index.html"

Write-Host "  -> css\style.css"
@'
/* ==========================================================================
   OUT OF SPOONS — style v0.1

   Paleta i typografia celowo unikają "domyślnego AI wyglądu"
   (kremowe tło + serif + terakota). Zamiast tego: przygaszony,
   papierowy dziennik — spokojna, introspekcyjna estetyka pasująca
   do gry o zarządzaniu ograniczoną pojemnością człowieka.
   ========================================================================== */

:root {
  /* Kolory */
  --color-ink: #2B2A28;        /* tekst główny, ciepła prawie-czerń */
  --color-paper: #E7E2D8;      /* tło strony */
  --color-panel: #F2EEE6;      /* karta / panel treści */
  --color-line: #C9C2B3;       /* linie, obramowania */
  --color-muted: #6B665C;      /* tekst pomocniczy */
  --color-sage: #5C7266;       /* akcent — spokój, regeneracja */
  --color-rose: #AD6656;       /* akcent — koszt, ostrzeżenie */
  --color-gold: #BE9A3D;       /* wypełnione spoons */

  /* Typografia */
  --font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  --font-body: "Segoe UI", "Helvetica Neue", Arial, sans-serif;

  /* Odstępy */
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
}

* {
  box-sizing: border-box;
}

html, body {
  height: 100%;
}

body {
  margin: 0;
  background-color: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.6;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding: var(--space-xl) var(--space-md);
}

#app {
  width: 100%;
  max-width: 560px;
}

/* --------------------------------------------------------------------
   Karta ekranu (efekt "strony dziennika")
   -------------------------------------------------------------------- */

.screen {
  background-color: var(--color-panel);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-lg);
  box-shadow: 0 1px 3px rgba(43, 42, 40, 0.08);
  animation: fadeIn 0.35s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .screen {
    animation: none;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

h1, h2 {
  font-family: var(--font-display);
  font-weight: 400;
  margin: 0 0 var(--space-md) 0;
  color: var(--color-ink);
}

h1 {
  font-size: 2rem;
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-sm);
}

h2 {
  font-size: 1.5rem;
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-sm);
}

.subtitle {
  color: var(--color-muted);
  font-style: italic;
  margin-top: -0.5rem;
  margin-bottom: var(--space-lg);
}

p {
  margin: 0 0 var(--space-md) 0;
}

.npc-message {
  background-color: var(--color-paper);
  border-left: 3px solid var(--color-sage);
  padding: var(--space-md);
  border-radius: 2px;
}

.reflection-text {
  background-color: var(--color-paper);
  border-left: 3px solid var(--color-gold);
  padding: var(--space-md);
  border-radius: 2px;
}

.spoons-summary {
  color: var(--color-muted);
}

/* --------------------------------------------------------------------
   Licznik spoons — element sygnaturowy interfejsu.
   Każda "łyżeczka" rysowana jest czystym CSS: owalna miseczka + trzonek.
   -------------------------------------------------------------------- */

.spoons-meter {
  margin: var(--space-md) 0 var(--space-lg) 0;
}

.spoons-label {
  display: block;
  font-family: var(--font-display);
  font-size: 1.1rem;
  margin-bottom: var(--space-sm);
}

.spoons-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.spoon {
  display: inline-block;
  position: relative;
  width: 14px;
  height: 22px;
}

.spoon::before {
  content: "";
  position: absolute;
  top: 0;
  left: 3px;
  width: 8px;
  height: 12px;
  border-radius: 50%;
  background: currentColor;
}

.spoon::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 6px;
  width: 2px;
  height: 11px;
  background: currentColor;
}

.spoon.full {
  color: var(--color-gold);
}

.spoon.empty {
  color: var(--color-line);
}

/* --------------------------------------------------------------------
   Przyciski
   -------------------------------------------------------------------- */

button {
  font-family: var(--font-body);
  font-size: 1rem;
  cursor: pointer;
  border-radius: 3px;
  padding: 0.7rem 1.2rem;
  border: 1px solid transparent;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

button:focus-visible {
  outline: 2px solid var(--color-sage);
  outline-offset: 2px;
}

.primary-button {
  display: block;
  width: 100%;
  background-color: var(--color-ink);
  color: var(--color-panel);
  margin-top: var(--space-md);
}

.primary-button:hover {
  background-color: var(--color-sage);
}

.secondary-button {
  display: block;
  width: 100%;
  background-color: transparent;
  color: var(--color-ink);
  border-color: var(--color-line);
  margin-top: var(--space-sm);
}

.secondary-button:hover {
  border-color: var(--color-sage);
  color: var(--color-sage);
}

/* --------------------------------------------------------------------
   Wybory w wydarzeniu decyzyjnym
   -------------------------------------------------------------------- */

.choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.choice-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  text-align: left;
  background-color: var(--color-paper);
  border-color: var(--color-line);
  color: var(--color-ink);
}

.choice-button:hover {
  border-color: var(--color-ink);
  background-color: var(--color-panel);
}

.choice-label {
  font-weight: 600;
}

.choice-cost {
  flex-shrink: 0;
  font-size: 0.85rem;
  color: var(--color-rose);
  white-space: nowrap;
}

/* --------------------------------------------------------------------
   Responsywność
   -------------------------------------------------------------------- */

@media (max-width: 480px) {
  body {
    padding: var(--space-md);
  }

  .screen {
    padding: var(--space-md);
  }

  h1 {
    font-size: 1.6rem;
  }

  .choice-button {
    flex-direction: column;
    align-items: flex-start;
  }
}
'@ | Set-Content -Encoding UTF8 "css\style.css"

Write-Host "  -> js\main.js"
@'
// main.js
// Punkt wejścia aplikacji.
// Nie zawiera logiki gry ani logiki UI — tylko uruchamia aplikację
// i pokazuje pierwszy ekran (menu główne).

import { initUI, showScreen } from "./ui/uiManager.js";

document.addEventListener("DOMContentLoaded", () => {
  initUI("app");
  showScreen("mainMenu");
});
'@ | Set-Content -Encoding UTF8 "js\main.js"

Write-Host "  -> js\state\gameState.js"
@'
// gameState.js
//
// Jedyne źródło prawdy o aktualnym stanie rozgrywki.
// Ten moduł NIE zawiera logiki gry (nie wie, jak działają spoons,
// wydarzenia itd.) — tylko przechowuje i udostępnia aktualny obiekt stanu.
//
// Inne moduły (systemy) modyfikują stan, który tu leży, ale to systemy
// wiedzą "jak", a ten plik wie tylko "gdzie".

let currentState = null;

/**
 * Ustawia nowy stan gry (używane np. przy starcie nowej gry lub po wczytaniu zapisu).
 */
export function setState(newState) {
  currentState = newState;
}

/**
 * Zwraca aktualny stan gry (lub null, jeśli gra jeszcze się nie zaczęła).
 */
export function getState() {
  return currentState;
}

/**
 * Sprawdza, czy jakakolwiek gra jest aktualnie aktywna w pamięci.
 */
export function hasActiveGame() {
  return currentState !== null;
}
'@ | Set-Content -Encoding UTF8 "js\state\gameState.js"

Write-Host "  -> js\state\saveManager.js"
@'
// saveManager.js
//
// Odpowiada wyłącznie za persystencję stanu gry w localStorage.
// Nie zna logiki gry — tylko zapisuje i odtwarza obiekt stanu.
//
// Zapis zawiera pole "saveVersion". Jeśli w przyszłości zmieni się
// struktura stanu gry, można tu dodać logikę migracji starszych zapisów.
// Na razie: zapis o niepasującej wersji jest odrzucany (bezpieczniej
// niż wczytać niekompatybilne dane).

import { getState, setState } from "./gameState.js";

const STORAGE_KEY = "outOfSpoons_save";
const SUPPORTED_SAVE_VERSION = 1;

/**
 * Zapisuje aktualny stan gry do localStorage.
 * Zwraca true/false w zależności od powodzenia.
 */
export function saveGame() {
  const state = getState();
  if (!state) {
    console.warn("Brak aktywnej gry do zapisania.");
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Nie udało się zapisać gry:", error);
    return false;
  }
}

/**
 * Sprawdza, czy istnieje jakikolwiek zapisany stan gry.
 */
export function hasSavedGame() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Wczytuje zapisany stan gry i ustawia go jako aktualny stan (gameState).
 * Zwraca wczytany stan lub null, jeśli zapis nie istnieje / jest uszkodzony /
 * pochodzi z niekompatybilnej wersji.
 */
export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Zapis jest uszkodzony i nie mógł zostać odczytany:", error);
    return null;
  }

  if (parsed.saveVersion !== SUPPORTED_SAVE_VERSION) {
    console.warn(
      `Niekompatybilna wersja zapisu (${parsed.saveVersion}). ` +
      `Ta wersja gry obsługuje zapisy w wersji ${SUPPORTED_SAVE_VERSION}.`
    );
    return null;
  }

  setState(parsed);
  return parsed;
}

/**
 * Usuwa zapisany stan gry (przydatne np. do testowania).
 */
export function clearSavedGame() {
  localStorage.removeItem(STORAGE_KEY);
}
'@ | Set-Content -Encoding UTF8 "js\state\saveManager.js"

Write-Host "  -> js\systems\spoonsSystem.js"
@'
// spoonsSystem.js
//
// Logika zasobu "spoons" — najważniejszego zasobu w grze.
// Ten moduł nie wie nic o UI ani o tym, kto woła jego funkcje —
// operuje wyłącznie na przekazanym obiekcie stanu.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Zmienia liczbę spoons o podaną wartość (dodatnią lub ujemną).
 * Wynik jest zawsze przycięty do zakresu [0, max].
 * Zwraca nową wartość current.
 */
export function modifySpoons(state, amount) {
  const spoons = state.resources.spoons;
  spoons.current = clamp(spoons.current + amount, 0, spoons.max);
  return spoons.current;
}

/**
 * Regeneracja spoons (np. po nocy). To ta sama operacja co modifySpoons,
 * ale osobna nazwa czyni intencję czytelną w kodzie wywołującym.
 */
export function regenerateSpoons(state, amount) {
  return modifySpoons(state, amount);
}
'@ | Set-Content -Encoding UTF8 "js\systems\spoonsSystem.js"

Write-Host "  -> js\systems\npcSystem.js"
@'
// npcSystem.js
//
// Logika dotycząca NPC: tworzenie stanu runtime NPC na podstawie
// statycznej definicji (z data/npcData.js) oraz modyfikacja ich atrybutów.
//
// W prototypie mamy jednego NPC, ale funkcje są napisane tak,
// by bez zmian obsługiwały wielu NPC w przyszłości.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Tworzy obiekt stanu NPC (runtime) na podstawie jego statycznej definicji.
 */
export function initNpc(npcDefinition) {
  return {
    id: npcDefinition.id,
    name: npcDefinition.name,
    trust: npcDefinition.baseTrust,
    frustration: npcDefinition.baseFrustration
  };
}

/**
 * Zmienia poziom zaufania danego NPC. Wynik przycięty do [0, 100].
 */
export function modifyTrust(state, npcId, amount) {
  const npc = state.npcs[npcId];
  if (!npc) {
    console.warn(`Nie znaleziono NPC o id: ${npcId}`);
    return;
  }
  npc.trust = clamp(npc.trust + amount, 0, 100);
}

/**
 * Zmienia poziom frustracji danego NPC. Wynik przycięty do [0, 100].
 */
export function modifyFrustration(state, npcId, amount) {
  const npc = state.npcs[npcId];
  if (!npc) {
    console.warn(`Nie znaleziono NPC o id: ${npcId}`);
    return;
  }
  npc.frustration = clamp(npc.frustration + amount, 0, 100);
}
'@ | Set-Content -Encoding UTF8 "js\systems\npcSystem.js"

Write-Host "  -> js\systems\eventSystem.js"
@'
// eventSystem.js
//
// Logika wydarzeń decyzyjnych. Napisana tak, by od razu obsługiwać
// wiele wydarzeń w puli — w v0.1 pula zawiera tylko jedno wydarzenie,
// ale funkcja wyboru wydarzenia (getEventForDay) jest już osobną
// funkcją, gotową na rozbudowę o warunki (dzień, stan zasobów,
// relacje z NPC itd.) bez zmiany reszty systemu.

import { eventPool } from "../data/eventData.js";
import { modifySpoons } from "./spoonsSystem.js";
import { modifyTrust, modifyFrustration } from "./npcSystem.js";

/**
 * Zwraca wydarzenie, które powinno się pojawić danego dnia.
 *
 * v0.1: zawsze zwraca pierwsze wydarzenie z puli.
 * W przyszłości: filtrowanie eventPool po warunkach (dzień, zasoby,
 * relacje, wcześniejsza historia) i losowanie spośród pasujących.
 */
export function getEventForDay(day) {
  const availableEvents = eventPool;
  return availableEvents[0];
}

/**
 * Aplikuje wybór gracza do stanu gry: modyfikuje spoons, atrybuty NPC
 * i dopisuje wpis do logu wydarzeń. Zwraca wybraną opcję (przydatne
 * do wyświetlenia rezultatu na ekranie refleksji).
 */
export function applyChoice(state, event, choiceId) {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`Nieznany wybór "${choiceId}" dla wydarzenia "${event.id}"`);
  }

  modifySpoons(state, -choice.spoonsCost);
  modifyTrust(state, event.npcId, choice.trustChange);
  modifyFrustration(state, event.npcId, choice.frustrationChange);

  state.log.push({
    day: state.day,
    eventId: event.id,
    choiceId: choice.id,
    resultText: choice.resultText
  });

  return choice;
}
'@ | Set-Content -Encoding UTF8 "js\systems\eventSystem.js"

Write-Host "  -> js\systems\dayCycle.js"
@'
// dayCycle.js
//
// Orkiestrator pętli dnia. To jedyne miejsce w kodzie, które "wie",
// w jakiej kolejności następują fazy dnia (poranek -> wydarzenie ->
// refleksja -> kolejny dzień). Woła systemy (spoons, npc, event),
// ale nie dotyka UI — o to, co pokazać na ekranie, dbają moduły w js/ui/.

import { setState, getState } from "../state/gameState.js";
import { npcData } from "../data/npcData.js";
import { initNpc } from "./npcSystem.js";
import { regenerateSpoons } from "./spoonsSystem.js";
import { getEventForDay, applyChoice } from "./eventSystem.js";

const SAVE_VERSION = 1;
const STARTING_SPOONS = 10;

// Ile spoons wraca po nocy. Świadomie mniej niż max (10) — zmęczenie
// z poprzednich dni ma się kumulować, jeśli gracz nie dba o siebie.
// Wartość do skalibrowania wspólnie z projektantem gry.
const DAILY_SPOONS_REGEN = 6;

/**
 * Tworzy zupełnie nową rozgrywkę i ustawia ją jako aktualny stan gry.
 */
export function startNewGame() {
  const alex = initNpc(npcData.alex);

  const state = {
    saveVersion: SAVE_VERSION,
    day: 1,
    phase: "morning",
    resources: {
      spoons: { current: STARTING_SPOONS, max: STARTING_SPOONS }
    },
    npcs: {
      [alex.id]: alex
    },
    log: []
  };

  setState(state);
  return state;
}

/**
 * Zwraca wydarzenie zaplanowane na aktualny dzień.
 */
export function getCurrentEvent() {
  const state = getState();
  return getEventForDay(state.day);
}

/**
 * Przejście z fazy porannej do fazy wydarzenia.
 */
export function goToEvent() {
  const state = getState();
  state.phase = "event";
  return state;
}

/**
 * Aplikuje decyzję gracza w wydarzeniu i przechodzi do fazy refleksji.
 */
export function resolveEvent(choiceId) {
  const state = getState();
  const event = getEventForDay(state.day);
  const choice = applyChoice(state, event, choiceId);
  state.phase = "reflection";
  return { state, choice };
}

/**
 * Kończy dzień: regeneruje część spoons i przechodzi do poranka
 * kolejnego dnia.
 */
export function advanceToNextDay() {
  const state = getState();
  regenerateSpoons(state, DAILY_SPOONS_REGEN);
  state.day += 1;
  state.phase = "morning";
  return state;
}
'@ | Set-Content -Encoding UTF8 "js\systems\dayCycle.js"

Write-Host "  -> js\data\npcData.js"
@'
// npcData.js
//
// Statyczna definicja NPC dostępnych w prototypie.
// To są "surowe dane" — logika, która się nimi posługuje, znajduje
// się w systems/npcSystem.js. Dzięki temu rozdzieleniu, zamiana tego
// pliku na generator losowy w przyszłości nie wymaga zmian w logice.

export const npcData = {
  alex: {
    id: "alex",
    name: "Alex",
    description: "Twój partner. Ceni szczerość i czas spędzony razem.",
    baseTrust: 50,
    baseFrustration: 20,
    morningMessage:
      "Alex pisze: „Możemy dziś porozmawiać? Chciałbym/chciałabym coś z Tobą omówić.”"
  }
};
'@ | Set-Content -Encoding UTF8 "js\data\npcData.js"

Write-Host "  -> js\data\eventData.js"
@'
// eventData.js
//
// Statyczna definicja puli wydarzeń decyzyjnych.
// W v0.1 pula zawiera jedno wydarzenie (dokładnie ten przykład
// z dokumentu projektowego Core Gameplay, punkt 7: "Partner chce rozmowy").
// Kolejne wydarzenia dodaje się jako kolejne obiekty w tej tablicy —
// eventSystem.js jest już przygotowany, by z nich korzystać.

export const eventPool = [
  {
    id: "talk_request",
    npcId: "alex",
    title: "Prośba o rozmowę",
    description:
      "Alex chce dziś poważnie porozmawiać o Waszej relacji. Widzisz, że to dla niego/niej ważne, " +
      "ale Twoje zasoby na dziś są ograniczone.",
    choices: [
      {
        id: "talk_now",
        label: "Rozmawiasz teraz",
        spoonsCost: 2,
        trustChange: 10,
        frustrationChange: -5,
        resultText:
          "Rozmowa była trudna, ale szczera. Alex czuje się wysłuchany/a. " +
          "Kosztowało Cię to jednak część dzisiejszej energii."
      },
      {
        id: "postpone",
        label: "Prosisz o przełożenie rozmowy",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 5,
        resultText:
          "Alex przyjmuje to ze zrozumieniem, choć widać lekkie rozczarowanie. " +
          "Zachowujesz swoje zasoby na dziś."
      },
      {
        id: "ignore",
        label: "Ignorujesz wiadomość",
        spoonsCost: 0,
        trustChange: -8,
        frustrationChange: 12,
        resultText:
          "Nie odpowiadasz. Alex czeka na wiadomość, która nie przychodzi. " +
          "Coś między Wami cichnie."
      }
    ]
  }
];
'@ | Set-Content -Encoding UTF8 "js\data\eventData.js"

Write-Host "  -> js\ui\uiManager.js"
@'
// uiManager.js
//
// Odpowiada wyłącznie za przełączanie ekranów. Nie zawiera logiki gry —
// tylko wie, jak wyrenderować dany ekran do kontenera #app.
// Ekrany same decydują, kiedy poprosić o przejście do innego ekranu.

import { renderMainMenu } from "./screens/mainMenuScreen.js";
import { renderGameScreen } from "./screens/gameScreen.js";
import { renderEventScreen } from "./screens/eventScreen.js";
import { renderReflectionScreen } from "./screens/reflectionScreen.js";

const screens = {
  mainMenu: renderMainMenu,
  game: renderGameScreen,
  event: renderEventScreen,
  reflection: renderReflectionScreen
};

let appContainer = null;

/**
 * Inicjalizuje UI Managera, wskazując element DOM, w którym będą
 * renderowane ekrany.
 */
export function initUI(rootElementId) {
  appContainer = document.getElementById(rootElementId);
  if (!appContainer) {
    console.error(`Nie znaleziono elementu o id "${rootElementId}"`);
  }
}

/**
 * Pokazuje wskazany ekran, czyszcząc poprzednią zawartość kontenera.
 * @param {string} screenName - nazwa ekranu (klucz w obiekcie `screens`)
 * @param {object} [data] - opcjonalne dane przekazywane do funkcji renderującej
 */
export function showScreen(screenName, data) {
  if (!appContainer) {
    console.error("UI Manager nie został zainicjalizowany (brak wywołania initUI).");
    return;
  }

  const renderFn = screens[screenName];
  if (!renderFn) {
    console.error(`Nieznany ekran: "${screenName}"`);
    return;
  }

  appContainer.innerHTML = "";
  renderFn(appContainer, data);
}
'@ | Set-Content -Encoding UTF8 "js\ui\uiManager.js"

Write-Host "  -> js\ui\screens\mainMenuScreen.js"
@'
// mainMenuScreen.js
//
// Ekran menu głównego: pozwala rozpocząć nową grę albo, jeśli istnieje
// zapis, kontynuować poprzednią rozgrywkę od miejsca, w którym została
// zapisana (poranek / wydarzenie / refleksja).

import { showScreen } from "../uiManager.js";
import { startNewGame } from "../../systems/dayCycle.js";
import { hasSavedGame, loadGame } from "../../state/saveManager.js";

export function renderMainMenu(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "screen main-menu";

  const title = document.createElement("h1");
  title.textContent = "Out of Spoons";
  wrapper.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = "Zarządzaj swoją pojemnością. Dzień po dniu.";
  wrapper.appendChild(subtitle);

  const newGameButton = document.createElement("button");
  newGameButton.className = "primary-button";
  newGameButton.textContent = "Nowa gra";
  newGameButton.addEventListener("click", () => {
    startNewGame();
    showScreen("game");
  });
  wrapper.appendChild(newGameButton);

  if (hasSavedGame()) {
    const continueButton = document.createElement("button");
    continueButton.className = "secondary-button";
    continueButton.textContent = "Kontynuuj";
    continueButton.addEventListener("click", () => {
      handleContinue();
    });
    wrapper.appendChild(continueButton);
  }

  container.appendChild(wrapper);
}

/**
 * Wczytuje zapisaną grę i przechodzi do właściwego ekranu w zależności
 * od tego, na jakiej fazie dnia gra została zapisana.
 */
function handleContinue() {
  const state = loadGame();
  if (!state) {
    // Zapis nieudany / niekompatybilny — zostajemy w menu.
    return;
  }

  if (state.phase === "event") {
    showScreen("event");
    return;
  }

  if (state.phase === "reflection") {
    const lastEntry = state.log[state.log.length - 1];
    showScreen("reflection", { resultText: lastEntry ? lastEntry.resultText : "" });
    return;
  }

  showScreen("game");
}
'@ | Set-Content -Encoding UTF8 "js\ui\screens\mainMenuScreen.js"

Write-Host "  -> js\ui\screens\gameScreen.js"
@'
// gameScreen.js
//
// Ekran poranka: pokazuje aktualny dzień, stan spoons oraz wiadomość
// od NPC. Stąd gracz przechodzi do wydarzenia dnia.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { npcData } from "../../data/npcData.js";

export function renderGameScreen(container) {
  const state = getState();

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const header = document.createElement("h2");
  header.textContent = `Dzień ${state.day}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));

  // Prototyp v0.1: jeden NPC, więc bierzemy pierwszego z listy.
  const npcId = Object.keys(state.npcs)[0];
  const npcDefinition = npcData[npcId];

  const message = document.createElement("p");
  message.className = "npc-message";
  message.textContent = npcDefinition.morningMessage;
  wrapper.appendChild(message);

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Zobacz, co się dzieje";
  continueButton.addEventListener("click", () => {
    goToEvent();
    showScreen("event");
  });
  wrapper.appendChild(continueButton);

  container.appendChild(wrapper);
}

/**
 * Buduje wizualny licznik spoons (etykieta liczbowa + rząd ikon).
 */
function renderSpoonsMeter(spoons) {
  const meter = document.createElement("div");
  meter.className = "spoons-meter";

  const label = document.createElement("span");
  label.className = "spoons-label";
  label.textContent = `Spoons: ${spoons.current}/${spoons.max}`;
  meter.appendChild(label);

  const row = document.createElement("div");
  row.className = "spoons-row";
  for (let i = 0; i < spoons.max; i++) {
    const spoon = document.createElement("span");
    spoon.className = i < spoons.current ? "spoon full" : "spoon empty";
    row.appendChild(spoon);
  }
  meter.appendChild(row);

  return meter;
}
'@ | Set-Content -Encoding UTF8 "js\ui\screens\gameScreen.js"

Write-Host "  -> js\ui\screens\eventScreen.js"
@'
// eventScreen.js
//
// Ekran wydarzenia decyzyjnego: pokazuje opis sytuacji i dostępne
// wybory. Koszt w spoons jest pokazywany jawnie przy każdej opcji —
// to informacja, nie ocena (zgodnie z zasadą "gra pokazuje konsekwencje,
// nie mówi co jest dobre").

import { showScreen } from "../uiManager.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();

  const wrapper = document.createElement("div");
  wrapper.className = "screen event-screen";

  const title = document.createElement("h2");
  title.textContent = event.title;
  wrapper.appendChild(title);

  const description = document.createElement("p");
  description.textContent = event.description;
  wrapper.appendChild(description);

  const choicesList = document.createElement("div");
  choicesList.className = "choices";

  event.choices.forEach((choice) => {
    choicesList.appendChild(renderChoiceButton(choice));
  });

  wrapper.appendChild(choicesList);
  container.appendChild(wrapper);
}

function renderChoiceButton(choice) {
  const button = document.createElement("button");
  button.className = "choice-button";

  const label = document.createElement("span");
  label.className = "choice-label";
  label.textContent = choice.label;
  button.appendChild(label);

  if (choice.spoonsCost > 0) {
    const cost = document.createElement("span");
    cost.className = "choice-cost";
    cost.textContent = `− ${choice.spoonsCost} spoons`;
    button.appendChild(cost);
  }

  button.addEventListener("click", () => {
    resolveEvent(choice.id);
    showScreen("reflection");
  });

  return button;
}
'@ | Set-Content -Encoding UTF8 "js\ui\screens\eventScreen.js"

Write-Host "  -> js\ui\screens\reflectionScreen.js"
@'
// reflectionScreen.js
//
// Ekran wieczornej refleksji: pokazuje konsekwencje decyzji podjętej
// w wydarzeniu oraz aktualny stan spoons. Przycisk zapisuje grę
// i przechodzi do poranka kolejnego dnia.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");

  const wrapper = document.createElement("div");
  wrapper.className = "screen reflection-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczorna refleksja";
  wrapper.appendChild(title);

  const result = document.createElement("p");
  result.className = "reflection-text";
  result.textContent = resultText;
  wrapper.appendChild(result);

  const summary = document.createElement("p");
  summary.className = "spoons-summary";
  summary.textContent = `Zostało Ci ${state.resources.spoons.current} z ${state.resources.spoons.max} spoons na dziś.`;
  wrapper.appendChild(summary);

  const saveButton = document.createElement("button");
  saveButton.className = "primary-button";
  saveButton.textContent = "Zapisz i przejdź do kolejnego dnia";
  saveButton.addEventListener("click", () => {
    advanceToNextDay();
    saveGame();
    showScreen("game");
  });
  wrapper.appendChild(saveButton);

  container.appendChild(wrapper);
}
'@ | Set-Content -Encoding UTF8 "js\ui\screens\reflectionScreen.js"

Write-Host ""
Write-Host "Gotowe! Struktura projektu Out of Spoons zostala utworzona." -ForegroundColor Green
Write-Host ""
Write-Host "Aby uruchomic gre lokalnie:" -ForegroundColor Yellow
Write-Host "  1. python -m http.server 8000"
Write-Host "  2. Otworz w przegladarce: http://localhost:8000"
Write-Host ""