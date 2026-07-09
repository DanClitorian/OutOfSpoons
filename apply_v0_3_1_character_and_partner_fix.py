r"""
apply_v0_3_1_character_and_partner_fix.py

Hotfix v0.3.1 dla Out of Spoons. Naprawia dokladnie dwa problemy z v0.3:

Problem 1 - kreator postaci wymuszal wybor 2-5 cech psychologicznych,
co sugerowalo, ze kazda postac musi miec 'zaburzenie', zeby zaczac gre.
Po hotfixie cechy sa w pelni opcjonalne (0-5), a 0 cech oznacza neutralny
profil startowy.

Problem 2 - generator partnera losowal imie i etykiete relacji
(np. 'Twoj partner' / 'Twoja partnerka') calkowicie niezaleznie od siebie,
co dawalo bledne kombinacje typu 'Zuzia - Twoj chlopak'. Po hotfixie imiona
maja metadane gender, a etykieta relacji jest dobierana zgodnie z gender
wylosowanego imienia.

Ten skrypt NIE przebudowuje gry i NIE dodaje nowych systemow. Zaklada, ze
w folderze C:\OutOfSpoons istnieje juz kompletny projekt w wersji v0.3
(v0.1 + v0.2 kreator postaci + v0.3 generator partnera).

Co robi:
  - nadpisuje dokladnie 4 pliki wymienione w CHANGED_FILES ponizej
  - nie tworzy zadnych nowych plikow
  - NIE rusza pozostalych plikow projektu
  - NIE podbija saveVersion - zmiany sa kompatybilne wstecz ze starymi
    zapisami z v0.3 (patrz uzasadnienie w odpowiedzi towarzyszacej temu
    skryptowi); js/state/saveManager.js i js/systems/dayCycle.js
    pozostaja nietkniete

Uruchomienie (z wnetrza folderu C:\OutOfSpoons):

    cd C:\OutOfSpoons
    python apply_v0_3_1_character_and_partner_fix.py
"""

import os
import sys

# Sciezki plikow sa wzgledne wobec katalogu, w ktorym uruchamiany jest
# ten skrypt. Uruchamiaj go z wnetrza C:\OutOfSpoons.
PROJECT_ROOT = os.getcwd()

# Prosty check bezpieczenstwa: upewniamy sie, ze uruchamiamy skrypt
# we wlasciwym miejscu (projekt v0.3 powinien juz tam byc) i ze wersja
# projektu jest wystarczajaco swieza, zeby ten hotfix mial sens.
SANITY_CHECK_FILE = os.path.join(PROJECT_ROOT, "js", "systems", "partnerSystem.js")


def sanity_check():
    if not os.path.isfile(SANITY_CHECK_FILE):
        print("BLAD: nie znaleziono js/systems/partnerSystem.js w biezacym folderze.")
        print("Ten hotfix (v0.3.1) zaklada, ze masz juz zainstalowana wersje v0.3")
        print("(generator partnera). Uruchom najpierw:")
        print("  apply_v0_3_partner_generator.py")
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

FILES["js/systems/characterSystem.js"] = """// characterSystem.js
//
// Logika kreatora postaci: walidacja wyboru cech, budowanie obiektu
// player, wyliczanie startowych spoons na podstawie wybranych cech
// oraz generowanie krótkiego zdania statusu na ekran dnia.
//
// Ten moduł nie dotyka UI ani gameState bezpośrednio — przyjmuje
// dane wejściowe i zwraca gotowe obiekty / wartości.

import { traitsData } from "../data/traitsData.js";

// v0.3.1: cechy są opcjonalne. Gracz może wybrać od 0 do MAX_TRAITS cech —
// wcześniejszy wymóg minimum 2 cech błędnie sugerował, że każda postać
// musi mieć jakieś "zaburzenie", żeby zacząć grę. 0 cech oznacza po
// prostu neutralny profil startowy (patrz buildStatusSentence niżej).
export const MIN_TRAITS = 0;
export const MAX_TRAITS = 5;

const BASE_STARTING_SPOONS = 10;
const MINIMUM_STARTING_SPOONS = 1; // gra musi być grywalna nawet przy wielu cechach obniżających spoons

/**
 * Zwraca pełną listę dostępnych cech (do wyrenderowania checkboxów).
 */
export function getTraitsData() {
  return traitsData;
}

/**
 * Sprawdza, czy liczba wybranych cech mieści się w dozwolonym zakresie.
 */
export function isValidTraitSelection(selectedTraitIds) {
  return selectedTraitIds.length >= MIN_TRAITS && selectedTraitIds.length <= MAX_TRAITS;
}

/**
 * Buduje obiekt player na podstawie danych z kreatora postaci.
 * Zwraca dokładnie kształt wymagany przez gameState:
 * { name, pronouns, traits, flags }
 */
export function buildPlayer({ name, pronouns, selectedTraitIds }) {
  const selectedTraits = selectedTraitIds
    .map((id) => traitsData.find((trait) => trait.id === id))
    .filter(Boolean);

  const flags = {};
  selectedTraits.forEach((trait) => {
    (trait.flags || []).forEach((flagName) => {
      flags[flagName] = true;
    });
  });

  return {
    name: (name || "").trim() || "Bezimienna postać",
    pronouns: (pronouns || "").trim(),
    traits: selectedTraits.map((trait) => trait.id),
    flags
  };
}

/**
 * Wylicza startową (i jednocześnie maksymalną na start rozgrywki)
 * liczbę spoons na podstawie cech gracza. Suma modyfikatorów cech
 * jest odejmowana od bazy, z dolnym limitem MINIMUM_STARTING_SPOONS.
 */
export function calculateStartingSpoons(player) {
  const selectedTraits = player.traits
    .map((id) => traitsData.find((trait) => trait.id === id))
    .filter(Boolean);

  const totalModifier = selectedTraits.reduce(
    (sum, trait) => sum + (trait.spoonsModifier || 0),
    0
  );

  return Math.max(MINIMUM_STARTING_SPOONS, BASE_STARTING_SPOONS + totalModifier);
}

/**
 * Buduje krótkie, nieoceniające zdanie opisujące, jak cechy gracza
 * wpływają na jego funkcjonowanie. Pokazywane na ekranie dnia.
 */
export function buildStatusSentence(player) {
  // v0.3.1: gracz mógł świadomie nie wybrać żadnej cechy — to osobny,
  // jawnie nazwany przypadek, a nie tylko "brak flavor textu".
  if (player.traits.length === 0) {
    return (
      "Dziś zaczynasz z neutralnym profilem obciążenia. To nie znaczy, że będzie łatwo — " +
      "tylko że gra nie dodaje Ci dodatkowych filtrów na start."
    );
  }

  const selectedTraits = player.traits
    .map((id) => traitsData.find((trait) => trait.id === id))
    .filter(Boolean);

  const flavorTexts = selectedTraits
    .map((trait) => trait.flavorText)
    .filter(Boolean);

  if (flavorTexts.length === 0) {
    return "Dziś zaczynasz dzień taki, jaki jesteś.";
  }

  return flavorTexts.join(" ");
}
"""

FILES["js/ui/screens/characterCreatorScreen.js"] = """// characterCreatorScreen.js
//
// Ekran kreatora postaci: imię, zaimki/sposób zwracania się oraz opcjonalny
// wybór 0-5 cech psychologicznych. Cechy są prezentowane jako sposoby
// reakcji na presję, nie jako diagnozy medyczne, i nie są obowiązkowe —
// stąd nagłówek "Jak działa Twoja postać pod presją?" zamiast listy
// jednostek chorobowych.

import { showScreen } from "../uiManager.js";
import { startNewGame } from "../../systems/dayCycle.js";
import {
  getTraitsData,
  isValidTraitSelection,
  MAX_TRAITS
} from "../../systems/characterSystem.js";

export function renderCharacterCreatorScreen(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "screen character-creator-screen";

  const title = document.createElement("h2");
  title.textContent = "Kreator postaci";
  wrapper.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "subtitle";
  intro.textContent = "Stwórz osobę, w którą wcielisz się w tej rozgrywce.";
  wrapper.appendChild(intro);

  const nameInput = appendTextField(wrapper, {
    id: "player-name",
    labelText: "Imię",
    placeholder: "np. Kasia"
  });

  const pronounsInput = appendTextField(wrapper, {
    id: "player-pronouns",
    labelText: "Zaimki / sposób zwracania się",
    placeholder: "np. ona/jej, on/jego, they/them"
  });

  const traitsHeading = document.createElement("h3");
  traitsHeading.className = "section-heading";
  traitsHeading.textContent = "Jak działa Twoja postać pod presją?";
  wrapper.appendChild(traitsHeading);

  const traitsHint = document.createElement("p");
  traitsHint.className = "field-hint";
  traitsHint.textContent =
    `Możesz wybrać do ${MAX_TRAITS} cech, które wpływają na funkcjonowanie postaci pod presją. ` +
    "Możesz też nie wybrać żadnej — to nie są diagnozy, tylko sposoby, w jakie Twoja postać " +
    "reaguje na obciążenie.";
  wrapper.appendChild(traitsHint);

  const errorMessage = document.createElement("p");
  errorMessage.className = "field-error";
  errorMessage.hidden = true;

  const traitsList = document.createElement("div");
  traitsList.className = "traits-list";

  const checkboxes = getTraitsData().map((trait) => {
    const optionLabel = document.createElement("label");
    optionLabel.className = "trait-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = trait.id;
    checkbox.addEventListener("change", (event) => {
      // Twardy limit MAX_TRAITS: jeśli zaznaczenie tego checkboxa
      // przekroczyłoby limit, cofamy je od razu.
      const selectedCount = checkboxes.filter((cb) => cb.checked).length;
      if (selectedCount > MAX_TRAITS) {
        event.target.checked = false;
        return;
      }
      errorMessage.hidden = true;
    });

    const text = document.createElement("span");
    text.textContent = trait.label;

    optionLabel.appendChild(checkbox);
    optionLabel.appendChild(text);
    traitsList.appendChild(optionLabel);

    return checkbox;
  });

  wrapper.appendChild(traitsList);
  wrapper.appendChild(errorMessage);

  const startButton = document.createElement("button");
  startButton.className = "primary-button";
  startButton.textContent = "Start gry";
  startButton.addEventListener("click", () => {
    const selectedTraitIds = checkboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);

    if (!isValidTraitSelection(selectedTraitIds)) {
      errorMessage.textContent = `Możesz wybrać maksymalnie ${MAX_TRAITS} cech.`;
      errorMessage.hidden = false;
      return;
    }

    startNewGame({
      name: nameInput.value,
      pronouns: pronounsInput.value,
      selectedTraitIds
    });

    showScreen("game");
  });
  wrapper.appendChild(startButton);

  container.appendChild(wrapper);
}

/**
 * Pomocnicza funkcja: dodaje do kontenera etykietę + pole tekstowe
 * i zwraca referencję do inputa.
 */
function appendTextField(container, { id, labelText, placeholder }) {
  const label = document.createElement("label");
  label.className = "field-label";
  label.textContent = labelText;
  label.setAttribute("for", id);
  container.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.className = "text-input";
  input.placeholder = placeholder || "";
  container.appendChild(input);

  return input;
}
"""

FILES["js/data/partnerData.js"] = """// partnerData.js
//
// Statyczne pule danych używane przez generator partnera
// (patrz systems/partnerSystem.js). Ten plik nie zawiera żadnej logiki
// losowania — tylko surowe dane, zgodnie z podziałem data / systems / ui.
//
// v0.3.1: partnerNamePool zawiera teraz obiekty { name, gender } zamiast
// gołych stringów imion. To naprawia błąd z v0.3, w którym imię i etykieta
// relacji ("Twój partner" / "Twoja partnerka" / "Osoba partnerska") były
// losowane całkowicie niezależnie od siebie i mogły się nie zgadzać
// (np. "Zuzia — Twój chłopak"). Teraz generator najpierw losuje obiekt
// imienia, a etykietę relacji dobiera na podstawie jego pola gender
// (patrz relationshipLabelsByGender niżej).

// Minimum 8 imion — losowany partner nie musi za każdym razem nazywać
// się tak samo. gender: "female" | "male" | "neutral".
export const partnerNamePool = [
  { name: "Mira", gender: "female" },
  { name: "Kuba", gender: "male" },
  { name: "Ola", gender: "female" },
  { name: "Tomek", gender: "male" },
  { name: "Zuzia", gender: "female" },
  { name: "Adam", gender: "male" },
  { name: "Nina", gender: "female" },
  { name: "Filip", gender: "male" },
  { name: "Hania", gender: "female" },
  { name: "Marek", gender: "male" },
  { name: "Alex", gender: "neutral" },
  { name: "Sasza", gender: "neutral" }
];

// Etykiety relacji pogrupowane po gender wylosowanego imienia. Zawsze
// pokazywane graczowi wprost na karcie partnera — to kluczowe dla
// czytelności: gracz musi od razu wiedzieć, że to osoba partnerska,
// a nie losowy, niezwiązany z nim NPC.
export const relationshipLabelsByGender = {
  female: ["Twoja partnerka", "Twoja dziewczyna", "Osoba partnerska"],
  male: ["Twój partner", "Twój chłopak", "Osoba partnerska"],
  neutral: ["Osoba partnerska", "Twoja osoba partnerska"]
};

// Minimum 6 krótkich opisów relacji — kontekst, w jakim gracz i partner
// się znajdują. Celowo różnorodne: różne etapy, różne dynamiki.
// Bez odniesień do płci partnera, więc nie zależą od gender.
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
//
// v0.3.1: szablony przepisane tak, żeby nie zawierały form typu
// "myślałam/em" (czasowniki czasu przeszłego w 1. os. l.poj. są w polskim
// nacechowane rodzajem gramatycznym). Wszystkie zdania używają czasu
// teraźniejszego, który w tych konstrukcjach nie wymaga takiego wyboru,
// więc wiadomość brzmi naturalnie niezależnie od gender partnera.
export const morningMessageTemplates = [
  "{name} pisze: „Możemy dziś porozmawiać? Mam coś, co siedzi mi w głowie od wczoraj.”",
  "{name} pisze: „Hej, masz dziś trochę czasu? Chcę pogadać o czymś ważnym.”",
  "{name} pisze: „Cześć, myślę o nas ostatnio. Znajdziesz dziś chwilę?”",
  "{name} pisze: „Nic złego się nie stało, ale chcę coś z Tobą omówić.”"
];
"""

FILES["js/systems/partnerSystem.js"] = """// partnerSystem.js
//
// Generator pierwszego partnera. Losuje spójny profil na podstawie puli
// danych z data/partnerData.js. Partner na tym etapie nie ma pamięci
// ani prawdziwego AI — to jednorazowo wylosowany, statyczny profil
// plus kilka podstawowych, na razie biernych statystyk (przygotowanych
// pod przyszłe mechaniki, podobnie jak player.flags z kreatora postaci).
//
// v0.3.1: generator najpierw losuje obiekt imienia ({ name, gender }),
// a dopiero potem dobiera etykietę relacji zgodną z tym gender. To
// naprawia błąd z v0.3, w którym imię i etykieta relacji były losowane
// niezależnie od siebie (np. "Zuzia — Twój chłopak").

import {
  partnerNamePool,
  relationshipLabelsByGender,
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
  // Krok 1: losujemy imię razem z jego gender.
  const nameEntry = pickRandom(partnerNamePool);

  // Krok 2: dopiero teraz dobieramy etykietę relacji spośród opcji
  // pasujących do gender wylosowanego imienia — nigdy niezależnie.
  const relationshipLabelOptions = relationshipLabelsByGender[nameEntry.gender];
  const relationshipLabel = pickRandom(relationshipLabelOptions);

  const relationshipSummary = pickRandom(relationshipSummaries);
  const communicationStyle = pickRandom(communicationStyles);
  const morningMessage = pickRandom(morningMessageTemplates).replace("{name}", nameEntry.name);

  return {
    id: slugify(nameEntry.name),
    name: nameEntry.name,
    gender: nameEntry.gender,
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

CHANGED_FILES = [
    "js/systems/characterSystem.js",
    "js/ui/screens/characterCreatorScreen.js",
    "js/data/partnerData.js",
    "js/systems/partnerSystem.js",
]


def main():
    sanity_check()

    print("Out of Spoons - hotfix v0.3.1 (kreator postaci + generator partnera)")
    print("")

    print("Nadpisywanie plikow...")
    for path in CHANGED_FILES:
        write_file(path, FILES[path])

    print("")
    print("Gotowe! Hotfix v0.3.1 zastosowany.")
    print("")
    print("Problem 1 - naprawiony:")
    print("  Cechy w kreatorze postaci sa teraz w pelni opcjonalne (0-5).")
    print("  0 cech = neutralny profil startowy, startowe spoons = 10.")
    print("")
    print("Problem 2 - naprawiony:")
    print("  Etykieta relacji partnera (np. Twoj partner / Twoja partnerka)")
    print("  jest teraz zawsze zgodna z gender wylosowanego imienia.")
    print("")
    print("saveVersion NIE zostal zmieniony - stare zapisy z v0.3 nadal dzialaja.")
    print("")
    print("Aby uruchomic gre lokalnie:")
    print("  1. python -m http.server 8000")
    print("  2. Otworz w przegladarce: http://localhost:8000")
    print("")


if __name__ == "__main__":
    main()