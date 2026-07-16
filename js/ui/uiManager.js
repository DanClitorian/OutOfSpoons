// uiManager.js
//
// Centralny router ekranów.
// Hotfix v0.9.1:
// - naprawia składnię obiektu screens,
// - rejestruje ekran evening,
// - zachowuje initUI i showScreen,
// - wspiera stare aliasy nazw ekranów.
//
// v0.23: Partner Capacity Foundation. Cache-bust (?v=230) na importach
// gameScreen.js / eventScreen.js / weeklySummaryScreen.js — te 3
// moduły faktycznie zmieniły zawartość w tej wersji, więc przeglądarka
// musi pobrać je na nowo, nie użyć starej wersji z cache. Pozostałe
// ekrany (mainMenu/characterCreator/reflection/evening/agenda) NIE
// zmieniły się w v0.23, więc ich importy zostają bez query — nie było
// potrzeby ich bustować.
//
// v0.24: Pattern Pressure. TYLKO reflectionScreen.js dostaje ?v=240
// (zmienił zawartość — jedno subtelne zdanie o presji wzorca, PO
// decyzji). eventScreen.js CELOWO NIE jest ruszany w v0.24 — Pattern
// Pressure nie może wpływać na dostępność kart przed kliknięciem, więc
// eventScreen.js zostaje dokładnie taki, jaki był w v0.23 (import
// zostaje przy ?v=230, bo to nadal poprawnie wskazuje na jego
// aktualną, niezmienioną zawartość). gameScreen.js i
// weeklySummaryScreen.js też się nie zmieniły — zostają przy ?v=230.
//
// v0.25: Relationship Scars. Wszystkie 4 importy podbite do ?v=250:
// gameScreen.js i eventScreen.js zmieniły się TYLKO cache-bustem
// (import criticalEventSystem.js / dayCycle.js w dół łańcucha — patrz
// komentarze w tych plikach), reflectionScreen.js i
// weeklySummaryScreen.js zmieniły się FUNKCJONALNIE (sygnał blizny w
// reflection, notatka o bliznach w weekly summary).
//
// v0.26: Repair Events. Wszystkie 5 importów (w tym agendaScreen.js
// pierwszy raz) podbite do ?v=260: gameScreen.js i eventScreen.js
// zmieniły się TYLKO cache-bustem w dół łańcucha (dayAgendaSystem.js ->
// eventData.js/eventWeightSystem.js zmieniły się naprawdę), agendaScreen.js
// tak samo (to WŁAŚNIE tam realnie wybierany jest event dla slotu
// agendy, więc jego świeżość jest krytyczna), reflectionScreen.js i
// weeklySummaryScreen.js zmieniły się FUNKCJONALNIE (sygnał naprawy w
// reflection, notatka o gojeniu w weekly summary — dodane fragmentowym
// patchem, nie pełną podmianą, żeby nie ryzykować rozjazdu z realnym
// stanem tego pliku).
//
// v0.27: The Static. gameScreen.js / eventScreen.js / reflectionScreen.js
// / weeklySummaryScreen.js podbite do ?v=270 — wszystkie 4 FAKTYCZNIE
// importują teraz staticSystem.js (nowy plik) i/albo dostały nową
// linię narracyjną. agendaScreen.js NIE zmienił się w v0.27 — zostaje
// przy ?v=260 (nadal poprawnie wskazuje na jego aktualną, niezmienioną
// zawartość).
//
// v0.30.5: Stabilizacja Month One Complete Loop. Trzy importy podbite
// do ?v=305: gameScreen.js i weeklySummaryScreen.js (oba zależą od
// criticalEventSystem.js, które dostało nowe pole completedDay —
// weeklySummaryScreen.js dodatkowo dostał realną poprawkę buga w
// buildFooter(), który wcześniej rzucał ReferenceError przy kliknięciu
// "Rozpocznij kolejny tydzień") i monthSummaryScreen.js (cache-bust w
// dół łańcucha). eventScreen.js / reflectionScreen.js / agendaScreen.js
// NIE zmieniły się w v0.30.5 — zostają przy swoich aktualnych query.
//
// v0.31: Content Expansion Pack 1. gameScreen.js / eventScreen.js /
// reflectionScreen.js / agendaScreen.js podbite do ?v=310 — wszystkie
// 4 zależą (bezpośrednio albo przez dayCycle.js) od
// dayAgendaSystem.js, które zmieniło WŁASNY import eventData.js (9
// nowych eventów). weeklySummaryScreen.js i monthSummaryScreen.js NIE
// importują eventData.js ani dayAgendaSystem.js — zostają NIETKNIĘTE,
// zgodnie z jawnym zakazem w tickecie v0.31 ("nie ruszaj v0.30.5
// stabilizacji poza cache-bustingiem, jeśli jest potrzebny" — tu nie
// był potrzebny).
//
// v0.32: Game Feel / Daily Stakes Pass. gameScreen.js / agendaScreen.js
// / reflectionScreen.js podbite do ?v=320 — wszystkie 3 FAKTYCZNIE
// importują teraz dailyStakesSystem.js (nowy plik) i dostały nową
// linię/badge/zdanie narracyjne. eventScreen.js NIE zmienił się w
// v0.32 (Daily Stakes nie ma sygnału na ekranie eventu w tej wersji) —
// zostaje przy ?v=310. weeklySummaryScreen.js i monthSummaryScreen.js
// NIE zmieniły się — Daily Stakes to system DZIENNY, nie tygodniowy,
// zgodnie z jawną instrukcją ticketu.
//
// v0.33: Masking Debt. gameScreen.js / reflectionScreen.js / eventScreen.js
// podbite do ?v=330: gameScreen.js i reflectionScreen.js FAKTYCZNIE
// importują teraz maskingDebtSystem.js (nowy plik) i dostały nową
// linię/zdanie narracyjne; eventScreen.js zmienił się TYLKO
// cache-bustem w dół łańcucha (dayCycle.js -> eventSystem.js, które
// faktycznie zmieniło zawartość) — CELOWO NIE importuje
// maskingDebtSystem.js samo. agendaScreen.js / weeklySummaryScreen.js
// / monthSummaryScreen.js NIE zmieniły się w v0.33.
//
// v0.34: Relationship Model Foundation. gameScreen.js / agendaScreen.js
// podbite do ?v=340 — oba FAKTYCZNIE importują teraz
// relationshipModelSystem.js (nowy plik) i dostały nową linię
// narracyjną. eventScreen.js / reflectionScreen.js / weeklySummaryScreen.js
// / monthSummaryScreen.js NIE zmieniły się w v0.34.

import { renderMainMenu } from "./screens/mainMenuScreen.js";
import { renderCharacterCreatorScreen } from "./screens/characterCreatorScreen.js";
import { renderGameScreen } from "./screens/gameScreen.js?v=432";
import { renderEventScreen } from "./screens/eventScreen.js?v=370";
import { renderReflectionScreen } from "./screens/reflectionScreen.js?v=390";
import { renderEveningScreen } from "./screens/eveningScreen.js";

import { renderWeeklySummaryScreen } from "./screens/weeklySummaryScreen.js?v=305";
import { appendVersionBadge } from "./versionBadge.js";
import { renderAgendaScreen } from "./screens/agendaScreen.js?v=340";
import { renderMonthSummaryScreen } from "./screens/monthSummaryScreen.js?v=305";
import { renderRelationshipEndScreen } from "./screens/relationshipEndScreen.js?v=420";
import { renderAchievementsScreen } from "./screens/achievementsScreen.js?v=410";
import { renderSoloRecoveryScreen } from "./screens/soloRecoveryScreen.js?v=430";
let appContainer = null;

const screens = {
  mainMenu: renderMainMenu,
  menu: renderMainMenu,

  characterCreator: renderCharacterCreatorScreen,
  "character-creator": renderCharacterCreatorScreen,

  game: renderGameScreen,
  morning: renderGameScreen,

  event: renderEventScreen,
  reflection: renderReflectionScreen,
  evening: renderEveningScreen,
  weeklySummary: renderWeeklySummaryScreen,
  monthSummary: renderMonthSummaryScreen,
  "month-summary": renderMonthSummaryScreen,
  relationshipEnd: renderRelationshipEndScreen,
  "relationship-end": renderRelationshipEndScreen,
  gameOver: renderRelationshipEndScreen,
  achievements: renderAchievementsScreen,
  achievement: renderAchievementsScreen,
  soloRecovery: renderSoloRecoveryScreen,
  "solo-recovery": renderSoloRecoveryScreen,
  agenda: renderAgendaScreen
};

export function initUI(rootElementId = "app") {
  appContainer = document.getElementById(rootElementId);

  if (!appContainer) {
    console.error(`Nie znaleziono elementu #${rootElementId}.`);
    return;
  }
}

export function showScreen(screenName, data = null) {
  if (!appContainer) {
    appContainer = document.getElementById("app");
  }

  if (!appContainer) {
    console.error("UI Manager nie został zainicjalizowany i nie znaleziono #app.");
    return;
  }

  const render = screens[screenName];

  if (!render) {
    console.error("Nieznany ekran:", screenName, "Dostępne ekrany:", Object.keys(screens));

    appContainer.innerHTML = "";

    const error = document.createElement("div");
    error.className = "screen";

    const title = document.createElement("h2");
    title.textContent = "Błąd ekranu";
    error.appendChild(title);

    const text = document.createElement("p");
    text.textContent = `Nieznany ekran: ${screenName}`;
    error.appendChild(text);

    const button = document.createElement("button");
    button.className = "primary-button";
    button.textContent = "Wróć do menu";
    button.addEventListener("click", () => showScreen("mainMenu"));
    error.appendChild(button);

    appContainer.appendChild(error);
    return;
  }

  appContainer.innerHTML = "";
  document.body.dataset.gameScreen = screenName;
  render(appContainer, data);
  // v0.17: appendGameHud() (osobny globalny panel nad ekranem) zostało
  // usunięte stąd celowo — powodowało "podwójny HUD" razem z nowym
  // vn-topbar w vnLayout.js. Dzień/faza/spoons/zaufanie pokazuje teraz
  // wyłącznie vn-topbar, budowany przez każdy ekran gameplayowy z
  // osobna (patrz js/ui/vnLayout.js#createTopBar).
  appendVersionBadge(appContainer);
}
