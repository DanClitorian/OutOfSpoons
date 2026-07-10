r"""
apply_v0_5_1_no_immediate_event_repeat.py

Hotfix v0.5.1 dla Out of Spoons: eventy nie moga powtarzac sie dzien po dniu.

Problem: po v0.4/v0.5 losowanie wydarzenia bylo czysto losowe, wiec ten sam
event mogl (i czesto potrafil) pojawic sie dwa dni z rzedu. Ten hotfix:

  1. Rozszerza eventSystem.getEventForDay(day, previousEventId = null):
     po odfiltrowaniu eventow po minDay, jesli zostaje wiecej niz jedna
     opcja, previousEventId jest wykluczany z puli przed losowaniem.
     Jesli po wykluczeniu nic by nie zostalo (nie powinno sie zdarzyc przy
     > 1 opcji, ale jest zabezpieczone), wraca do pelnej dostepnej puli.

  2. Dodaje eventSystem.getFirstAvailableEvent(day) - deterministyczny
     (nie losowy) wybor pierwszego dostepnego eventu, uzywany jako siatka
     bezpieczenstwa.

  3. Aktualizuje dayCycle.goToEvent(), zeby odczytywac eventId ostatniego
     wpisu w logu (czyli event z poprzedniego dnia) i przekazywac go jako
     previousEventId do getEventForDay.

  4. Dodaje zabezpieczenie w dayCycle.getCurrentEvent(): jesli
     state.currentEventId nie pasuje do zadnego eventu w puli (np. bardzo
     stary lub uszkodzony zapis), gra pokazuje pierwszy dostepny event
     zamiast sie wywalic, i naprawia stan w locie. resolveEvent() korzysta
     teraz z tej samej funkcji (getCurrentEvent), zamiast bezposrednio
     z getEventById, wiec ma te sama siatke bezpieczenstwa.

Ten skrypt NIE przebudowuje gry, NIE dodaje nowych eventow i NIE zmienia
tekstow istniejacych eventow. saveVersion pozostaje bez zmian (5) - struktura
state ani wpisow w logu sie nie zmienila.

Zaklada, ze w folderze C:\OutOfSpoons istnieje juz kompletny projekt
w wersji v0.5 (v0.1 + v0.2 kreator postaci + v0.3 generator partnera
+ hotfix v0.3.1 + v0.4 pula wydarzen + v0.5 widoczne konsekwencje).

Co robi:
  - nadpisuje dokladnie 2 pliki wymienione w CHANGED_FILES ponizej
  - nie tworzy zadnych nowych plikow
  - NIE rusza pozostalych plikow projektu (eventData.js, reflectionScreen.js,
    saveManager.js, kreator postaci, generator partnera pozostaja nietkniete)

Uruchomienie (z wnetrza folderu C:\OutOfSpoons):

    cd C:\OutOfSpoons
    python apply_v0_5_1_no_immediate_event_repeat.py
"""

import os
import sys

# Sciezki plikow sa wzgledne wobec katalogu, w ktorym uruchamiany jest
# ten skrypt. Uruchamiaj go z wnetrza C:\OutOfSpoons.
PROJECT_ROOT = os.getcwd()

# Prosty check bezpieczenstwa: upewniamy sie, ze uruchamiamy skrypt
# we wlasciwym miejscu i ze projekt jest juz w wersji v0.5 (ma pole
# "consequences" w eventSystem.js, wprowadzone w v0.5).
SANITY_CHECK_FILE = os.path.join(PROJECT_ROOT, "js", "systems", "eventSystem.js")


def sanity_check():
    if not os.path.isfile(SANITY_CHECK_FILE):
        print("BLAD: nie znaleziono js/systems/eventSystem.js w biezacym folderze.")
        print("Uruchom ten skrypt z wnetrza folderu C:\\OutOfSpoons,")
        print("w ktorym istnieje juz projekt z wersji v0.5.")
        sys.exit(1)

    with open(SANITY_CHECK_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    if "consequences" not in content:
        print("BLAD: js/systems/eventSystem.js nie wyglada na wersje v0.5")
        print("(brak obslugi consequences). Uruchom najpierw:")
        print("  apply_v0_5_visible_consequences.py")
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
// zawsze zwracać to samo.
//
// v0.5.1: getEventForDay przyjmuje teraz opcjonalny drugi argument,
// previousEventId — event z poprzedniego dnia. Jeśli po filtrze minDay
// zostaje więcej niż jedna opcja, previousEventId jest wykluczany z puli
// przed losowaniem, żeby to samo wydarzenie nie pojawiało się dzień po
// dniu bez potrzeby. To wciąż czysto losowe podejście — nie ma pamięci
// o wydarzeniach starszych niż jeden dzień wstecz (świadomy, minimalny
// zakres tego hotfixu).
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
 *
 * @param {number} day - aktualny dzień rozgrywki.
 * @param {string|null} previousEventId - id wydarzenia z poprzedniego
 *   dnia (jeśli istnieje). Gdy podane, i pula dostępnych wydarzeń ma
 *   więcej niż jedną pozycję, to wydarzenie jest wykluczane z losowania,
 *   żeby uniknąć bezpośredniej powtórki dzień po dniu.
 */
export function getEventForDay(day, previousEventId = null) {
  const eligibleEvents = getEligibleEvents(day);
  // Zabezpieczenie: gdyby filtr minDay z jakiegoś powodu wyciął całą
  // pulę (np. błąd w danych), wracamy do pełnej puli — gra nigdy nie
  // powinna utknąć bez żadnego wydarzenia na dany dzień.
  const pool = eligibleEvents.length > 0 ? eligibleEvents : eventPool;

  let candidates = pool;
  if (pool.length > 1 && previousEventId) {
    const withoutPrevious = pool.filter((event) => event.id !== previousEventId);
    // Jeśli po usunięciu poprzedniego eventu nic nie zostało (nie powinno
    // się zdarzyć przy pool.length > 1, ale zabezpieczamy się i tak),
    // losujemy z pełnej dostępnej puli zamiast zostać bez kandydatów.
    if (withoutPrevious.length > 0) {
      candidates = withoutPrevious;
    }
  }

  return pickRandom(candidates);
}

/**
 * Zwraca pierwsze dostępne (spełniające minDay) wydarzenie dla danego
 * dnia, bez losowania. Używane jako deterministyczna siatka bezpieczeństwa
 * przez dayCycle.getCurrentEvent(), gdyby state.currentEventId z jakiegoś
 * powodu nie pasował do żadnego eventu w puli.
 */
export function getFirstAvailableEvent(day) {
  const eligibleEvents = getEligibleEvents(day);
  const pool = eligibleEvents.length > 0 ? eligibleEvents : eventPool;
  return pool[0];
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

FILES["js/systems/dayCycle.js"] = """// dayCycle.js
//
// Orkiestrator pętli dnia. To jedyne miejsce w kodzie, które "wie",
// w jakiej kolejności następują fazy dnia (poranek -> wydarzenie ->
// refleksja -> kolejny dzień). Woła systemy (spoons, npc, event),
// ale nie dotyka UI — o to, co pokazać na ekranie, dbają moduły w js/ui/.

import { setState, getState } from "../state/gameState.js";
import { initNpc } from "./npcSystem.js";
import { regenerateSpoons } from "./spoonsSystem.js";
import { getEventForDay, getEventById, getFirstAvailableEvent, applyChoice } from "./eventSystem.js";
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
 *
 * v0.5.1: zabezpieczenie na wypadek, gdyby currentEventId z jakiegoś
 * powodu nie pasował do żadnego eventu w puli (np. bardzo stary lub
 * uszkodzony zapis) — zamiast zwrócić undefined i wywalić grę dalej
 * w UI, bierzemy pierwszy dostępny event na dany dzień i naprawiamy
 * stan w locie, żeby kolejne wywołania też były spójne.
 */
export function getCurrentEvent() {
  const state = getState();
  const event = getEventById(state.currentEventId);
  if (event) {
    return event;
  }

  const fallbackEvent = getFirstAvailableEvent(state.day);
  state.currentEventId = fallbackEvent.id;
  return fallbackEvent;
}

/**
 * Przejście z fazy porannej do fazy wydarzenia. To jedyne miejsce, w
 * którym losowane jest wydarzenie dnia — jego id trafia do
 * state.currentEventId i zostaje tam aż do advanceToNextDay().
 *
 * v0.5.1: żeby uniknąć pokazywania tego samego wydarzenia dzień po dniu,
 * odczytujemy eventId z ostatniego wpisu w logu (czyli event
 * z poprzedniego dnia) i przekazujemy go do getEventForDay jako
 * previousEventId — ten wyklucza je z losowania, jeśli jest z czego wybierać.
 */
export function goToEvent() {
  const state = getState();
  const previousEntry = state.log[state.log.length - 1];
  const previousEventId = previousEntry ? previousEntry.eventId : null;
  const event = getEventForDay(state.day, previousEventId);
  state.currentEventId = event.id;
  state.phase = "event";
  return state;
}

/**
 * Aplikuje decyzję gracza w wydarzeniu i przechodzi do fazy refleksji.
 * Wydarzenie pobierane jest przez getCurrentEvent() (nie losowane
 * ponownie), więc wybór gracza zawsze dotyczy dokładnie tego wydarzenia,
 * które widział na ekranie — a przy okazji korzysta z tej samej siatki
 * bezpieczeństwa na wypadek niepasującego currentEventId.
 */
export function resolveEvent(choiceId) {
  const state = getState();
  const event = getCurrentEvent();
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

CHANGED_FILES = [
    "js/systems/eventSystem.js",
    "js/systems/dayCycle.js",
]


def main():
    sanity_check()

    print("Out of Spoons - hotfix v0.5.1 (eventy bez powtorek dzien po dniu)")
    print("")

    print("Nadpisywanie plikow...")
    for path in CHANGED_FILES:
        write_file(path, FILES[path])

    print("")
    print("Gotowe! Hotfix v0.5.1 zastosowany.")
    print("")
    print("Wydarzenie z poprzedniego dnia jest teraz wykluczane z losowania,")
    print("jesli na dany dzien dostepna jest wiecej niz jedna opcja.")
    print("")
    print("saveVersion NIE zostal zmieniony (nadal 5) - stare zapisy z v0.5")
    print("dzialaja bez zmian i od razu korzystaja z nowej logiki.")
    print("")
    print("Aby uruchomic gre lokalnie:")
    print("  1. python -m http.server 8000")
    print("  2. Otworz w przegladarce: http://localhost:8000")
    print("")


if __name__ == "__main__":
    main()