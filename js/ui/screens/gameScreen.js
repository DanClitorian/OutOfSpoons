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
  getSoloRecoveryDebugSummary,
  getCurrentSoloSceneInfo
} from "../../systems/soloRecoverySystem.js?v=450";
import {
  ensureDatingArcState,
  isDatingArcActive,
  startDatingArc,
  getDatingArcChoices,
  applyDatingArcChoice,
  advanceDatingArcDay,
  getDatingArcStageTitle,
  buildDatingArcNarrativeLine,
  getDatingArcDebugSummary
} from "../../systems/datingArcSystem.js?v=450";
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

  // v0.44.1: Choice Feedback Unification. Sprawdzane PRZED dating
  // arc/solo/normal — jeśli jest oczekujący rezultat wyboru (albo
  // transition box "Możliwość nowej relacji"), pokazujemy TEN ekran
  // zamiast normalnego dispatchu. Dzień/etap przechodzi dalej DOPIERO
  // po kliknięciu "Dalej" na tym ekranie — nigdy automatycznie od razu
  // po kliknięciu karty wyboru.
  if (state.transientChoiceResult) {
    renderTransientResultScreen(container, state);
    return;
  }

  // v0.44: Dating Arc Foundation. Sprawdzane PRZED solo recovery —
  // dating arc jest pod-etapem w trakcie okresu solo (isSingle
  // pozostaje true), więc jego ekran ma pierwszeństwo, dopóki jest
  // aktywny. Karta "Możliwość nowej relacji" w renderSoloRecoveryMorning
  // już NIE tworzy partnera bezpośrednio — odpala startDatingArc().
  ensureDatingArcState(state);
  if (isDatingArcActive(state)) {
    renderDatingArcMorning(container, state);
    return;
  }

  ensureSoloRecoveryState(state);
  const isSolo = isSoloRecoveryActive(state);

  if (isSolo) {
    renderSoloRecoveryMorning(container, state);
    return;
  }

  // v0.44.1: "Osiągnięcia" przeniesione z dolnego panelu akcji (gdzie
  // wyglądało jak drugie, równorzędne CTA obok głównej akcji dnia) do
  // małego, subtelnego skrótu w topbarze — meta-ekran nie jest decyzją
  // dnia. showAchievements + onAchievementsClick to opcjonalny 4.
  // parametr createTopBar (patrz oosLayout.js), backward-compatible z
  // resztą ekranów, które go nie przekazują.
  const topbar = createTopBar(state, "game", null, {
    showAchievements: true,
    onAchievementsClick: () => showScreen("achievements")
  });
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

  const shell = createGameShell({
    screenClass: "morning",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [cta],
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

// v0.45: Solo Reconstruction Redesign. Renderuje się w TYM SAMYM
// miejscu co wcześniej (dispatch w renderGameScreen), ale bez belki
// "Możliwość nowej relacji" — ta ścieżka jest teraz JEDNĄ z 3
// równoprawnych opcji w scenie "Rozstrzygnięcie" (patrz
// RESOLUTION_CHOICES w soloRecoverySystem.js), nie osobnym CTA
// wciśniętym w narrację. Scena i narracja zmieniają się PER ODSŁONA
// (getCurrentSoloSceneInfo) — Echo/Granice/Kontakt społeczny/
// Gotowość/Rozstrzygnięcie/Jeszcze trochę/To, czego unikałeś/aś —
// każda inna, żeby gracz WIDZIAŁ ruch, nie tylko czytał inne karty.
function renderSoloRecoveryMorning(container, state) {
  const topbar = createTopBar(state, "game");
  const sidebar = createSoloRecoverySidebar(state);

  const sceneInfo = getCurrentSoloSceneInfo(state);
  const scene = createScenePanel({
    modifier: "morning",
    title: sceneInfo.sceneTitle
  });

  const narrative = createNarrativeStrip(buildSoloRecoveryNarrative(state, sceneInfo));

  const choices = getSoloRecoveryChoices(state);
  const actions = choices.map((choice) => createSoloRecoveryChoiceButton(state, choice));

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

// v0.45: sidebar dostaje piątą pozycję — Echo poprzedniej relacji.
// Kicker/tytuł zostają stałe ("Tryb solo"/"Rekonstrukcja") — to NAZWA
// CAŁEJ fazy, podczas gdy tytuł SCENY (powyżej) zmienia się per
// odsłona. Ten sam, sprawdzony wzorzec skonsolidowanego panelu
// statystyk z v0.43.3 — bez zmian strukturalnych.
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
  statsPanel.appendChild(createSoloStatRow("Echo poprzedniej relacji", summary ? summary.echo : 0, 12, true));

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

// v0.45: narracja czyta z buildSoloMorningLine (per odsłona, patrz
// soloRecoverySystem.js) — sceneInfo.narrative to zapasowa treść na
// wypadek gdyby buildSoloMorningLine nic nie zwróciło (nie powinno się
// zdarzyć w aktywnym solo).
function buildSoloRecoveryNarrative(state, sceneInfo) {
  return buildSoloMorningLine(state) || sceneInfo.narrative;
}

// v0.45: click handler dostosowany do nowego kształtu wyniku — dla
// wyborów w odsłonach (echo/granice/kontakt/gotowość) i dla
// maintenance/high-stakes buduje standardową listę zmian statystyk.
// Dla wyborów ROZSTRZYGNIĘCIA (resolution) nie ma zmian statystyk do
// pokazania (to czyste ścieżki), a nextAction zależy od tego, którą
// ścieżkę gracz wybrał — "otworzyć się na możliwość" dostaje SPECJALNY
// nextAction "start-dating-arc-from-solo" (patrz
// renderTransientResultScreen), pozostałe zwykłe "advance-solo-day".
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
      state.transientChoiceResult = {
        mode: "solo",
        title: choice.title,
        text: result.result || choice.text,
        changes: buildSoloChangesList(choice),
        nextAction: result.startsDatingArc ? "start-dating-arc-from-solo" : "advance-solo-day"
      };
      saveGame(state);
    }
    showScreen("game");
  });

  return button;
}

// Buduje listę { label, direction } z pól *Change już obecnych na
// obiekcie choice — te wartości są STAŁE, znane z góry, ale pokazywane
// graczowi DOPIERO w result boxie po kliknięciu, nigdy jako prognoza
// przed wyborem. Wybory ROZSTRZYGNIĘCIA nie mają tych pól — naturalnie
// zwracają pustą listę (żadnej stat-zmiany do pokazania, tylko
// narracja przejścia).
function buildSoloChangesList(choice) {
  const changes = [];
  if (choice.selfKnowledgeChange) {
    changes.push({ label: "Samowiedza", direction: choice.selfKnowledgeChange > 0 ? "up" : "down" });
  }
  if (choice.boundaryIntegrityChange) {
    changes.push({ label: "Integralność granic", direction: choice.boundaryIntegrityChange > 0 ? "up" : "down" });
  }
  if (choice.socialExhaustionChange) {
    changes.push({ label: "Przeciążenie społeczne", direction: choice.socialExhaustionChange > 0 ? "up" : "down" });
  }
  if (choice.echoChange) {
    changes.push({ label: "Echo poprzedniej relacji", direction: choice.echoChange > 0 ? "up" : "down" });
  }
  return changes;
}

// v0.44: Dating Arc Foundation. Renderuje się w TYM SAMYM miejscu co
// tryb solo (dispatch w renderGameScreen, przed sprawdzeniem solo) —
// reużywa DOKŁADNIE tych samych klas co solo (oos-solo-sidebar,
// oos-solo-sidebar__card, oos-solo-stats-panel, createSoloStatRow,
// oos-solo-choice/oos-decision-card) — świadomie zero nowego, dużego
// UI, zgodnie z ticketem. Sidebar partnera NIE pojawia się, dopóki
// relacja nie zostanie naprawdę rozpoczęta (dating arc ma WŁASNY
// sidebar, patrz createDatingArcSidebar).
function renderDatingArcMorning(container, state) {
  const topbar = createTopBar(state, "game");
  const sidebar = createDatingArcSidebar(state);

  const scene = createScenePanel({
    modifier: "morning",
    title: getDatingArcStageTitle(state)
  });

  const narrative = createNarrativeStrip(buildDatingArcNarrativeLine(state));
  const actions = getDatingArcChoices(state).map((choice) => createDatingArcChoiceButton(state, choice));

  const shell = createGameShell({
    screenClass: "dating-arc",
    topbar,
    sidebar,
    scene,
    narrative,
    actions,
    actionsVariant: "flow"
  });

  container.appendChild(shell);
}

// Sidebar dating arcu — reużywa TYCH SAMYCH klas co sidebar solo
// (oos-solo-sidebar/-card/-stats-panel), tylko z innymi danymi:
// imię prospecta, etap, curiosity/compatibilitySignal/pacePressure/
// redFlags jako kompaktowe paski (createSoloStatRow, patrz wyżej).
// Zero nowego CSS potrzebnego dla samego layoutu.
// v0.44.1: Choice Feedback Unification. Etap jest teraz widoczny jako
// czytelny tekst w kickerze ("Nowy kontakt · Rozmowa"), nie jako
// pozycja w panelu statystyk — zgodnie z wymaganiem "UI musi pokazywać
// stage jako coś bardziej czytelnego niż tylko statystyka". Dodana
// nowa sekcja z green/red flag (krótkie zdania, nie liczby) między
// kartą nagłówkową a panelem statystyk. Panel statystyk zostaje przy
// 4 numerycznych paskach (bez "Etapu", który przeniósł się wyżej).
function createDatingArcSidebar(state) {
  const summary = getDatingArcDebugSummary(state);
  const prospect = summary ? summary.prospect : null;

  const sidebar = document.createElement("aside");
  sidebar.className = "oos-sidebar oos-solo-sidebar";

  const header = document.createElement("section");
  header.className = "oos-solo-sidebar__card";

  const kicker = document.createElement("div");
  kicker.className = "oos-solo-sidebar__kicker";
  kicker.textContent = `Nowy kontakt · ${getDatingArcStageTitle(state)}`;
  header.appendChild(kicker);

  const title = document.createElement("h2");
  title.className = "oos-solo-sidebar__title";
  title.textContent = prospect ? prospect.name : "Ktoś nowy";
  header.appendChild(title);

  const text = document.createElement("p");
  text.className = "oos-solo-sidebar__text";
  text.textContent = prospect
    ? `${prospect.communicationStyle}. ${prospect.relationalIntent}.`
    : "To wciąż możliwość, nie zobowiązanie.";
  header.appendChild(text);

  sidebar.appendChild(header);

  if (prospect) {
    const flags = document.createElement("section");
    flags.className = "oos-dating-arc-flags";

    const green = document.createElement("p");
    green.className = "oos-dating-arc-flags__item oos-dating-arc-flags__item--green";
    green.textContent = prospect.greenFlag;
    flags.appendChild(green);

    const red = document.createElement("p");
    red.className = "oos-dating-arc-flags__item oos-dating-arc-flags__item--red";
    red.textContent = prospect.redFlag;
    flags.appendChild(red);

    sidebar.appendChild(flags);
  }

  const statsPanel = document.createElement("section");
  statsPanel.className = "oos-solo-stats-panel";

  statsPanel.appendChild(createSoloStatRow("Ciekawość", summary ? summary.curiosity : 0, 10));
  statsPanel.appendChild(createSoloStatRow("Zgodność", summary ? summary.compatibilitySignal : 0, 10));
  statsPanel.appendChild(createSoloStatRow("Presja tempa", summary ? summary.pacePressure : 0, 10, true));
  statsPanel.appendChild(createSoloStatRow("Sygnały ostrzegawcze", summary ? summary.redFlags : 0, 10, true));

  sidebar.appendChild(statsPanel);

  return sidebar;
}

// Karta wyboru dating arcu — DOKŁADNIE ta sama para klas co karty solo
// (oos-solo-choice + oos-decision-card), więc dostaje tę samą
// stylistykę bez żadnego nowego CSS. Po kliknięciu: aplikuje wybór,
// przesuwa dzień (ten sam rytm co solo recovery) i wraca do
// renderGameScreen — dispatch tam sam rozpozna, czy dating arc nadal
// jest aktywny (kolejny etap), czy właśnie się rozstrzygnął (partner
// powstał albo gracz wrócił do solo).
// v0.44.1: Choice Feedback Unification. Jak createSoloRecoveryChoiceButton
// — kliknięcie aplikuje wybór, buduje listę zmian z choice.effects
// (deltas znane z góry, ale ujawniane DOPIERO po fakcie) i ustawia
// transientChoiceResult. advanceDatingArcDay() woła się dopiero po
// "Dalej". Działa identycznie niezależnie od outcome (advanced/
// entered/waiting/released) — advanceDatingArcDay() jest bezpieczne do
// wywołania zawsze (nie sprawdza arc.active), więc dzień zawsze
// przechodzi dalej po kliknięciu "Dalej".
function createDatingArcChoiceButton(state, choice) {
  const button = document.createElement("button");
  button.type = "button";
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
    const result = applyDatingArcChoice(state, choice.id);
    if (result && result.applied) {
      state.transientChoiceResult = {
        mode: "dating",
        title: choice.title,
        text: result.resultText || choice.text,
        changes: buildDatingChangesList(choice),
        nextAction: "advance-dating-day"
      };
      saveGame(state);
    }
    showScreen("game");
  });

  return button;
}

// Buduje listę { label, direction } z choice.effects (STAGE_CHOICES w
// datingArcSystem.js) — te same zasady co buildSoloChangesList: brak
// prognozy przed wyborem, tylko odczyt wsteczny w result boxie.
// Wybory terminalne w "define-relationship" nie mają effects — dostają
// pustą listę (result box i tak pokazuje resultText).
function buildDatingChangesList(choice) {
  const effects = choice.effects || {};
  const changes = [];

  if (effects.curiosity) {
    changes.push({ label: "Ciekawość", direction: effects.curiosity > 0 ? "up" : "down" });
  }
  if (effects.compatibilitySignal) {
    changes.push({ label: "Sygnał kompatybilności", direction: effects.compatibilitySignal > 0 ? "up" : "down" });
  }
  if (effects.pacePressure) {
    changes.push({ label: "Presja tempa", direction: effects.pacePressure > 0 ? "up" : "down" });
  }
  if (effects.redFlags) {
    changes.push({ label: "Czerwone flagi", direction: effects.redFlags > 0 ? "up" : "down" });
  }

  return changes;
}

// v0.44.1: Choice Feedback Unification. Jeden, wspólny ekran dla
// WSZYSTKICH trzech przypadków transientChoiceResult:
//   - mode "solo" / "dating": zwykły result box (tytuł wyboru, tekst
//     rezultatu, lista zmian statystyk PO fakcie) z JEDNYM przyciskiem
//     "Dalej", który dopiero teraz woła advanceSoloRecoveryDay() albo
//     advanceDatingArcDay(),
//   - mode "new-relationship-prompt": transition box "Ktoś pojawia się
//     jako możliwość." z DWOMA przyciskami — "Wejdź w kontakt powoli"
//     (odpala startDatingArc()) i "Jeszcze nie teraz" (po prostu
//     zamyka box, gracz zostaje w solo).
// Sidebar podczas result boxa pokazuje AKTUALNY (już zaktualizowany)
// stan — dane już się zmieniły pod spodem, ten ekran tylko pokazuje to
// graczowi, zanim przejdzie dalej.
function renderTransientResultScreen(container, state) {
  const result = state.transientChoiceResult;

  const topbar = createTopBar(state, "game");
  const sidebar = isDatingArcActive(state) ? createDatingArcSidebar(state) : createSoloRecoverySidebar(state);

  const scene = createScenePanel({
    modifier: "morning",
    title: result.title
  });

  const narrative = createNarrativeStrip(result.text);

  if (result.changes && result.changes.length > 0) {
    narrative.appendChild(buildChangesListElement(result.changes));
  }

  const actions = [
    createCtaButton("Dalej", () => {
      const nextAction = result.nextAction;
      state.transientChoiceResult = null;
      if (nextAction === "advance-solo-day") {
        advanceSoloRecoveryDay(state);
      } else if (nextAction === "advance-dating-day") {
        advanceDatingArcDay(state);
      } else if (nextAction === "start-dating-arc-from-solo") {
        // v0.45: rozstrzygnięcie "Otworzyć się na możliwość" — dzień
        // przechodzi dalej TAK SAMO jak po każdym innym wyborze solo
        // (jeden wybór = jeden dzień), a DOPIERO potem dating arc się
        // zaczyna, z nowym prospectem, na już przesuniętym dniu.
        advanceSoloRecoveryDay(state);
        startDatingArc(state, "solo-recovery");
      }
      saveGame(state);
      showScreen("game");
    })
  ];

  const shell = createGameShell({
    screenClass: "choice-result",
    topbar,
    sidebar,
    scene,
    narrative,
    actions,
    actionsVariant: "single"
  });

  container.appendChild(shell);
}

// Buduje wizualną listę zmian ("Samowiedza ↑", "Presja tempa ↓" itd.)
// — TYLKO tekst + kierunek, nigdy surowa liczba delty ani wartość
// bezwzględna. Wywoływane WYŁĄCZNIE w result boxie, PO wyborze.
function buildChangesListElement(changes) {
  const list = document.createElement("div");
  list.className = "oos-choice-result-changes";

  changes.forEach((change) => {
    const item = document.createElement("span");
    item.className = `oos-choice-result-change oos-choice-result-change--${change.direction}`;
    item.textContent = `${change.label} ${change.direction === "up" ? "↑" : "↓"}`;
    list.appendChild(item);
  });

  return list;
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
