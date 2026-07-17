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
import { ensureDailyAgenda } from "../../systems/dayAgendaSystem.js?v=460";
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
  createCtaButton,
  createDecisionCard,
  createResultTile,
  createPlayerCard,
  buildStatBar
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
// v0.45.1: Solo UI Parity Fix. Poprzednie wersje (v0.43.x-v0.45)
// budowały WŁASNE karty/sidebar/result-box z osobnymi klasami
// (oos-solo-choice, oos-solo-sidebar__*, oos-choice-result-change) —
// wizualnie zbliżone do reszty gry, ale NIE tożsame: inny clamp linii,
// inny padding, inny mechanizm pokazywania zmian (strzałki zamiast
// wartości). Ten redesign PRZESTAJE budować cokolwiek nowego i zamiast
// tego woła DOKŁADNIE te same, współdzielone funkcje z oosLayout.js,
// których używa reszta gry: createDecisionCard() (karty wyboru w
// eventScreen.js/agendaScreen.js), createResultTile() +
// createScenePanel({modifier:"reflection"}) (ekran skutku decyzji w
// reflectionScreen.js), createPlayerCard()+buildStatBar() (sidebar
// partnera). Zero nowego CSS potrzebne — te komponenty i ich style
// już istnieją i są używane wszędzie indziej.
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
    // v0.45.1: "flow" bez żadnego solo-specyficznego override'a siatki
    // (wcześniej .oos-game--solo-recovery .oos-actions--flow wymuszało
    // sztywne 3 kolumny) — DOKŁADNIE ten sam, domyślny
    // auto-fit/minmax(230px,1fr), którego używa eventScreen.js dla
    // swoich 2-4 kart wyboru.
    actionsVariant: "flow"
  });

  container.appendChild(shell);
}

// v0.45.1: sidebar solo zbudowany z DOKŁADNIE tych samych klas co
// sidebar partnera (oos-sidebar > oos-player-card + oos-relationship-card
// z oos-stat-bar w środku) — nie własnych oos-solo-sidebar__*/
// oos-solo-stats-panel. createPlayerCard() jest tym samym, realnym
// komponentem, który normalnie pokazuje imię/dzień/spoons — solo
// dostaje go za darmo, bez zmian. Karta "Rekonstrukcja" poniżej stoi
// dokładnie tam, gdzie normalnie stoi karta relacji.
function createSoloRecoverySidebar(state) {
  const sidebar = document.createElement("aside");
  sidebar.className = "oos-sidebar";

  sidebar.appendChild(createPlayerCard(state, "game"));
  sidebar.appendChild(buildSoloReconstructionCard(state));

  return sidebar;
}

function buildSoloReconstructionCard(state) {
  const summary = getSoloRecoveryDebugSummary(state);

  const card = document.createElement("section");
  card.className = "oos-relationship-card";

  const heading = document.createElement("p");
  heading.className = "oos-relationship-card-heading";
  heading.textContent = "Rekonstrukcja";
  card.appendChild(heading);

  const name = document.createElement("p");
  name.className = "oos-relationship-card-name";
  name.textContent = "Tryb solo";
  card.appendChild(name);

  const label = document.createElement("p");
  label.className = "oos-relationship-card-label";
  label.textContent = `Dni osobno: ${summary ? summary.daysInSolitude : 0}`;
  card.appendChild(label);

  const selfKnowledge = summary ? summary.selfKnowledge : 0;
  const boundaryIntegrity = summary ? summary.boundaryIntegrity : 0;
  const socialExhaustion = summary ? summary.socialExhaustion : 0;
  const echo = summary ? summary.echo : 0;

  card.appendChild(buildStatBar("🧠 Samowiedza", `${selfKnowledge}/12`, soloPercent(selfKnowledge, 12), "trust"));
  card.appendChild(buildStatBar("🛡️ Integralność granic", `${boundaryIntegrity}/100`, soloPercent(boundaryIntegrity, 100), "trust"));
  card.appendChild(buildStatBar("🌀 Przeciążenie społeczne", `${socialExhaustion}/12`, soloPercent(socialExhaustion, 12), "frustration"));
  card.appendChild(buildStatBar("🔁 Echo poprzedniej relacji", `${echo}/12`, soloPercent(echo, 12), "frustration"));

  return card;
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

// v0.45.1: karta wyboru solo to teraz DOSŁOWNIE createDecisionCard() —
// ten sam komponent, którego eventScreen.js/agendaScreen.js używają
// dla swoich kart. title -> title, text -> description (dokładnie to
// pole, którego agendaScreen.js już używa dla swoich opisów slotów).
// Zero własnej klasy, zero własnego DOM-u.
function createSoloRecoveryChoiceButton(state, choice) {
  return createDecisionCard({
    title: choice.title,
    description: choice.text,
    onClick: () => {
      const result = applySoloRecoveryChoice(state, choice.id);
      if (result && result.applied) {
        state.transientChoiceResult = {
          mode: "solo",
          text: result.result || choice.text,
          changes: buildSoloChangesTiles(choice),
          nextAction: result.startsDatingArc ? "start-dating-arc-from-solo" : "advance-solo-day"
        };
        saveGame(state);
      }
      showScreen("game");
    }
  });
}

// v0.45.1: zwraca dane kafelków w KSZTAŁCIE, jakiego oczekuje
// createResultTile() ({icon, label, value, desirableDirection}) —
// DOKŁADNIE ten sam format co buildResultTiles() w reflectionScreen.js
// dla Spoons/Zaufania/Frustracji. Wartości to realne, znane z góry
// delty (choice.*Change) — pokazywane graczowi DOPIERO po kliknięciu,
// w result boxie, nigdy jako prognoza przed wyborem.
// desirableDirection:"down" dla Przeciążenia i Echo — ich WZROST jest
// złym efektem (czerwony kafelek), dokładnie tak samo jak Frustracja w
// reflectionScreen.js.
function buildSoloChangesTiles(choice) {
  const changes = [];
  if (choice.selfKnowledgeChange) {
    changes.push({ icon: "🧠", label: "Samowiedza", value: choice.selfKnowledgeChange });
  }
  if (choice.boundaryIntegrityChange) {
    changes.push({ icon: "🛡️", label: "Integralność granic", value: choice.boundaryIntegrityChange });
  }
  if (choice.socialExhaustionChange) {
    changes.push({ icon: "🌀", label: "Przeciążenie społeczne", value: choice.socialExhaustionChange, desirableDirection: "down" });
  }
  if (choice.echoChange) {
    changes.push({ icon: "🔁", label: "Echo poprzedniej relacji", value: choice.echoChange, desirableDirection: "down" });
  }
  return changes;
}

// v0.44: Dating Arc Foundation. Renderuje się w TYM SAMYM miejscu co
// tryb solo (dispatch w renderGameScreen, przed sprawdzeniem solo).
// v0.45.1: sidebar/karty/result-box reużywają teraz DOKŁADNIE tych
// samych komponentów co solo (patrz komentarze wyżej) — nie osobnych
// klas oos-solo-sidebar__*. Sidebar partnera NIE pojawia się, dopóki
// relacja nie zostanie naprawdę rozpoczęta.
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

// v0.45.1: sidebar dating arcu zbudowany z tych samych klas co sidebar
// partnera (oos-player-card + oos-relationship-card + oos-stat-bar),
// nie własnych oos-solo-sidebar__*. Nagłówek karty pokazuje etap
// czytelnym tekstem ("Nowy kontakt · Rozmowa"), imię i krótki opis
// stylu/intencji prospecta zajmują miejsce, gdzie normalnie jest
// relationshipLabel partnera. Green/red flag jako dodatkowe linie
// tekstu (ta sama klasa oos-relationship-card-label co reszta) — NIE
// jako partner, tylko jako możliwość.
function createDatingArcSidebar(state) {
  const sidebar = document.createElement("aside");
  sidebar.className = "oos-sidebar";

  sidebar.appendChild(createPlayerCard(state, "game"));
  sidebar.appendChild(buildDatingArcCard(state));

  return sidebar;
}

function buildDatingArcCard(state) {
  const summary = getDatingArcDebugSummary(state);
  const prospect = summary ? summary.prospect : null;

  const card = document.createElement("section");
  card.className = "oos-relationship-card";

  const heading = document.createElement("p");
  heading.className = "oos-relationship-card-heading";
  heading.textContent = `Nowy kontakt · ${getDatingArcStageTitle(state)}`;
  card.appendChild(heading);

  const name = document.createElement("p");
  name.className = "oos-relationship-card-name";
  name.textContent = prospect ? prospect.name : "Ktoś nowy";
  card.appendChild(name);

  const label = document.createElement("p");
  label.className = "oos-relationship-card-label";
  label.textContent = prospect
    ? `${prospect.communicationStyle}. ${prospect.relationalIntent}.`
    : "To wciąż możliwość, nie zobowiązanie.";
  card.appendChild(label);

  if (prospect) {
    const flags = document.createElement("p");
    flags.className = "oos-relationship-card-label";
    flags.textContent = `${prospect.greenFlag} — ${prospect.redFlag}`;
    card.appendChild(flags);
  }

  const curiosity = summary ? summary.curiosity : 0;
  const compatibilitySignal = summary ? summary.compatibilitySignal : 0;
  const pacePressure = summary ? summary.pacePressure : 0;
  const redFlags = summary ? summary.redFlags : 0;

  card.appendChild(buildStatBar("✨ Ciekawość", `${curiosity}/10`, soloPercent(curiosity, 10), "trust"));
  card.appendChild(buildStatBar("💬 Sygnał kompatybilności", `${compatibilitySignal}/10`, soloPercent(compatibilitySignal, 10), "trust"));
  card.appendChild(buildStatBar("⏱️ Presja tempa", `${pacePressure}/10`, soloPercent(pacePressure, 10), "frustration"));
  card.appendChild(buildStatBar("🚩 Czerwone flagi", `${redFlags}/10`, soloPercent(redFlags, 10), "frustration"));

  return card;
}

// v0.45.1: karta wyboru dating arcu to DOSŁOWNIE createDecisionCard(),
// jak w solo. Po kliknięciu: aplikuje wybór, buduje kafelki zmian w
// formacie createResultTile() i ustawia transientChoiceResult.
// advanceDatingArcDay() woła się dopiero po "Dalej".
function createDatingArcChoiceButton(state, choice) {
  return createDecisionCard({
    title: choice.title,
    description: choice.text,
    onClick: () => {
      const result = applyDatingArcChoice(state, choice.id);
      if (result && result.applied) {
        state.transientChoiceResult = {
          mode: "dating",
          text: result.resultText || choice.text,
          changes: buildDatingChangesTiles(choice),
          nextAction: "advance-dating-day"
        };
        saveGame(state);
      }
      showScreen("game");
    }
  });
}

// Jak buildSoloChangesTiles — {icon, label, value, desirableDirection}
// z choice.effects. Wybory terminalne w "define-relationship" mogą
// mieć effects (enter_slow/enter_fast) albo nie (not_yet/let_go) —
// naturalnie pusta lista, jeśli nie mają.
function buildDatingChangesTiles(choice) {
  const effects = choice.effects || {};
  const changes = [];

  if (effects.curiosity) {
    changes.push({ icon: "✨", label: "Ciekawość", value: effects.curiosity });
  }
  if (effects.compatibilitySignal) {
    changes.push({ icon: "💬", label: "Sygnał kompatybilności", value: effects.compatibilitySignal });
  }
  if (effects.pacePressure) {
    changes.push({ icon: "⏱️", label: "Presja tempa", value: effects.pacePressure, desirableDirection: "down" });
  }
  if (effects.redFlags) {
    changes.push({ icon: "🚩", label: "Czerwone flagi", value: effects.redFlags, desirableDirection: "down" });
  }

  return changes;
}

// v0.45.1: Solo UI Parity Fix. Ekran skutku decyzji solo/dating to
// teraz DOSŁOWNIE ten sam layout co reflectionScreen.js —
// createScenePanel({modifier:"reflection", title:"Skutek decyzji"})
// (TA SAMA, stała nazwa sceny co w relacji — nie tytuł klikniętej
// karty), createResultTile() kafelki + createCtaButton() w JEDNYM
// rzędzie akcji z actionsVariant:"reflection" (dokładnie ten wariant,
// którego reflectionScreen.js używa dla [...tiles, cta]). Zero
// własnego "belka zmian pod narracją" — kafelki żyją w dolnym pasku
// akcji, tam gdzie w całej reszcie gry.
function renderTransientResultScreen(container, state) {
  const result = state.transientChoiceResult;

  const topbar = createTopBar(state, "game");
  const sidebar = isDatingArcActive(state) ? createDatingArcSidebar(state) : createSoloRecoverySidebar(state);

  const scene = createScenePanel({
    modifier: "reflection",
    title: "Skutek decyzji"
  });

  const narrative = createNarrativeStrip(result.text);

  const tiles = (result.changes || []).map((change) => createResultTile(change));

  const cta = createCtaButton("Dalej", () => {
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
  });

  const shell = createGameShell({
    screenClass: "reflection",
    topbar,
    sidebar,
    scene,
    narrative,
    actions: [...tiles, cta],
    actionsVariant: "reflection"
  });

  container.appendChild(shell);
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
