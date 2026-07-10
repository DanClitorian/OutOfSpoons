r"""
apply_v0_5_visible_consequences.py

Updater v0.5 dla Out of Spoons: widoczne konsekwencje decyzji.

Do tej pory ekran wieczornej refleksji pokazywal tylko opis tekstowy
(resultText). Gracz nie widzial wprost, ile spoons stracil ani jak
zmienilo sie zaufanie / frustracja partnera. Ten updater:

  1. Rozszerza kazdy wpis w state.log o obiekt "consequences":
       { spoonsChange, trustChange, frustrationChange }
     spoonsChange jest zawsze liczba ujemna lub zero (koszt wyboru).

  2. Dodaje na ekranie refleksji sekcje "Konsekwencje:" z trzema
     wartosciami ze znakiem (+4 / -3 / 0 - zera NIE sa ukrywane) oraz
     krotka, nieoceniajaca interpretacja pod nimi.

  3. Dodaje do style.css subtelna, bezbarwna (bez czerwieni/zieleni)
     sekcje wizualna dla konsekwencji, spojna z estetyka dziennika.

Ten skrypt NIE przebudowuje gry. Zaklada, ze w folderze C:\OutOfSpoons
istnieje juz kompletny projekt w wersji v0.4 (v0.1 + v0.2 kreator postaci
+ v0.3 generator partnera + hotfix v0.3.1 + v0.4 pula wydarzen).

Co robi:
  - nadpisuje dokladnie 5 plikow wymienionych w CHANGED_FILES ponizej
  - nie tworzy zadnych nowych plikow
  - NIE rusza pozostalych plikow projektu (kreator postaci, generator
    partnera, eventData.js, eventScreen.js, gameScreen.js pozostaja
    nietkniete)

Uruchomienie (z wnetrza folderu C:\OutOfSpoons):

    cd C:\OutOfSpoons
    python apply_v0_5_visible_consequences.py

UWAGA: stare zapisy gry (localStorage, saveVersion: 4) przestana byc
odczytywalne po tej aktualizacji - struktura wpisow w state.log zmienila
sie w sposob niekompatybilny (doszlo pole "consequences"), wiec saveVersion
rosnie do 5. To oczekiwane zachowanie, nie blad.
"""

import os
import sys

# Sciezki plikow sa wzgledne wobec katalogu, w ktorym uruchamiany jest
# ten skrypt. Uruchamiaj go z wnetrza C:\OutOfSpoons.
PROJECT_ROOT = os.getcwd()

# Prosty check bezpieczenstwa: upewniamy sie, ze uruchamiamy skrypt
# we wlasciwym miejscu (projekt v0.4 powinien juz tam byc).
SANITY_CHECK_FILE = os.path.join(PROJECT_ROOT, "js", "systems", "eventSystem.js")


def sanity_check():
    if not os.path.isfile(SANITY_CHECK_FILE):
        print("BLAD: nie znaleziono js/systems/eventSystem.js w biezacym folderze.")
        print("Uruchom ten skrypt z wnetrza folderu C:\\OutOfSpoons,")
        print("w ktorym istnieje juz projekt z wersji v0.4.")
        sys.exit(1)

    with open(SANITY_CHECK_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    if "getEventById" not in content:
        print("BLAD: js/systems/eventSystem.js nie wyglada na wersje v0.4")
        print("(brak funkcji getEventById). Uruchom najpierw:")
        print("  apply_v0_4_event_pool.py")
        print("a dopiero potem ten skrypt.")
        sys.exit(1)


def write_file(relative_path, content):
    full_path = os.path.join(PROJECT_ROOT, *relative_path.split("/"))
    parent_dir = os.path.dirname(full_path)
    if parent_dir and not os.path.isdir(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)
    with open(full_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print(f"  -> {relative_path}")


FILES = {}

FILES["js/systems/eventSystem.js"] = """// eventSystem.js
//
// Logika wydarzeń decyzyjnych.
//
// v0.4: pula ma teraz kilka wydarzeń, więc getEventForDay(day) faktycznie
// losuje spośród nich (respektując opcjonalne pole minDay), zamiast
// zawsze zwracać to samo. Losowanie jest na razie czysto losowe — nie ma
// pamięci o tym, co już się pojawiło (świadomy zakres v0.4).
//
// Stabilność wydarzenia w ramach jednego dnia NIE jest zapewniana przez
// ten moduł — o to dba dayCycle.js, wywołując getEventForDay() dokładnie
// raz (przy przejściu poranek -> event) i zapamiętując wynik jako
// state.currentEventId. getEventById() poniżej służy właśnie do
// późniejszego, stabilnego odczytu tego samego wydarzenia bez ponownego
// losowania.

import { eventPool } from "../data/eventData.js";
import { modifySpoons } from "./spoonsSystem.js";
import { modifyTrust, modifyFrustration } from "./npcSystem.js";

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Zwraca wydarzenia dopuszczalne danego dnia — takie, które albo nie
 * mają pola minDay, albo dzień gry jest >= ich minDay.
 */
function getEligibleEvents(day) {
  return eventPool.filter((event) => !event.minDay || day >= event.minDay);
}

/**
 * Losuje wydarzenie, które powinno się pojawić danego dnia.
 *
 * Wywoływana tylko raz na dzień (patrz dayCycle.goToEvent) — wynik
 * trzeba zapamiętać po stronie wywołującej, jeśli ma pozostać stabilny.
 */
export function getEventForDay(day) {
  const eligibleEvents = getEligibleEvents(day);
  // Zabezpieczenie: gdyby filtr minDay z jakiegoś powodu wyciął całą
  // pulę (np. błąd w danych), wracamy do pełnej puli — gra nigdy nie
  // powinna utknąć bez żadnego wydarzenia na dany dzień.
  const pool = eligibleEvents.length > 0 ? eligibleEvents : eventPool;
  return pickRandom(pool);
}

/**
 * Zwraca wydarzenie o podanym id, bez żadnego losowania. Używane do
 * stabilnego odczytu wydarzenia dnia już zapisanego w state.currentEventId.
 */
export function getEventById(eventId) {
  return eventPool.find((event) => event.id === eventId);
}

/**
 * Aplikuje wybór gracza do stanu gry: modyfikuje spoons, atrybuty NPC
 * i dopisuje wpis do logu wydarzeń — razem z tekstem rezultatu ORAZ
 * jawnym obiektem consequences (v0.5), żeby UI mogło pokazać mechaniczne
 * skutki wyboru wprost, bez zgadywania z resultText. Zwraca wybraną
 * opcję (przydatne do wyświetlenia rezultatu na ekranie refleksji).
 */
export function applyChoice(state, event, choiceId) {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`Nieznany wybór "${choiceId}" dla wydarzenia "${event.id}"`);
  }

  // v0.3: wydarzenia w puli dotyczą obecnie zawsze aktualnego partnera
  // z rozgrywki. Gdy pojawią się wydarzenia z innymi NPC, trzeba tu
  // będzie dodać właściwe wskazanie celu zamiast zawsze brać partnera.
  const partnerId = state.partner.id;

  modifySpoons(state, -choice.spoonsCost);
  modifyTrust(state, partnerId, choice.trustChange);
  modifyFrustration(state, partnerId, choice.frustrationChange);

  const resultText = choice.resultText.replace(/\\{partnerName\\}/g, state.partner.name);

  // v0.5: spoonsChange to zawsze liczba ujemna (albo zero) — koszt
  // wyboru odejmowany od zasobów gracza, zapisany wprost, żeby UI nie
  // musiało go samo przeliczać z choice.spoonsCost.
  const consequences = {
    spoonsChange: -choice.spoonsCost,
    trustChange: choice.trustChange,
    frustrationChange: choice.frustrationChange
  };

  state.log.push({
    day: state.day,
    eventId: event.id,
    choiceId: choice.id,
    resultText,
    consequences
  });

  return choice;
}
"""

FILES["js/ui/screens/reflectionScreen.js"] = """// reflectionScreen.js
//
// Ekran wieczornej refleksji: pokazuje konsekwencje decyzji podjętej
// w wydarzeniu oraz aktualny stan spoons. Przycisk zapisuje grę
// i przechodzi do poranka kolejnego dnia.
//
// v0.5: oprócz tekstu rezultatu (resultText) pokazujemy teraz wprost
// mechaniczne skutki wyboru — sekcję "Konsekwencje" z trzema wartościami
// ze znakiem (spoons/zaufanie/frustracja) i krótką, nieoceniającą
// interpretacją pod nimi. Wcześniej gracz widział tylko opis fabularny —
// to za mało, żeby zrozumieć, co faktycznie się zmieniło w mechanice gry.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { advanceToNextDay } from "../../systems/dayCycle.js";
import { saveGame } from "../../state/saveManager.js";

export function renderReflectionScreen(container, data) {
  const state = getState();
  const lastEntry = state.log[state.log.length - 1];
  const resultText = (data && data.resultText) || (lastEntry ? lastEntry.resultText : "");
  const consequences = lastEntry ? lastEntry.consequences : null;

  const wrapper = document.createElement("div");
  wrapper.className = "screen reflection-screen";

  const title = document.createElement("h2");
  title.textContent = "Wieczorna refleksja";
  wrapper.appendChild(title);

  const result = document.createElement("p");
  result.className = "reflection-text";
  result.textContent = resultText;
  wrapper.appendChild(result);

  if (consequences) {
    wrapper.appendChild(renderConsequences(consequences));
  }

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

/**
 * Formatuje liczbę ze znakiem: dodatnie dostają jawny "+", ujemne mają
 * "-" (naturalnie, z zapisu liczby), a zero jest pokazywane jako "0" —
 * NIE ukrywamy zer, żeby gracz wiedział, że coś się nie zmieniło.
 */
function formatSignedNumber(value) {
  if (value > 0) {
    return `+${value}`;
  }
  if (value < 0) {
    return `${value}`;
  }
  return "0";
}

/**
 * Buduje sekcję "Konsekwencje": listę trzech wartości mechanicznych
 * oraz krótką interpretację pod nimi (jeśli jest co powiedzieć).
 */
function renderConsequences(consequences) {
  const section = document.createElement("div");
  section.className = "consequences";

  const heading = document.createElement("p");
  heading.className = "consequences-heading";
  heading.textContent = "Konsekwencje:";
  section.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "consequences-list";
  list.appendChild(buildConsequenceItem("Spoons", consequences.spoonsChange));
  list.appendChild(buildConsequenceItem("Zaufanie", consequences.trustChange));
  list.appendChild(buildConsequenceItem("Frustracja", consequences.frustrationChange));
  section.appendChild(list);

  const interpretation = buildInterpretation(consequences);
  if (interpretation) {
    const interpretationText = document.createElement("p");
    interpretationText.className = "consequences-interpretation";
    interpretationText.textContent = interpretation;
    section.appendChild(interpretationText);
  }

  return section;
}

/**
 * Buduje pojedynczy wiersz konsekwencji: etykieta + wartość ze znakiem.
 */
function buildConsequenceItem(label, value) {
  const item = document.createElement("li");
  item.className = "consequences-item";

  const labelSpan = document.createElement("span");
  labelSpan.className = "consequences-label";
  labelSpan.textContent = `${label}:`;
  item.appendChild(labelSpan);

  const valueSpan = document.createElement("span");
  valueSpan.className = "consequences-value";
  valueSpan.textContent = formatSignedNumber(value);
  item.appendChild(valueSpan);

  return item;
}

/**
 * Buduje krótką, nieoceniającą interpretację konsekwencji. Sklejamy
 * wszystkie pasujące zdania (dla zaufania, frustracji i spoons) w jeden
 * krótki akapit — wybór gracza często zmienia więcej niż jedną wartość
 * naraz, więc gracz powinien zobaczyć wszystkie istotne skutki, nie
 * tylko jeden wybrany arbitralnie.
 */
function buildInterpretation(consequences) {
  const sentences = [];

  if (consequences.trustChange > 0) {
    sentences.push("Ta decyzja trochę wzmocniła poczucie bezpieczeństwa w relacji.");
  } else if (consequences.trustChange < 0) {
    sentences.push("Ta decyzja mogła zostawić w relacji trochę niepewności.");
  }

  if (consequences.frustrationChange > 0) {
    sentences.push("Frustracja partnera wzrosła.");
  } else if (consequences.frustrationChange < 0) {
    sentences.push("Napięcie trochę opadło.");
  }

  if (consequences.spoonsChange < 0) {
    sentences.push("Koszt tej decyzji poczujesz jeszcze dziś.");
  }

  if (sentences.length === 0) {
    return null;
  }

  return sentences.join(" ");
}
"""

FILES["js/systems/dayCycle.js"] = """// dayCycle.js
//
// Orkiestrator pętli dnia. To jedyne miejsce w kodzie, które "wie",
// w jakiej kolejności następują fazy dnia (poranek -> wydarzenie ->
// refleksja -> kolejny dzień). Woła systemy (spoons, npc, event),
// ale nie dotyka UI — o to, co pokazać na ekranie, dbają moduły w js/ui/.

import { setState, getState } from "../state/gameState.js";
import { initNpc } from "./npcSystem.js";
import { regenerateSpoons } from "./spoonsSystem.js";
import { getEventForDay, getEventById, applyChoice } from "./eventSystem.js";
import { buildPlayer, calculateStartingSpoons } from "./characterSystem.js";
import { generatePartner } from "./partnerSystem.js";

// v0.5: wpisy w state.log zyskały pole "consequences" (jawne, mechaniczne
// skutki wyboru: spoonsChange/trustChange/frustrationChange), pokazywane
// teraz graczowi na ekranie refleksji. To kolejna niekompatybilna zmiana
// struktury zapisu, dlatego wersja rośnie do 5 (patrz też
// state/saveManager.js).
const SAVE_VERSION = 5;

// Ile spoons wraca po nocy. Świadomie mniej niż max — zmęczenie
// z poprzednich dni ma się kumulować, jeśli gracz nie dba o siebie.
// Wartość do skalibrowania wspólnie z projektantem gry.
const DAILY_SPOONS_REGEN = 6;

/**
 * Tworzy zupełnie nową rozgrywkę na podstawie danych z kreatora postaci
 * i losuje pierwszego partnera. Ustawia wynik jako aktualny stan gry.
 *
 * @param {object} playerData - { name, pronouns, selectedTraitIds }
 *   dokładnie to, co zbiera ekran kreatora postaci.
 */
export function startNewGame(playerData) {
  const partner = generatePartner();
  const player = buildPlayer(playerData);
  const startingSpoons = calculateStartingSpoons(player);

  const state = {
    saveVersion: SAVE_VERSION,
    day: 1,
    phase: "morning",
    // Brak wylosowanego wydarzenia na starcie dnia — pojawi się dopiero
    // przy przejściu do fazy "event" (patrz goToEvent niżej).
    currentEventId: null,
    player,
    partner,
    resources: {
      spoons: { current: startingSpoons, max: startingSpoons }
    },
    npcs: {
      [partner.id]: initNpc(partner)
    },
    log: []
  };

  setState(state);
  return state;
}

/**
 * Zwraca wydarzenie zaplanowane na aktualny dzień — to, którego id jest
 * zapisane w state.currentEventId. CELOWO nie losuje niczego na nowo:
 * to zapewnia, że wydarzenie dnia jest stabilne (wielokrotne wywołanie
 * w ramach tego samego dnia zawsze zwróci to samo wydarzenie).
 */
export function getCurrentEvent() {
  const state = getState();
  return getEventById(state.currentEventId);
}

/**
 * Przejście z fazy porannej do fazy wydarzenia. To jedyne miejsce, w
 * którym losowane jest wydarzenie dnia — jego id trafia do
 * state.currentEventId i zostaje tam aż do advanceToNextDay().
 */
export function goToEvent() {
  const state = getState();
  const event = getEventForDay(state.day);
  state.currentEventId = event.id;
  state.phase = "event";
  return state;
}

/**
 * Aplikuje decyzję gracza w wydarzeniu i przechodzi do fazy refleksji.
 * Wydarzenie pobierane jest po id (nie losowane ponownie), więc wybór
 * gracza zawsze dotyczy dokładnie tego wydarzenia, które widział na ekranie.
 */
export function resolveEvent(choiceId) {
  const state = getState();
  const event = getEventById(state.currentEventId);
  const choice = applyChoice(state, event, choiceId);
  state.phase = "reflection";
  return { state, choice };
}

/**
 * Kończy dzień: regeneruje część spoons, resetuje wydarzenie dnia
 * i przechodzi do poranka kolejnego dnia.
 */
export function advanceToNextDay() {
  const state = getState();
  regenerateSpoons(state, DAILY_SPOONS_REGEN);
  state.day += 1;
  state.phase = "morning";
  state.currentEventId = null;
  return state;
}
"""

FILES["js/state/saveManager.js"] = """// saveManager.js
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

// v0.5: wpisy w state.log zyskały pole "consequences" (jawne skutki
// mechaniczne wyboru), pokazywane na ekranie refleksji. To kolejna
// niekompatybilna zmiana ze starszymi zapisami (v1-v4), dlatego wersja
// rośnie do 5. Starsze zapisy są po prostu odrzucane niżej.
const SUPPORTED_SAVE_VERSION = 5;

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
"""

FILES["css/style.css"] = """/* ==========================================================================
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

/* ==========================================================================
   v0.2 — Kreator postaci
   Dopisane bez zmiany istniejących reguł powyżej.
   ========================================================================== */

.field-label {
  display: block;
  font-weight: 600;
  margin-top: var(--space-md);
  margin-bottom: 4px;
}

.text-input {
  display: block;
  width: 100%;
  font-family: var(--font-body);
  font-size: 1rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 3px;
  background-color: var(--color-paper);
  color: var(--color-ink);
}

.text-input:focus-visible {
  outline: 2px solid var(--color-sage);
  outline-offset: 1px;
}

.section-heading {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 1.15rem;
  margin-top: var(--space-lg);
  margin-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-sm);
}

.field-hint {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin-top: 0;
}

.traits-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: var(--space-sm) 0 var(--space-md) 0;
}

.trait-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 3px;
  background-color: var(--color-paper);
  cursor: pointer;
}

.trait-option:hover {
  border-color: var(--color-sage);
}

.trait-option input[type="checkbox"] {
  accent-color: var(--color-sage);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.field-error {
  color: var(--color-rose);
  font-size: 0.9rem;
  margin-top: 0;
}

.status-sentence {
  color: var(--color-muted);
  font-style: italic;
}

/* ==========================================================================
   v0.3 — Karta partnera
   Dopisane bez zmiany istniejących reguł powyżej.
   ========================================================================== */

.partner-card {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin: var(--space-md) 0 var(--space-lg) 0;
}

.partner-name {
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin: 0 0 2px 0;
}

.partner-relationship-label {
  color: var(--color-sage);
  font-weight: 600;
  font-size: 0.85rem;
  margin: 0 0 var(--space-sm) 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.partner-relationship-summary {
  color: var(--color-muted);
  margin: 0 0 var(--space-md) 0;
}

.partner-card .npc-message {
  margin-bottom: 0;
}

/* ==========================================================================
   v0.5 — Sekcja konsekwencji na ekranie refleksji
   Dopisane bez zmiany istniejących reguł powyżej. Świadomie bez kolorów
   (żadnej zieleni/czerwieni) — rozróżnienie tylko typograficzne, żeby
   pasowało do spokojnej, "papierowej" estetyki reszty gry.
   ========================================================================== */

.consequences {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin: var(--space-md) 0 var(--space-lg) 0;
}

.consequences-heading {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 1.05rem;
  margin: 0 0 var(--space-sm) 0;
}

.consequences-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.consequences-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  border-bottom: 1px dotted var(--color-line);
}

.consequences-item:last-child {
  border-bottom: none;
}

.consequences-label {
  color: var(--color-muted);
}

.consequences-value {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--color-ink);
}

.consequences-interpretation {
  color: var(--color-muted);
  font-style: italic;
  margin: var(--space-sm) 0 0 0;
}
"""

CHANGED_FILES = [
    "js/systems/eventSystem.js",
    "js/ui/screens/reflectionScreen.js",
    "js/systems/dayCycle.js",
    "js/state/saveManager.js",
    "css/style.css",
]


def main():
    sanity_check()

    print("Out of Spoons - aktualizacja do v0.5 (widoczne konsekwencje)")
    print("")

    print("Nadpisywanie plikow...")
    for path in CHANGED_FILES:
        write_file(path, FILES[path])

    print("")
    print("Gotowe! Zaktualizowano projekt do v0.5 (widoczne konsekwencje).")
    print("")
    print("Ekran wieczornej refleksji pokazuje teraz, oprocz opisu:")
    print("  Konsekwencje:")
    print("    Spoons: -2")
    print("    Zaufanie: +10")
    print("    Frustracja: -5")
    print("  + krotka interpretacja pod wartosciami.")
    print("")
    print("UWAGA: stare zapisy z v0.4 (saveVersion: 4) nie beda juz wczytywalne.")
    print("To oczekiwane - wpisy w logu maja teraz nowe pole consequences.")
    print("")
    print("Aby uruchomic gre lokalnie:")
    print("  1. python -m http.server 8000")
    print("  2. Otworz w przegladarce: http://localhost:8000")
    print("")


if __name__ == "__main__":
    main()