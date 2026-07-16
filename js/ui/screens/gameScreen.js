// gameScreen.js
//
// Morning screen.
// v0.18: Gameplay UI Layout Reset — przebudowany na nowy, izolowany
// system .oos-* (patrz js/ui/oosLayout.js). Żadnej zależności od
// starych klas .vn-*.
//
// v0.25: Relationship Scars. Ten plik funkcjonalnie się nie zmienił —
// blizny relacyjne nie mają jeszcze osobnego sygnału na poranku w
// v0.25 (tylko reflection + weekly summary, zgodnie ze specyfikacją).
// Import criticalEventSystem.js dostał ?v=250, bo criticalEventSystem.js
// faktycznie zmienił zawartość (dodawanie blizny po porażce w Wielkim
// Teście) — to czysty cache-bust, nie zmiana logiki tego ekranu.
//
// v0.26: Repair Events. Ten plik nadal funkcjonalnie się nie zmienił —
// eventy naprawcze nie mają osobnego sygnału na poranku. Import
// dayAgendaSystem.js dostał ?v=260, bo dayAgendaSystem.js zmienił
// WŁASNE importy eventData.js/eventWeightSystem.js.
//
// v0.27: The Static. calculateDailyStatic(state) wołane TU, raz na
// poranek — funkcja sama sprawdza lastCalculatedDay i nie liczy
// ponownie przy odświeżeniu. Krótka linia dopisywana do narracji
// porankowej TYLKO jeśli intensity >= 1.

// v0.30.5: criticalEventSystem.js zmienił zawartość (dodane pole
// completedDay na wyniku Wielkiego Testu, potrzebne przez
// monthlyLoopSystem.js) — import podbity do ?v=305. Sama logika tego
// ekranu jest NIETKNIĘTA.
//
// v0.31: Content Expansion Pack 1. dayAgendaSystem.js zmienił WŁASNY
// import eventData.js (9 nowych eventów) — import podbity do ?v=310.
// Ten plik funkcjonalnie się nie zmienił.
//
// v0.32: Game Feel / Daily Stakes Pass. calculateDailyStakes(state)
// wołane TU, raz na poranek — ten sam idempotentny wzorzec co Wielki
// Test/Partner Capacity/Static/Metamour/Work powyżej. Krótka linia
// "Stawka dnia: ..." dopisywana do narracji porankowej jako PIERWSZY
// element (zaraz po "Dziś: plan dnia.") — Daily Stakes NIE zmienia
// spoons/trust/frustration/losowania eventów, wyłącznie framing.
//
// v0.33: Masking Debt. resolveMorningMaskingDebt(state) wołane TU,
// PRZED Static (Static ma czytać już obniżone spoons, jeśli rachunek
// zaszedł tego ranka) — jeden idempotentny wzorzec co reszta powyżej.
// W PRZECIWIEŃSTWIE do Daily Stakes/Static/Metamour/Work, Masking
// Debt FAKTYCZNIE zmienia spoons (odejmuje 1-2, nigdy poniżej 0) —
// ale to NIE jest reset ani regeneracja, tylko koszt wynikający z
// wczorajszych decyzji, doliczany do już-persystentnych spoons.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { ensureDailyAgenda } from "../../systems/dayAgendaSystem.js?v=310";
import { saveGame } from "../../state/saveManager.js";
import {
  ensureWeeklyChallengeState,
  getCurrentWeeklyChallenge,
  getWeeklyChallengeCountdown
} from "../../systems/weeklyChallengeSystem.js?v=300";
import {
  ensureCriticalEventState,
  generateNextCriticalEvent,
  getCurrentCriticalEvent,
  getCriticalEventCountdown
} from "../../systems/criticalEventSystem.js?v=305";
import {
  ensurePatternState,
  getLatestPatternEcho
} from "../../systems/patternSystem.js?v=300";
import {
  ensurePartnerCapacityState,
  resolvePartnerDailyCapacity,
  getPartnerCapacityShortLabel
} from "../../systems/partnerCapacitySystem.js?v=300";
import {
  ensureMaskingDebtState,
  resolveMorningMaskingDebt,
  buildMorningMaskingDebtLine
} from "../../systems/maskingDebtSystem.js?v=330";
import {
  ensureRelationshipModelState,
  buildRelationshipModelMorningLine
} from "../../systems/relationshipModelSystem.js?v=340";
import {
  ensureConflictEscalationState,
  evaluateDailyConflictState,
  buildMorningConflictLine
} from "../../systems/conflictEscalationSystem.js?v=350";
import {
  ensureStaticState,
  calculateDailyStatic,
  buildMorningStaticLine
} from "../../systems/staticSystem.js?v=300";
import {
  createGameShell,
  createTopBar,
  createSidebar,
  createScenePanel,
  createNarrativeStrip,
  createCtaButton
} from "../oosLayout.js";

import { ensureMetamourState, rollDailyMetamourSignal, buildMorningMetamourLine } from "../../systems/metamourSystem.js?v=300";
import { ensureWorkPressureState, rollDailyWorkSignal, buildMorningWorkLine } from "../../systems/workPressureSystem.js?v=300";
import { ensureDailyStakesState, calculateDailyStakes, buildMorningStakesLine } from "../../systems/dailyStakesSystem.js?v=320";
import { ensureAchievementState, evaluateAchievements, buildMorningAchievementLine } from "../../systems/achievementSystem.js?v=400";
import {
  ensureSoloRecoveryState,
  isSoloRecoveryActive,
  buildSoloMorningLine,
  getSoloRecoveryChoices,
  applySoloRecoveryChoice,
  advanceSoloRecoveryDay,
  getSoloRecoveryDebugSummary
} from "../../systems/soloRecoverySystem.js?v=430";
export function renderGameScreen(container) {
  const state = getState();

  // v0.20: Monthly Critical Event Foundation. Wielki Test ma istnieć od
  // pierwszego możliwego renderu poranka (w przeciwieństwie do Weekly
  // Stakes, które generują się dopiero po pierwszym weekly summary) —
  // jeśli go jeszcze nie ma, generujemy go tutaj i od razu zapisujemy.
  ensureCriticalEventState(state);
  if (!getCurrentCriticalEvent(state)) {
    generateNextCriticalEvent(state);
    saveGame(state);
  }

  // v0.23: Partner Capacity Foundation. Jeden los dziennie, idempotentny
  // (resolvePartnerDailyCapacity sam sprawdza lastRolledDay). Zapisujemy
  // TYLKO jeśli to faktycznie pierwszy roll dzisiaj — ten sam wzorzec co
  // przy Wielkim Teście powyżej.
  ensurePartnerCapacityState(state);
  const capacityBeforeRoll = state.partner.capacity;
  const alreadyRolledToday = capacityBeforeRoll && capacityBeforeRoll.lastRolledDay === state.day;
  resolvePartnerDailyCapacity(state);
  if (!alreadyRolledToday) {
    saveGame(state);
  }

  // v0.33: Masking Debt. Jedno rozliczenie dziennie, idempotentne
  // (resolveMorningMaskingDebt sam sprawdza lastMorningResolvedDay).
  // Zapisujemy TYLKO jeśli to faktycznie pierwsze rozliczenie dzisiaj.
  // W PRZECIWIEŃSTWIE do reszty systemów tutaj — to NIE jest czysty
  // odczyt: jeśli dług >= 3, ta funkcja FAKTYCZNIE odejmuje 1-2 spoons
  // (nigdy poniżej 0). To celowo dzieje się PRZED Static, żeby Static
  // widział już obniżone spoons tego ranka.
  ensureMaskingDebtState(state);
  const maskingDebtBeforeResolve = state.player.maskingDebt;
  const alreadyResolvedMaskingDebtToday =
    maskingDebtBeforeResolve && maskingDebtBeforeResolve.lastMorningResolvedDay === state.day;
  resolveMorningMaskingDebt(state);
  if (!alreadyResolvedMaskingDebtToday) {
    saveGame(state);
  }

  // v0.27: The Static. Jeden przelicz dziennie, idempotentny
  // (calculateDailyStatic sam sprawdza lastCalculatedDay). Zapisujemy
  // TYLKO jeśli to faktycznie pierwsze przeliczenie dzisiaj — ten sam
  // wzorzec co przy Wielkim Teście / Partner Capacity powyżej. Static
  // NIE zmienia spoons/trust/frustration/dostępności kart — wyłącznie
  // narrację.
  ensureStaticState(state);
  const staticBeforeCalc = state.player.static;
  const alreadyCalculatedToday = staticBeforeCalc && staticBeforeCalc.lastCalculatedDay === state.day;
  calculateDailyStatic(state);
  if (!alreadyCalculatedToday) {
    saveGame(state);
  }

  // v0.28: Metamour daily signal. Jeden los dziennie, idempotentny.
  ensureMetamourState(state);
  const metamourBeforeRoll = state.partner ? state.partner.metamour : null;
  const alreadyMetamourRolledToday = metamourBeforeRoll && metamourBeforeRoll.lastRolledDay === state.day;
  rollDailyMetamourSignal(state);
  if (!alreadyMetamourRolledToday) {
    saveGame(state);
  }

  // v0.29: Work Pressure daily signal. Jeden los dziennie, idempotentny.
  ensureWorkPressureState(state);
  const workBeforeRoll = state.player ? state.player.work : null;
  const alreadyWorkRolledToday = workBeforeRoll && workBeforeRoll.lastRolledDay === state.day;
  rollDailyWorkSignal(state);
  if (!alreadyWorkRolledToday) {
    saveGame(state);
  }

  // v0.32: Game Feel / Daily Stakes Pass. Jedno przeliczenie dziennie,
  // idempotentne (calculateDailyStakes sam sprawdza dailyStakes.day).
  // Zapisujemy TYLKO jeśli to faktycznie pierwsze przeliczenie dzisiaj
  // — ten sam wzorzec co przy pozostałych systemach powyżej. Daily
  // Stakes NIE zmienia spoons/trust/frustration/losowania eventów —
  // wyłącznie framing.
  ensureDailyStakesState(state);
  const stakesBeforeCalc = state.player.dailyStakes;
  const alreadyCalculatedStakesToday = stakesBeforeCalc && stakesBeforeCalc.day === state.day;
  calculateDailyStakes(state);
  if (!alreadyCalculatedStakesToday) {
    saveGame(state);
  }

  // v0.40: Achievements / Milestones. Jedna ocena dziennie,
  // idempotentna. System nie zmienia mechanik, tylko rozpoznaje
  // kamienie milowe i zapisuje je w state.achievements.
  ensureAchievementState(state);
  const achievementsBeforeEval = state.achievements;
  const alreadyEvaluatedAchievementsToday =
    achievementsBeforeEval && achievementsBeforeEval.lastCheckedDay === state.day;
  const achievementResult = evaluateAchievements(state);
  if (!alreadyEvaluatedAchievementsToday || achievementResult.changed) {
    saveGame(state);
  }

  // v0.34: Relationship Model Foundation. Wyłącznie lazy-init — ten
  // system NIE ma dziennego przeliczenia/rolla jak Static/Metamour/
  // Work/Daily Stakes (model relacji nie zmienia się sam z dnia na
  // dzień, tylko przez świadome devTools albo przyszłe systemy), więc
  // nie ma tu żadnego wzorca "already calculated today" ani saveGame.
  ensureRelationshipModelState(state);

  // v0.35: Conflict Escalation Foundation. Jedna ewaluacja dziennie,
  // idempotentna. System nie kończy gry i nie zmienia zasobów — tylko
  // zapisuje stan napięcia relacyjnego, który UI może przeczytać.
  ensureConflictEscalationState(state);
  const conflictBeforeEval = state.partner ? state.partner.conflict : null;
  const alreadyEvaluatedConflictToday =
    conflictBeforeEval && conflictBeforeEval.lastEvaluatedDay === state.day;
  evaluateDailyConflictState(state);
  if (!alreadyEvaluatedConflictToday) {
    saveGame(state);
  }

  ensureSoloRecoveryState(state);
  const isSolo = isSoloRecoveryActive(state);

  if (isSolo) {
    renderSoloRecoveryMorning(container, state);
    return;
  }

  const topbar = createTopBar(state, "game");
  const sidebar = createSidebar(state, "game");

  const scene = createScenePanel({
    modifier: "morning",
    title: `Dzień ${state.day}`
  });

  const narrative = createNarrativeStrip(buildMorningNarrative(state));

  // v0.43.1: usunięty martwy kod — ta gałąź jest osiągana WYŁĄCZNIE
  // gdy isSolo === false (przy isSolo === true funkcja zwróciła już
  // wcześniej, patrz renderSoloRecoveryMorning powyżej), więc gałąź
  // "isSolo ? ... : ..." nigdy się nie wykonywała. Wcześniej prowadziła
  // też do showScreen("soloRecovery") — nieosiągalnego, oderwanego od
  // reszty gry ekranu (soloRecoveryScreen.js), którego dotyczyła ta
  // poprawka.
  const cta = createCtaButton("Otwórz plan dnia", () => {
    ensureDailyAgenda(state);
    saveGame(state);
    showScreen("agenda");
  });

  const achievementsCta = createCtaButton("Osiągnięcia", () => {
    showScreen("achievements");
  });

  const shell = createGameShell({
    screenClass: "morning",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [cta, achievementsCta],
    actionsVariant: "single"
  });

  container.appendChild(shell);
}

// v0.19: Weekly Stakes. Krótki teaser aktywnego wyzwania dopisany jako
// DRUGIE zdanie do tego samego akapitu narracji — celowo bez nowych
// elementów DOM ani zmian w oosLayout.js/CSS (layout v0.18 zostaje
// nietknięty).
//
// v0.20: Monthly Critical Event Foundation. Analogiczny teaser dla
// Wielkiego Testu dopisany jako TRZECIE zdanie w tym samym akapicie.
//
// v0.20.1: Critical Event Visibility + Testability. Pełne zdanie
// "Nowy dzień się zaczyna..." + teasery robiło się zbyt długie i
// ryzykowało ellipsis w wąskim pasku narracji. Gdy istnieje choć jeden
// aktywny system (wzorzec/Weekly Stake/Wielki Test), narracja
// przechodzi na krótszą formę "Dziś: plan dnia. ...". Pełne, "opisowe"
// zdanie zostaje TYLKO wtedy, gdy żaden system jeszcze nie istnieje.
//
// v0.22: Pattern Foundation / Narrative Echoes. Jeśli gracz ma aktywny
// wzorzec zachowania, wstawiane jest "Wzorzec: {tytuł}. {echo}" zaraz
// po "Dziś: plan dnia." — PRZED teaserami Weekly Stake/Wielkiego Testu.
// Pokazujemy TYLKO NAJNOWSZY aktywny wzorzec (getLatestPatternEcho
// zwraca pojedynczy obiekt albo null) — bez nowego panelu, bez zmiany
// layoutu, wciąż jeden string w tym samym elemencie narrative strip.
//
// v0.23: Partner Capacity Foundation. Sygnał partnera dopisany jako
// PIERWSZY teaser (przed wzorcem) — celowo w KRÓTKIEJ formie
// ("Partner: {etykieta}.", bez liczb), bo narracja porankowa już dzieli
// miejsce z Echo/Wzorcem/Weekly Stake/Wielkim Testem i ryzyko ellipsis
// jest realne. Pełna forma zdania z narracyjnym sygnałem (patrz
// SIGNAL_DEFINITIONS w partnerCapacitySystem.js) jest dostępna w
// dailySignal.text, ale świadomie NIE jest tu użyta — priorytet ma
// długość całego akapitu.
//
// v0.27: The Static. Linia szumu dopisywana jako OSTATNI element
// (na końcu, po Wielkim Teście) — TYLKO jeśli intensity >= 1. Static
// jest subtelny i celowo najniższy priorytet w kolejności: jeśli
// narracja robi się zbyt długa, to on jako ostatni naturalnie "wypada"
// z uwagi gracza, zamiast wypychać ważniejsze teasery (Partner/Wzorzec/
// Stawka/Wielki Test), które niosą realną informację o nadchodzących
// wydarzeniach.
//
// v0.32: Game Feel / Daily Stakes Pass. Linia "Stawka dnia: ..."
// dopisywana jako PIERWSZY element (zaraz po "Dziś: plan dnia.",
// przed Partnerem/Wzorcem) — to ma być pierwsze wrażenie dnia, zanim
// gracz zobaczy cokolwiek innego. Zawsze coś zwraca (poza brakiem
// gracza w stanie), więc dopisana jest bezwarunkowo do warunku "czy
// pokazać krótką formę narracji" ponizej.
//
// v0.33: Masking Debt. Linia rachunku za maskowanie dopisywana zaraz
// PO Stawce dnia, PRZED Partnerem — dokładnie w kolejności z ticketu:
// "Dziś: plan dnia." / Daily Stakes / Masking Debt / Partner Capacity
// / Pattern / Weekly Stake / Wielki Test / Static / Metamour / Work.
// Zwraca null w większości poranków (dług < 3 nie generuje kary), więc
// zwykle nic się nie zmienia w długości akapitu.
//
// v0.34: Relationship Model Foundation. Linia o niejasnych ustaleniach
// dopisywana zaraz PO Masking Debt, PRZED Partnerem — dokładnie w
// zaktualizowanej kolejności z ticketu: "Dziś: plan dnia." / Daily
// Stakes / Masking Debt / Relationship Model / Partner Capacity /
// Pattern / Weekly Stake / Wielki Test / Static / Metamour / Work.
// Zwraca null, gdy model jest jasny (type !== "ambiguous" && clarity
// >= 45) — czyli w WIĘKSZOŚCI poranków, celowo "nie spamuje".

// v0.43.3: Solo Recovery Composition. Poprzednie podejście (v0.43.1/
// v0.43.2) próbowało dopasować 5 pełnowymiarowych kart do sztywnego
// 210px wiersza akcji przez samo CSS — to się nie skalowało. Zamiast
// tego: pokazujemy MAKSYMALNIE 3 karty naraz (deterministyczna rotacja
// dzienna, patrz selectDailySoloChoices — soloRecoverySystem.js NIE
// jest tu ruszany, wybieramy tylko, KTÓRE z już istniejących opcji
// pokazać dziś), a kartę wejścia w nową relację pokazujemy jako
// osobny, wąski, wyróżniony CTA WEWNĄTRZ paska narracji (nie jako
// piąta karta w tym samym rzędzie) — dokładnie ten sam, sprawdzony
// wzorzec wstawiania elementu do .oos-narrative, którego użyto już
// dla badge'a Daily Stakes w v0.32.
function renderSoloRecoveryMorning(container, state) {
  const topbar = createTopBar(state, "game");
  const sidebar = createSoloRecoverySidebar(state);

  const scene = createScenePanel({
    modifier: "morning",
    title: "Rekonstrukcja"
  });

  const narrative = createNarrativeStrip(buildSoloRecoveryNarrative(state));

  const { selected, newRelationshipChoice } = selectDailySoloChoices(state, getSoloRecoveryChoices(state));

  if (newRelationshipChoice) {
    narrative.insertBefore(createSoloNewRelationshipCta(state, newRelationshipChoice), narrative.firstChild);
  }

  const actions = selected.map((choice) => createSoloRecoveryChoiceButton(state, choice));

  const shell = createGameShell({
    screenClass: "solo-recovery",
    topbar,
    sidebar,
    scene,
    narrative,
    actions,
    actionsVariant: "flow"
  });

  container.appendChild(shell);
}

// Wybiera, KTÓRE opcje solo pokazać dziś (max 3), i osobno kartę
// wejścia w nową relację, jeśli dostępna. CZYSTA funkcja widoku — nie
// zmienia state.soloRecovery, nie dotyka soloRecoverySystem.js. Jeśli
// opcji bazowych jest więcej niż 3 (obecnie: 4), dzień gry decyduje,
// która jedna jest dziś pominięta — więc gracz widzi rotującą trójkę,
// nie zawsze te same 3 karty.
function selectDailySoloChoices(state, choices) {
  const newRelationshipChoice = choices.find((choice) => choice.id === "start_new_relationship_seed") || null;
  const baseChoices = choices.filter((choice) => choice.id !== "start_new_relationship_seed");

  let selected = baseChoices;
  if (baseChoices.length > 3) {
    const skipIndex = state.day % baseChoices.length;
    selected = baseChoices.filter((_, index) => index !== skipIndex);
  }

  return { selected, newRelationshipChoice };
}

function createSoloNewRelationshipCta(state, choice) {
  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "oos-solo-new-relationship-cta";

  const label = document.createElement("span");
  label.className = "oos-solo-new-relationship-cta__label";
  label.textContent = "Możliwość nowej relacji";
  cta.appendChild(label);

  const text = document.createElement("span");
  text.className = "oos-solo-new-relationship-cta__text";
  text.textContent = choice.title;
  cta.appendChild(text);

  cta.addEventListener("click", () => {
    const result = applySoloRecoveryChoice(state, choice.id);
    if (result && result.applied) {
      advanceSoloRecoveryDay(state);
      saveGame(state);
    }
    showScreen("game");
  });

  return cta;
}

// v0.43.3: sidebar przebudowany na JEDEN skonsolidowany panel statystyk
// (oos-solo-stats-panel + kompaktowe wiersze oos-solo-stat-row) zamiast
// czterech osobnych, dużych, obramowanych kafli. Nowe nazwy klas
// (celowo różne od starego .oos-solo-stat z v0.42.2/v0.43.2) — żeby
// nowy, ciasny styl nie musiał przebijać się przez starą kaskadę.
function createSoloRecoverySidebar(state) {
  const summary = getSoloRecoveryDebugSummary(state);

  const sidebar = document.createElement("aside");
  sidebar.className = "oos-sidebar oos-solo-sidebar";

  const header = document.createElement("section");
  header.className = "oos-solo-sidebar__card";

  const kicker = document.createElement("div");
  kicker.className = "oos-solo-sidebar__kicker";
  kicker.textContent = "Tryb solo";
  header.appendChild(kicker);

  const title = document.createElement("h2");
  title.className = "oos-solo-sidebar__title";
  title.textContent = "Rekonstrukcja";
  header.appendChild(title);

  const text = document.createElement("p");
  text.className = "oos-solo-sidebar__text";
  text.textContent = "Po rozstaniu nie grasz o czyjeś zaufanie. Sprawdzasz, co zabierzesz dalej.";
  header.appendChild(text);

  sidebar.appendChild(header);

  const statsPanel = document.createElement("section");
  statsPanel.className = "oos-solo-stats-panel";

  statsPanel.appendChild(createSoloStatRow("Dni osobno", summary ? summary.daysInSolitude : 0, null));
  statsPanel.appendChild(createSoloStatRow("Samowiedza", summary ? summary.selfKnowledge : 0, 12));
  statsPanel.appendChild(createSoloStatRow("Integralność granic", summary ? summary.boundaryIntegrity : 0, 100));
  statsPanel.appendChild(createSoloStatRow("Przeciążenie społeczne", summary ? summary.socialExhaustion : 0, 12, true));

  sidebar.appendChild(statsPanel);

  return sidebar;
}

function createSoloStatRow(label, value, maxValue, isStrain = false) {
  const row = document.createElement("div");
  row.className = isStrain ? "oos-solo-stat-row oos-solo-stat-row--strain" : "oos-solo-stat-row";

  const top = document.createElement("div");
  top.className = "oos-solo-stat-row__top";

  const labelEl = document.createElement("span");
  labelEl.className = "oos-solo-stat-row__label";
  labelEl.textContent = label;
  top.appendChild(labelEl);

  const valueEl = document.createElement("strong");
  valueEl.className = "oos-solo-stat-row__value";
  valueEl.textContent = String(value ?? 0);
  top.appendChild(valueEl);

  row.appendChild(top);

  if (maxValue) {
    const track = document.createElement("div");
    track.className = "oos-solo-stat-row__track";

    const fill = document.createElement("div");
    fill.className = "oos-solo-stat-row__fill";
    fill.style.setProperty("--solo-stat-fill", `${soloPercent(value, maxValue)}%`);
    track.appendChild(fill);

    row.appendChild(track);
  }

  return row;
}

function soloPercent(value, maxValue) {
  const number = Number(value || 0);
  const max = Number(maxValue || 1);
  return Math.max(0, Math.min(100, Math.round((number / max) * 100)));
}

// v0.43.3: skrócone do JEDNEGO zdania z buildSoloMorningLine — bez
// doklejania dodatkowych zdań jak wcześniej ("Dziś: rekonstrukcja." /
// "Nie szukasz teraz następnej relacji..."). Fallback tylko gdy
// funkcja nic nie zwróci (nie powinno się zdarzyć w aktywnym solo).
function buildSoloRecoveryNarrative(state) {
  return buildSoloMorningLine(state) || "Rekonstrukcja: dziś sprawdzasz, z czym zostajesz sam na sam.";
}

function createSoloRecoveryChoiceButton(state, choice) {
  const button = document.createElement("button");
  button.type = "button";
  // v0.43.1: "oos-choice-card" nie istniało w żadnym pliku CSS —
  // literówka względem realnej, współdzielonej klasy kart wyboru
  // "oos-decision-card". Karty solo dostają teraz TĘ SAMĄ bazową
  // stylistykę (obramowanie, gradient, hover lift, focus ring) co
  // zwykłe karty eventów/agendy — .oos-solo-choice (załadowana
  // później w kaskadzie) nadpisuje tylko to, co faktycznie ma być
  // inne (rozmiar, tło, siatka wewnętrzna).
  button.className = "oos-solo-choice oos-decision-card";

  const title = document.createElement("span");
  title.className = "oos-solo-choice__title";
  title.textContent = choice.title;
  button.appendChild(title);

  const text = document.createElement("span");
  text.className = "oos-solo-choice__text";
  text.textContent = choice.text;
  button.appendChild(text);
  button.addEventListener("click", () => {
    const result = applySoloRecoveryChoice(state, choice.id);
    if (result && result.applied) {
      advanceSoloRecoveryDay(state);
      saveGame(state);
    }
    showScreen("game");
  });

  return button;
}

function buildMorningNarrative(state) {
  const stakesLine = buildMorningStakesLine(state);
  const achievementLine = buildMorningAchievementLine(state);
  const soloLine = buildSoloMorningLine(state);
  const maskingDebtLine = buildMorningMaskingDebtLine(state);
  const relationshipModelLine = buildRelationshipModelMorningLine(state);
  const conflictLine = buildMorningConflictLine(state);
  const partnerTeaser = buildPartnerCapacityTeaser(state);
  const patternTeaser = buildPatternTeaser(state);
  const weeklyTeaser = buildWeeklyStakeTeaser(state);
  const criticalTeaser = buildCriticalEventTeaser(state);
  const staticLine = buildMorningStaticLine(state);
  const metamourLine = buildMorningMetamourLine(state);
  const workLine = buildMorningWorkLine(state);

  if (
    !stakesLine &&
    !achievementLine &&
    !soloLine &&
    !maskingDebtLine &&
    !relationshipModelLine &&
    !conflictLine &&
    !partnerTeaser &&
    !patternTeaser &&
    !weeklyTeaser &&
    !criticalTeaser &&
    !staticLine
  ) {
    return "Nowy dzień się zaczyna. Sprawdź, co czeka na Ciebie, i zdecyduj, czym zajmiesz się najpierw.";
  }

  const parts = [
    "Dziś: plan dnia.",
    stakesLine,
    achievementLine,
    soloLine,
    maskingDebtLine,
    relationshipModelLine,
    conflictLine,
    partnerTeaser,
    patternTeaser,
    weeklyTeaser,
    criticalTeaser,
    staticLine
  ].filter(Boolean);
  if (metamourLine) {
    parts.push(metamourLine);
  }

  if (workLine) {
    parts.push(workLine);
  }

  return parts.join(" ");
}

function buildPartnerCapacityTeaser(state) {
  const shortLabel = getPartnerCapacityShortLabel(state);

  if (!shortLabel) {
    return null;
  }

  return `Partner: ${shortLabel}.`;
}

function buildPatternTeaser(state) {
  ensurePatternState(state);
  const result = getLatestPatternEcho(state);

  if (!result) {
    return null;
  }

  return `Wzorzec: ${result.pattern.title}. ${result.text}`;
}

function buildWeeklyStakeTeaser(state) {
  ensureWeeklyChallengeState(state);
  const challenge = getCurrentWeeklyChallenge(state);

  if (!challenge) {
    return null;
  }

  const daysLeft = getWeeklyChallengeCountdown(state);
  return `Stawka: ${challenge.title} za ${daysLeft} ${dayWord(daysLeft)}.`;
}

function buildCriticalEventTeaser(state) {
  ensureCriticalEventState(state);
  const event = getCurrentCriticalEvent(state);

  if (!event) {
    return null;
  }

  const daysLeft = getCriticalEventCountdown(state);
  return `Wielki Test: ${event.title} za ${daysLeft} ${dayWord(daysLeft)}.`;
}

function dayWord(daysLeft) {
  return daysLeft === 1 ? "dzień" : "dni";
}
