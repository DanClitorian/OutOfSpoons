r"""
apply_v0_3_partner_generator.py

Updater v0.3 dla Out of Spoons: Generator partnera / pierwszego NPC.

Ten skrypt NIE tworzy calego projektu od zera. Zaklada, ze w folderze
C:\OutOfSpoons istnieje juz struktura i pliki z wersji v0.1 + v0.2
(kreator postaci).

Co robi:
  - dodaje 2 nowe pliki (partnerData.js, partnerSystem.js)
  - nadpisuje 8 istniejacych plikow, ktore musialy sie zmienic
  - NIE rusza pozostalych plikow z v0.1 / v0.2
  - NIE usuwa js/data/npcData.js (statyczny Alex) - zostaje jako
    nieuzywany plik, na wypadek gdyby mial sie przydac pozniej

Uruchomienie (z wnetrza folderu C:\OutOfSpoons):

    cd C:\OutOfSpoons
    python apply_v0_3_partner_generator.py

UWAGA: stare zapisy gry (localStorage, saveVersion: 2) przestana byc
odczytywalne po tej aktualizacji - struktura zapisu zmienila sie
w sposob niekompatybilny (doszlo pole "partner", npcs jest teraz
budowane z wylosowanego partnera), wiec saveVersion rosnie do 3.
To oczekiwane zachowanie, nie blad.
"""

import os
import sys

# Sciezki plikow sa wzgledne wobec katalogu, w ktorym uruchamiany jest
# ten skrypt. Uruchamiaj go z wnetrza C:\OutOfSpoons.
PROJECT_ROOT = os.getcwd()

# Prosty check bezpieczenstwa: upewniamy sie, ze uruchamiamy skrypt
# we wlasciwym miejscu (projekt v0.1/v0.2 powinien juz tam byc).
SANITY_CHECK_FILE = os.path.join(PROJECT_ROOT, "js", "systems", "dayCycle.js")


def sanity_check():
    if not os.path.isfile(SANITY_CHECK_FILE):
        print("BLAD: nie znaleziono js/systems/dayCycle.js w biezacym folderze.")
        print("Uruchom ten skrypt z wnetrza folderu C:\\OutOfSpoons,")
        print("w ktorym istnieje juz projekt z wersji v0.1 / v0.2.")
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

FILES["js/data/partnerData.js"] = """// partnerData.js
//
// Statyczne pule danych używane przez generator partnera
// (patrz systems/partnerSystem.js). Ten plik nie zawiera żadnej logiki
// losowania — tylko surowe dane, zgodnie z podziałem data / systems / ui.

// Minimum 8 imion — losowany partner nie musi za każdym razem nazywać
// się tak samo.
export const partnerNamePool = [
  "Mira",
  "Kuba",
  "Ola",
  "Tomek",
  "Zuzia",
  "Adam",
  "Nina",
  "Filip",
  "Hania",
  "Marek"
];

// Etykieta relacji pokazywana graczowi wprost na karcie partnera.
// To kluczowe dla czytelności: gracz musi od razu wiedzieć, że to osoba
// partnerska, a nie losowy, niezwiązany z nim NPC.
export const relationshipLabels = [
  "Twój partner",
  "Twoja partnerka",
  "Osoba partnerska",
  "Twój chłopak",
  "Twoja dziewczyna"
];

// Minimum 6 krótkich opisów relacji — kontekst, w jakim gracz i partner
// się znajdują. Celowo różnorodne: różne etapy, różne dynamiki.
export const relationshipSummaries = [
  "Jesteście razem od kilku miesięcy. Relacja jest ciepła, ale jeszcze krucha — oboje sprawdzacie, jak dużo bliskości możecie udźwignąć bez utraty oddechu.",
  "Znacie się od lat, ale związek zaczęliście dopiero niedawno. Wciąż uczycie się, jak rozmawiać o trudnych rzeczach bez cofania się do starych, przyjacielskich nawyków.",
  "To jedna z Twoich dłuższych relacji — stabilna, ale czasem rutynowa. Oboje wiecie, że warto dbać o to, żeby nie zamieniła się w zwykłe współlokatorstwo.",
  "Związek na dystans, który dopiero co zamienił się w coś bardziej stacjonarnego. Bliskość fizyczna wciąż was trochę zaskakuje.",
  "Poznaliście się przez wspólnych znajomych i szybko poczuliście chemię. To wciąż wczesny etap — pełen ekscytacji, ale też niepewności.",
  "Byliście już razem wcześniej, rozstaliście się, i teraz próbujecie jeszcze raz — ostrożniej, z większą świadomością własnych granic.",
  "Relacja otwarta od samego początku. Oboje świadomie negocjujecie, ile czasu i uwagi możecie sobie nawzajem dać.",
  "To młoda relacja, pełna entuzjazmu, ale jeszcze bez ustalonych zasad co do przestrzeni osobistej i tempa bliskości."
];

// Minimum 4 style komunikacji. Na razie tylko opisowe (informacyjne dla
// gracza) — żaden event jeszcze z nich nie korzysta mechanicznie.
export const communicationStyles = [
  "bezpośrednia — mówi wprost, czego potrzebuje",
  "unikająca konfrontacji — woli przemilczeć niż wywołać spięcie",
  "impulsywna — reaguje szybko, czasem zanim przemyśli",
  "przemyślana i powolna — potrzebuje czasu, zanim odpowie na trudne pytanie",
  "żartobliwa — ucieka w humor, kiedy robi się poważnie",
  "pisemna — najlepiej radzi sobie, pisząc, nie mówiąc na żywo"
];

// Szablony wiadomości porannej. Token {name} jest podmieniany przez
// systems/partnerSystem.js na wylosowane imię partnera.
export const morningMessageTemplates = [
  "{name} pisze: „Możemy dziś porozmawiać? Mam coś, co siedzi mi w głowie od wczoraj.”",
  "{name} pisze: „Cześć, myślałam/em o nas ostatnio. Znajdziesz dziś chwilę?”",
  "{name} pisze: „Nic złego się nie stało, ale chciałabym/chciałbym coś z Tobą omówić.”",
  "{name} pisze: „Hej, masz dziś trochę czasu? Chodzi mi coś po głowie odkąd się widzieliśmy.”"
];
"""

FILES["js/systems/partnerSystem.js"] = """// partnerSystem.js
//
// Generator pierwszego partnera. Losuje spójny profil na podstawie puli
// danych z data/partnerData.js. Partner na tym etapie nie ma pamięci
// ani prawdziwego AI — to jednorazowo wylosowany, statyczny profil
// plus kilka podstawowych, na razie biernych statystyk (przygotowanych
// pod przyszłe mechaniki, podobnie jak player.flags z kreatora postaci).

import {
  partnerNamePool,
  relationshipLabels,
  relationshipSummaries,
  communicationStyles,
  morningMessageTemplates
} from "../data/partnerData.js";

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Zamienia imię na proste id, np. "Mira" -> "mira". Wystarczające,
 * dopóki w rozgrywce istnieje tylko jeden partner naraz — przy dodaniu
 * kolejnych partnerów trzeba będzie dopilnować unikalności id.
 */
function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, ""); // usuwa polskie znaki diakrytyczne
}

/**
 * Generuje pełny, losowy profil partnera gotowy do zapisania
 * w gameState jako state.partner.
 */
export function generatePartner() {
  const name = pickRandom(partnerNamePool);
  const relationshipLabel = pickRandom(relationshipLabels);
  const relationshipSummary = pickRandom(relationshipSummaries);
  const communicationStyle = pickRandom(communicationStyles);
  const morningMessage = pickRandom(morningMessageTemplates).replace("{name}", name);

  return {
    id: slugify(name),
    name,
    relationshipLabel,
    relationshipSummary,
    communicationStyle,

    // Podstawowe statystyki osobowości partnera. Zakres 0-100.
    // Na razie bierne — żaden event jeszcze z nich nie korzysta.
    closenessNeed: randomInt(20, 80),
    autonomyNeed: randomInt(20, 80),
    jealousy: randomInt(0, 60),

    // Startowe wartości relacji. Z tych pól korzysta npcSystem.initNpc,
    // żeby zbudować runtime stan (trust/frustration) w state.npcs.
    baseTrust: randomInt(40, 60),
    baseFrustration: randomInt(10, 30),

    morningMessage
  };
}
"""

FILES["js/data/eventData.js"] = """// eventData.js
//
// Statyczna definicja puli wydarzeń decyzyjnych.
// Pula zawiera jedno wydarzenie (dokładnie ten przykład z dokumentu
// projektowego Core Gameplay, punkt 7: "Partner chce rozmowy").
// Kolejne wydarzenia dodaje się jako kolejne obiekty w tej tablicy —
// eventSystem.js jest już przygotowany, by z nich korzystać.
//
// v0.3: wydarzenie nie wskazuje już statycznego NPC (dawne "npcId: alex").
// Zamiast tego opis i teksty wyników używają placeholdera {partnerName},
// który eventSystem.js / eventScreen.js podmieniają na imię aktualnego,
// wylosowanego partnera z rozgrywki (state.partner.name). Dzięki temu
// to samo wydarzenie działa niezależnie od tego, kto został wylosowany.
//
// Obecnie każde wydarzenie w puli dotyczy partnera z rozgrywki. Gdy w
// przyszłości pojawią się wydarzenia z innymi NPC (przyjaciele, rodzina
// itd.), trzeba tu będzie dodać jawne wskazanie celu, np. pole
// targetNpcId, i odpowiednio rozbudować eventSystem.applyChoice.

export const eventPool = [
  {
    id: "talk_request",
    title: "Prośba o rozmowę",
    description:
      "{partnerName} chce dziś poważnie porozmawiać o Waszej relacji. Widzisz, że to dla niego/niej ważne, " +
      "ale Twoje zasoby na dziś są ograniczone.",
    choices: [
      {
        id: "talk_now",
        label: "Rozmawiasz teraz",
        spoonsCost: 2,
        trustChange: 10,
        frustrationChange: -5,
        resultText:
          "Rozmowa była trudna, ale szczera. {partnerName} czuje się wysłuchany/a. " +
          "Kosztowało Cię to jednak część dzisiejszej energii."
      },
      {
        id: "postpone",
        label: "Prosisz o przełożenie rozmowy",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 5,
        resultText:
          "{partnerName} przyjmuje to ze zrozumieniem, choć widać lekkie rozczarowanie. " +
          "Zachowujesz swoje zasoby na dziś."
      },
      {
        id: "ignore",
        label: "Ignorujesz wiadomość",
        spoonsCost: 0,
        trustChange: -8,
        frustrationChange: 12,
        resultText:
          "Nie odpowiadasz. {partnerName} czeka na wiadomość, która nie przychodzi. " +
          "Coś między Wami cichnie."
      }
    ]
  }
];
"""

FILES["js/systems/eventSystem.js"] = """// eventSystem.js
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

  // v0.3: wydarzenia w puli dotyczą obecnie zawsze aktualnego partnera
  // z rozgrywki. Gdy pojawią się wydarzenia z innymi NPC, trzeba tu
  // będzie dodać właściwe wskazanie celu zamiast zawsze brać partnera.
  const partnerId = state.partner.id;

  modifySpoons(state, -choice.spoonsCost);
  modifyTrust(state, partnerId, choice.trustChange);
  modifyFrustration(state, partnerId, choice.frustrationChange);

  const resultText = choice.resultText.replace(/\\{partnerName\\}/g, state.partner.name);

  state.log.push({
    day: state.day,
    eventId: event.id,
    choiceId: choice.id,
    resultText
  });

  return choice;
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
import { getEventForDay, applyChoice } from "./eventSystem.js";
import { buildPlayer, calculateStartingSpoons } from "./characterSystem.js";
import { generatePartner } from "./partnerSystem.js";

// v0.3: struktura zapisu zyskała pole "partner" (wygenerowany profil)
// i state.npcs jest teraz budowane z wylosowanego partnera zamiast
// statycznego Alexa. To zmiana niekompatybilna ze starymi zapisami
// z v0.2, dlatego wersja rośnie do 3 (patrz też state/saveManager.js).
const SAVE_VERSION = 3;

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

// v0.3: dodaliśmy pole "partner" (wygenerowany profil) do struktury
// zapisu, zastępując statycznego Alexa. To kolejna niekompatybilna
// zmiana ze starszymi zapisami, dlatego wersja rośnie do 3. Starsze
// zapisy (v1, v2) są po prostu odrzucane niżej.
const SUPPORTED_SAVE_VERSION = 3;

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

FILES["js/ui/screens/gameScreen.js"] = """// gameScreen.js
//
// Ekran poranka: pokazuje aktualny dzień, imię gracza, stan spoons,
// zdanie statusu zależne od cech oraz kartę partnera. Stąd gracz
// przechodzi do wydarzenia dnia.
//
// v0.3: partner nie jest już statycznym Alexem z data/npcData.js —
// jego pełny profil (imię, etykieta relacji, opis relacji, wiadomość
// poranna) pochodzi bezpośrednio ze stanu gry (state.partner),
// wygenerowanego przez systems/partnerSystem.js przy starcie gry.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

export function renderGameScreen(container) {
  const state = getState();
  // Zabezpieczenie na wypadek nietypowego stanu bez postaci —
  // w normalnym flow (kreator -> start gry) player zawsze istnieje.
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const header = document.createElement("h2");
  header.textContent = `Dzień ${state.day} — ${playerName}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));

  if (state.player) {
    const statusSentence = document.createElement("p");
    statusSentence.className = "status-sentence";
    statusSentence.textContent = buildStatusSentence(state.player);
    wrapper.appendChild(statusSentence);
  }

  if (state.partner) {
    wrapper.appendChild(renderPartnerCard(state.partner));
  }

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

/**
 * Buduje kartę partnera: imię, etykieta relacji, krótki opis relacji
 * i wiadomość poranna. To kluczowe dla czytelności — gracz musi od razu
 * widzieć, że to osoba partnerska, a nie przypadkowy NPC.
 */
function renderPartnerCard(partner) {
  const card = document.createElement("div");
  card.className = "partner-card";

  const name = document.createElement("p");
  name.className = "partner-name";
  name.textContent = partner.name;
  card.appendChild(name);

  const relationshipLabel = document.createElement("p");
  relationshipLabel.className = "partner-relationship-label";
  relationshipLabel.textContent = partner.relationshipLabel;
  card.appendChild(relationshipLabel);

  const summary = document.createElement("p");
  summary.className = "partner-relationship-summary";
  summary.textContent = partner.relationshipSummary;
  card.appendChild(summary);

  const message = document.createElement("p");
  message.className = "npc-message";
  message.textContent = partner.morningMessage;
  card.appendChild(message);

  return card;
}
"""

FILES["js/ui/screens/eventScreen.js"] = """// eventScreen.js
//
// Ekran wydarzenia decyzyjnego: pokazuje opis sytuacji i dostępne
// wybory. Koszt w spoons jest pokazywany jawnie przy każdej opcji —
// to informacja, nie ocena (zgodnie z zasadą "gra pokazuje konsekwencje,
// nie mówi co jest dobre").

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { getCurrentEvent, resolveEvent } from "../../systems/dayCycle.js";

export function renderEventScreen(container) {
  const event = getCurrentEvent();
  const state = getState();

  const wrapper = document.createElement("div");
  wrapper.className = "screen event-screen";

  const title = document.createElement("h2");
  title.textContent = event.title;
  wrapper.appendChild(title);

  const description = document.createElement("p");
  description.textContent = event.description.replace(/\\{partnerName\\}/g, state.partner.name);
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
"""

FILES["js/ui/screens/mainMenuScreen.js"] = """// mainMenuScreen.js
//
// Ekran menu głównego: pozwala rozpocząć nową grę albo, jeśli istnieje
// zapis, kontynuować poprzednią rozgrywkę od miejsca, w którym została
// zapisana (poranek / wydarzenie / refleksja).

import { showScreen } from "../uiManager.js";
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
    showScreen("characterCreator");
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

  if (!state.player) {
    // Zapis bez postaci (np. bardzo stary format) — traktujemy jak brak
    // użytecznego zapisu, zamiast wywalać błąd gdzieś dalej w UI.
    console.warn("Zapis nie zawiera danych postaci — pomijam wczytywanie.");
    return;
  }

  if (!state.partner) {
    // v0.3: zapis bez wygenerowanego partnera (np. zapis sprzed
    // wprowadzenia generatora partnera) — z tych samych powodów co
    // wyżej, po prostu pomijamy wczytanie zamiast ryzykować błąd w UI.
    console.warn("Zapis nie zawiera danych partnera — pomijam wczytywanie.");
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
"""

NEW_FILES = [
    "js/data/partnerData.js",
    "js/systems/partnerSystem.js",
]

CHANGED_FILES = [
    "js/data/eventData.js",
    "js/systems/eventSystem.js",
    "js/systems/dayCycle.js",
    "js/state/saveManager.js",
    "js/ui/screens/gameScreen.js",
    "js/ui/screens/eventScreen.js",
    "js/ui/screens/mainMenuScreen.js",
    "css/style.css",
]


def main():
    sanity_check()

    print("Out of Spoons - aktualizacja do v0.3 (Generator partnera)")
    print("")

    print("Dodawanie nowych plikow...")
    for path in NEW_FILES:
        write_file(path, FILES[path])

    print("")
    print("Nadpisywanie istniejacych plikow, ktore musialy sie zmienic...")
    for path in CHANGED_FILES:
        write_file(path, FILES[path])

    print("")
    print("Gotowe! Zaktualizowano projekt do v0.3 (Generator partnera).")
    print("")
    print("Partner jest teraz losowany przy kazdej Nowej grze:")
    print("  - imie z puli 10 mozliwosci")
    print("  - etykieta relacji (np. Twoja partnerka, Osoba partnerska)")
    print("  - krotki opis relacji widoczny na karcie partnera")
    print("  - styl komunikacji, potrzeby bliskosci/autonomii, zazdrosc")
    print("    (na razie bierne statystyki, przygotowane pod przyszlosc)")
    print("")
    print("UWAGA: stare zapisy z v0.2 (saveVersion: 2) nie beda juz wczytywalne.")
    print("To oczekiwane - struktura zapisu zmienila sie niekompatybilnie.")
    print("")
    print("Aby uruchomic gre lokalnie:")
    print("  1. python -m http.server 8000")
    print("  2. Otworz w przegladarce: http://localhost:8000")
    print("")


if __name__ == "__main__":
    main()