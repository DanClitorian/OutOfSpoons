r"""
apply_v0_4_event_pool.py

Updater v0.4 dla Out of Spoons: wieksza pula wydarzen + losowanie eventu.

Do tej pory gra codziennie pokazywala dokladnie ten sam event
("Prosba o rozmowe"). Ten updater:

  1. Rozbudowuje pule wydarzen z 1 do 6 (rozmowa z partnerem, odwolanie
     spotkania z powodu braku zasobow, potrzeba odpoczynku, nieporozumienie
     przez wiadomosci tekstowe, zaproszenie na spotkanie towarzyskie,
     obowiazek zyciowy konkurujacy z relacja).
  2. Wprowadza losowanie eventu dnia (respektujace opcjonalne pole minDay
     na kazdym evencie).
  3. Zapewnia stabilnosc wylosowanego eventu w ramach jednego dnia poprzez
     nowe pole state.currentEventId - wydarzenie jest losowane raz, przy
     przejsciu poranek -> event, i nie zmienia sie przy ponownym renderze
     tego samego dnia.

Ten skrypt NIE przebudowuje gry i NIE dodaje nowych duzych systemow (brak
ekonomii, pracy, wielu partnerow, pamieci historii wydarzen). Zaklada, ze
w folderze C:\OutOfSpoons istnieje juz kompletny projekt w wersji v0.3.1
(v0.1 + v0.2 kreator postaci + v0.3 generator partnera + hotfix v0.3.1).

Co robi:
  - nadpisuje dokladnie 4 pliki wymienione w CHANGED_FILES ponizej
  - nie tworzy zadnych nowych plikow
  - NIE rusza pozostalych plikow projektu (kreator postaci, generator
    partnera, ekrany UI poza saveManager/dayCycle/eventSystem pozostaja
    nietkniete)

Uruchomienie (z wnetrza folderu C:\OutOfSpoons):

    cd C:\OutOfSpoons
    python apply_v0_4_event_pool.py

UWAGA: stare zapisy gry (localStorage, saveVersion: 3) przestana byc
odczytywalne po tej aktualizacji - struktura zapisu zmienila sie
w sposob niekompatybilny (doszlo pole "currentEventId"), wiec saveVersion
rosnie do 4. To oczekiwane zachowanie, nie blad.
"""

import os
import sys

# Sciezki plikow sa wzgledne wobec katalogu, w ktorym uruchamiany jest
# ten skrypt. Uruchamiaj go z wnetrza C:\OutOfSpoons.
PROJECT_ROOT = os.getcwd()

# Prosty check bezpieczenstwa: upewniamy sie, ze uruchamiamy skrypt
# we wlasciwym miejscu (projekt v0.3 / v0.3.1 powinien juz tam byc).
SANITY_CHECK_FILE = os.path.join(PROJECT_ROOT, "js", "systems", "partnerSystem.js")


def sanity_check():
    if not os.path.isfile(SANITY_CHECK_FILE):
        print("BLAD: nie znaleziono js/systems/partnerSystem.js w biezacym folderze.")
        print("Ten updater (v0.4) zaklada, ze masz juz zainstalowana wersje v0.3")
        print("(generator partnera). Uruchom najpierw:")
        print("  apply_v0_3_partner_generator.py")
        print("(i opcjonalnie apply_v0_3_1_character_and_partner_fix.py),")
        print("a dopiero potem ten skrypt, z wnetrza folderu C:\\OutOfSpoons.")
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

FILES["js/data/eventData.js"] = """// eventData.js
//
// Statyczna definicja puli wydarzeń decyzyjnych.
//
// v0.4: pula rozrosła się z jednego wydarzenia do sześciu, pokrywających
// różne obszary życia (nie tylko "partner chce rozmawiać"). Każdy event
// ma teraz pole "tags" (kategoryzacja, na razie tylko informacyjna —
// żaden system jeszcze z niej nie korzysta) oraz opcjonalne "minDay"
// (wydarzenie nie pojawi się wcześniej niż danego dnia rozgrywki).
// Losowaniem i respektowaniem minDay zajmuje się systems/eventSystem.js.
//
// Wydarzenia nadal używają placeholdera {partnerName}, podmienianego na
// imię aktualnego partnera z rozgrywki (state.partner.name) przez
// eventSystem.js / eventScreen.js — patrz uzasadnienie w komentarzach
// tamtych plików.

export const eventPool = [
  {
    id: "talk_request",
    title: "Prośba o rozmowę",
    tags: ["relationship", "communication"],
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
  },
  {
    id: "cancel_plans",
    title: "Za mało zasobów na dziś",
    tags: ["relationship", "spoons", "boundaries"],
    description:
      "Masz umówione spotkanie z {partnerName}, ale czujesz, że dzisiaj po prostu nie dasz rady. " +
      "Wieczór zaczyna wyglądać jak zadanie do odhaczenia, a nie coś, na co miałeś/aś ochotę.",
    choices: [
      {
        id: "go_anyway",
        label: "Idziesz mimo wszystko",
        spoonsCost: 3,
        trustChange: 3,
        frustrationChange: -2,
        resultText:
          "Dajesz radę, ale kosztem reszty wieczoru. {partnerName} jest zadowolony/a, " +
          "Ty wracasz do domu kompletnie wydrenowany/a."
      },
      {
        id: "cancel_honestly",
        label: "Odwołujesz, mówiąc wprost dlaczego",
        spoonsCost: 0,
        trustChange: 4,
        frustrationChange: 2,
        resultText:
          "{partnerName} trochę żałuje, ale docenia szczerość. Zostaje Ci reszta energii na dziś."
      },
      {
        id: "cancel_vague",
        label: "Odwołujesz bez wyjaśnienia",
        spoonsCost: 0,
        trustChange: -5,
        frustrationChange: 8,
        resultText:
          "{partnerName} pyta, czy wszystko w porządku. Nie odpowiadasz wprost. " +
          "Cisza między Wami robi się gęstsza niż powinna."
      }
    ]
  },
  {
    id: "need_rest",
    title: "Dzień, w którym nic nie chce ruszyć",
    tags: ["self-care", "spoons"],
    description:
      "Budzisz się i wiesz, że priorytetem powinno być dziś po prostu nic nie robić. " +
      "Świat, jak zwykle, ma inne plany.",
    choices: [
      {
        id: "protect_day",
        label: "Chronisz dzień dla siebie",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: 0,
        resultText: "Nic się nie pali. Świat jakoś przetrwa bez Ciebie przez jeden dzień."
      },
      {
        id: "push_through",
        label: "Przepychasz się przez obowiązki mimo zmęczenia",
        spoonsCost: 4,
        trustChange: 0,
        frustrationChange: 0,
        resultText:
          "Kończysz listę zadań. Ciało wystawi rachunek później, ale na razie masz poczucie kontroli."
      },
      {
        id: "half_measure",
        label: "Robisz tylko to, co absolutnie konieczne",
        spoonsCost: 2,
        trustChange: 0,
        frustrationChange: 0,
        resultText: "Nie wszystko zrobione, ale nie wszystko musiało być. To już coś."
      }
    ]
  },
  {
    id: "text_misunderstanding",
    title: "Wiadomość, którą można czytać na dziesięć sposobów",
    tags: ["communication", "anxiety"],
    description:
      "{partnerName} wysyła wiadomość, która brzmi krócej niż zwykle. Zaczynasz się zastanawiać, " +
      "czy to nic, czy jednak coś.",
    choices: [
      {
        id: "ask_directly",
        label: "Pytasz wprost, o co chodzi",
        spoonsCost: 1,
        trustChange: 6,
        frustrationChange: -3,
        resultText:
          "{partnerName} tłumaczy, że po prostu spieszył/a się między spotkaniami. " +
          "Cała sprawa rozwiewa się w kilka zdań."
      },
      {
        id: "overthink",
        label: "Analizujesz wiadomość przez pół dnia zamiast zapytać",
        spoonsCost: 3,
        trustChange: -1,
        frustrationChange: 1,
        resultText: "Wymyślasz kilka scenariuszy, żaden się nie sprawdza. Zostaje tylko zmęczenie."
      },
      {
        id: "mirror_tone",
        label: "Odpisujesz równie krótko",
        spoonsCost: 0,
        trustChange: -3,
        frustrationChange: 6,
        resultText:
          "{partnerName} pyta później, czy wszystko w porządku. Nie odpowiadasz wprost. " +
          "Cisza między Wami robi się gęstsza niż powinna."
      }
    ]
  },
  {
    id: "social_invitation",
    title: "Zaproszenie na spotkanie towarzyskie",
    tags: ["social", "spoons"],
    minDay: 2,
    description:
      "Znajomi organizują coś w ten weekend. {partnerName} chętnie by poszedł/poszła. " +
      "Ty patrzysz na to zaproszenie jak na kolejną pozycję w budżecie, którego akurat nie masz.",
    choices: [
      {
        id: "go_together",
        label: "Idziecie razem",
        spoonsCost: 4,
        trustChange: 5,
        frustrationChange: -2,
        resultText:
          "Wieczór jest w porządku, ale wracasz do domu na rezerwach. " +
          "{partnerName} był/a zadowolony/a z wieczoru."
      },
      {
        id: "partner_goes_alone",
        label: "Zostajesz w domu, {partnerName} idzie sam/a",
        spoonsCost: 0,
        trustChange: 1,
        frustrationChange: 1,
        resultText:
          "{partnerName} rozumie, choć trochę żal mu/jej, że nie ma Cię obok. " +
          "Ty masz spokojny wieczór."
      },
      {
        id: "decline_both",
        label: "Odmawiacie oboje",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 3,
        resultText:
          "{partnerName} niechętnie się zgadza, choć wygląda na to, że miał/a ochotę pójść."
      }
    ]
  },
  {
    id: "life_obligation",
    title: "Obowiązek, który nie pyta o zgodę",
    tags: ["obligation", "time"],
    minDay: 3,
    description:
      "Formalność, której nie da się przełożyć bez konsekwencji, wchodzi dokładnie w czas, " +
      "który miał należeć do {partnerName}.",
    choices: [
      {
        id: "handle_obligation",
        label: "Zajmujesz się obowiązkiem, przekładasz czas z {partnerName}",
        spoonsCost: 2,
        trustChange: -3,
        frustrationChange: 4,
        resultText:
          "Sprawa załatwiona. {partnerName} mówi, że rozumie — ale czas, którego nie było, " +
          "i tak się nie odda."
      },
      {
        id: "squeeze_both",
        label: "Próbujesz zmieścić jedno i drugie",
        spoonsCost: 5,
        trustChange: 2,
        frustrationChange: -1,
        resultText:
          "Udaje się, ale dzień kończy się wcześniej, niż powinien — z Tobą kompletnie bez sił."
      },
      {
        id: "ask_for_extension",
        label: "Prosisz o przesunięcie terminu obowiązku",
        spoonsCost: 1,
        trustChange: 3,
        frustrationChange: -2,
        resultText: "Zaskakująco się udaje. {partnerName} docenia zmianę priorytetów."
      }
    ]
  }
];
"""

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
import { getEventForDay, getEventById, applyChoice } from "./eventSystem.js";
import { buildPlayer, calculateStartingSpoons } from "./characterSystem.js";
import { generatePartner } from "./partnerSystem.js";

// v0.4: struktura zapisu zyskała pole "currentEventId" — wydarzenie
// dnia jest teraz losowane raz (przy przejściu poranek -> event) i jego
// id trzymane w stanie, żeby ekran wydarzenia zawsze pokazywał to samo
// wydarzenie w ramach jednego dnia, niezależnie od tego, ile razy się
// przerenderuje. To zmiana niekompatybilna ze starymi zapisami z v0.3 /
// v0.3.1, dlatego wersja rośnie do 4 (patrz też state/saveManager.js).
const SAVE_VERSION = 4;

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

// v0.4: dodaliśmy pole "currentEventId" do struktury zapisu — wydarzenie
// dnia jest teraz losowane raz i zapamiętane, żeby było stabilne w ramach
// jednego dnia. To kolejna niekompatybilna zmiana ze starszymi zapisami
// (v1, v2, v3), dlatego wersja rośnie do 4. Starsze zapisy są po prostu
// odrzucane niżej.
const SUPPORTED_SAVE_VERSION = 4;

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

CHANGED_FILES = [
    "js/data/eventData.js",
    "js/systems/eventSystem.js",
    "js/systems/dayCycle.js",
    "js/state/saveManager.js",
]


def main():
    sanity_check()

    print("Out of Spoons - aktualizacja do v0.4 (pula wydarzen + losowanie)")
    print("")

    print("Nadpisywanie plikow...")
    for path in CHANGED_FILES:
        write_file(path, FILES[path])

    print("")
    print("Gotowe! Zaktualizowano projekt do v0.4 (pula wydarzen + losowanie).")
    print("")
    print("Pula wydarzen ma teraz 6 pozycji:")
    print("  - talk_request         (rozmowa z partnerem)")
    print("  - cancel_plans         (odwolanie spotkania z braku zasobow)")
    print("  - need_rest            (potrzeba odpoczynku)")
    print("  - text_misunderstanding (nieporozumienie przez wiadomosci)")
    print("  - social_invitation    (zaproszenie towarzyskie, od dnia 2)")
    print("  - life_obligation      (obowiazek zyciowy, od dnia 3)")
    print("")
    print("Event dnia jest losowany raz i stabilny w ramach dnia")
    print("(state.currentEventId), resetowany dopiero na kolejny dzien.")
    print("")
    print("UWAGA: stare zapisy z v0.3 / v0.3.1 (saveVersion: 3) nie beda juz")
    print("wczytywalne. To oczekiwane - struktura zapisu zmienila sie")
    print("niekompatybilnie (nowe pole currentEventId).")
    print("")
    print("Aby uruchomic gre lokalnie:")
    print("  1. python -m http.server 8000")
    print("  2. Otworz w przegladarce: http://localhost:8000")
    print("")


if __name__ == "__main__":
    main()