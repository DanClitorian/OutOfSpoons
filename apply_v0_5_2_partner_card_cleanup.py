r"""
apply_v0_5_2_partner_card_cleanup.py

Hotfix v0.5.2 dla Out of Spoons: karta partnera nie moze udawac
wydarzenia dnia.

Problem: ekran poranka pokazywal partner.morningMessage - wiadomosc
wylosowana raz przy tworzeniu partnera, ktora potem wygladala identycznie
kazdego dnia. To mylilo graczy: karta partnera wygladala jak wydarzenie dnia,
podczas gdy prawdziwy, losowany kazdego dnia event (z ochrona przed powtorka
z v0.5.1) jest dopiero na ekranie wydarzenia.

Ten hotfix:

  1. Usuwa partner.morningMessage z renderowania na ekranie poranka
     (js/ui/screens/gameScreen.js). Pole zostaje w state.partner -
     nic go nie kasuje - po prostu przestajemy je pokazywac.

  2. Karta partnera pokazuje teraz zamiast tego communicationStyle jako
     subtelny tekst, np. "Styl komunikacji: bezposrednia - mowi wprost,
     czego potrzebuje".

  3. Zmienia tekst przycisku z "Zobacz, co sie dzieje" na "Przejdz do
     wydarzenia dnia" - jasny sygnal, ze dopiero teraz zaczyna sie event.

  4. Dodaje do style.css klase .partner-communication-style - subtelna,
     bez kolorow, spojna z reszta estetyki dziennika.

Ten skrypt NIE rusza eventScreen.js, partnerSystem.js, eventSystem.js,
dayCycle.js ani puli wydarzen. saveVersion NIE zostal zmieniony (to czysto
wizualna zmiana w UI - state.partner.morningMessage nadal istnieje
w strukturze stanu, tylko przestaje byc renderowany).

Zaklada, ze w folderze C:\OutOfSpoons istnieje juz kompletny projekt
w wersji v0.5.1 (v0.1 + v0.2 kreator postaci + v0.3 generator partnera
+ hotfix v0.3.1 + v0.4 pula wydarzen + v0.5 widoczne konsekwencje
+ hotfix v0.5.1 brak natychmiastowej powtorki eventu).

Co robi:
  - nadpisuje dokladnie 2 pliki wymienione w CHANGED_FILES ponizej
  - nie tworzy zadnych nowych plikow
  - NIE rusza pozostalych plikow projektu (eventScreen.js, eventData.js,
    partnerSystem.js, eventSystem.js, dayCycle.js, saveManager.js,
    kreator postaci pozostaja nietkniete)

Uruchomienie (z wnetrza folderu C:\OutOfSpoons):

    cd C:\OutOfSpoons
    python apply_v0_5_2_partner_card_cleanup.py
"""

import os
import sys

# Sciezki plikow sa wzgledne wobec katalogu, w ktorym uruchamiany jest
# ten skrypt. Uruchamiaj go z wnetrza C:\OutOfSpoons.
PROJECT_ROOT = os.getcwd()

# Prosty check bezpieczenstwa: upewniamy sie, ze uruchamiamy skrypt
# we wlasciwym miejscu i ze projekt ma juz karte partnera (v0.3+).
SANITY_CHECK_FILE = os.path.join(PROJECT_ROOT, "js", "ui", "screens", "gameScreen.js")


def sanity_check():
    if not os.path.isfile(SANITY_CHECK_FILE):
        print("BLAD: nie znaleziono js/ui/screens/gameScreen.js w biezacym folderze.")
        print("Uruchom ten skrypt z wnetrza folderu C:\\OutOfSpoons,")
        print("w ktorym istnieje juz projekt z wersji v0.5.1.")
        sys.exit(1)

    with open(SANITY_CHECK_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    if "partner-card" not in content:
        print("BLAD: js/ui/screens/gameScreen.js nie wyglada na wersje z kartą")
        print("partnera (v0.3+). Uruchom najpierw apply_v0_3_partner_generator.py")
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

FILES["js/ui/screens/gameScreen.js"] = """// gameScreen.js
//
// Ekran poranka: pokazuje aktualny dzień, imię gracza, stan spoons,
// zdanie statusu zależne od cech oraz kartę partnera. Stąd gracz
// przechodzi do wydarzenia dnia.
//
// v0.3: partner nie jest już statycznym Alexem z data/npcData.js —
// jego pełny profil (imię, etykieta relacji, opis relacji, styl
// komunikacji) pochodzi bezpośrednio ze stanu gry (state.partner),
// wygenerowanego przez systems/partnerSystem.js przy starcie gry.
//
// v0.5.2: karta partnera przestaje pokazywać partner.morningMessage.
// Ta wiadomość jest losowana raz przy tworzeniu partnera i potem
// wygląda identycznie każdego poranka, co myliło graczy — wyglądało to
// jak wydarzenie dnia, podczas gdy prawdziwe (losowane każdego dnia,
// z ochroną przed powtórką) wydarzenie jest dopiero na eventScreen.
// Karta partnera pokazuje teraz zamiast tego styl komunikacji partnera —
// informację stabilną i niemylącą się z eventem dnia. Pole
// partner.morningMessage zostaje w stanie gry (może się przydać
// w przyszłości), po prostu nic go już tutaj nie renderuje.

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
  continueButton.textContent = "Przejdź do wydarzenia dnia";
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
 * i styl komunikacji. To kluczowe dla czytelności — gracz musi od razu
 * widzieć, że to osoba partnerska, a nie przypadkowy NPC.
 *
 * v0.5.2: karta NIE pokazuje już partner.morningMessage — to pole
 * wyglądało jak wydarzenie dnia, a nim nie jest (patrz komentarz
 * na górze pliku). Zamiast tego pokazujemy styl komunikacji: stabilną,
 * opisową informację o partnerze, która nie zmienia się każdego dnia
 * i nie sugeruje niczego, co nie jest prawdą.
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

  const communicationStyle = document.createElement("p");
  communicationStyle.className = "partner-communication-style";
  communicationStyle.textContent = `Styl komunikacji: ${partner.communicationStyle}`;
  card.appendChild(communicationStyle);

  return card;
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

/* v0.5.2: styl komunikacji partnera na karcie poranka — zastępuje
   dawną wiadomość poranną (partner.morningMessage), która myliła się
   z eventem dnia. Subtelny, informacyjny tekst, bez kolorów. */
.partner-communication-style {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
  margin: 0;
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
    "js/ui/screens/gameScreen.js",
    "css/style.css",
]


def main():
    sanity_check()

    print("Out of Spoons - hotfix v0.5.2 (karta partnera bez wiadomosci porannej)")
    print("")

    print("Nadpisywanie plikow...")
    for path in CHANGED_FILES:
        write_file(path, FILES[path])

    print("")
    print("Gotowe! Hotfix v0.5.2 zastosowany.")
    print("")
    print("Karta partnera na ekranie poranka pokazuje teraz:")
    print("  - imie partnera")
    print("  - etykiete relacji")
    print("  - krotki opis relacji")
    print("  - styl komunikacji (zamiast dawnej wiadomosci porannej)")
    print("")
    print("Przycisk pod karta: \"Przejdz do wydarzenia dnia\"")
    print("")
    print("saveVersion NIE zostal zmieniony - to czysto wizualna zmiana w UI.")
    print("")
    print("Aby uruchomic gre lokalnie:")
    print("  1. python -m http.server 8000")
    print("  2. Otworz w przegladarce: http://localhost:8000")
    print("")


if __name__ == "__main__":
    main()