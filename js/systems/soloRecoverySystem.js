// soloRecoverySystem.js
//
// v0.45: Solo Reconstruction Redesign.
//
// PEŁNY REDESIGN, nie łatka na starej pętli. Poprzednia wersja (v0.42-
// v0.44.1) miała płaską pulę 4 stałych kart, które gracz mógł klikać
// bez końca, aż sam zdecydował kliknąć belkę nowej relacji — to nie
// był ciąg scen, tylko klikalna tabelka bez kierunku.
//
// Teraz solo to SEKWENCJA 4 nazwanych odsłon, każda inna:
//   Echo -> Granice -> Kontakt społeczny -> Gotowość
// Po czwartej odsłonie następuje ROZSTRZYGNIĘCIE — gracz wybiera jedną
// z trzech ścieżek (nigdy kolejną nieskończoną pulę):
//   - otworzyć się na sygnał nowego kontaktu (odpala dating arc),
//   - świadomie zostać solo na OKREŚLONY czas (maintenance, max ~5 dni,
//     potem rozstrzygnięcie wraca WYMUSZONE, nie można go uniknąć
//     w nieskończoność),
//   - zmierzyć się z czymś, czego gracz unikał (jedno intensywne
//     wydarzenie wysokiej stawki, potem rozstrzygnięcie wraca z
//     obniżonym Echo).
//
// Echo poprzedniej relacji to NOWA statystyka — działa jako napięcie
// interpretacyjne, nie pasek do nabijania: wysokie Echo zniekształca
// odbiór dating arcu i utrudnia start nowej relacji (patrz
// newRelationshipSeedSystem.js). Niskie Echo NIE znaczy "wyleczone" —
// tylko "więcej przestrzeni". Część wyborów obniża je przez integrację
// (echoChange ujemne, trwałe), część tylko przykrywa aktywnością
// (echoChange = 0, ale wybór ma tag "avoidance" — echo wraca, bo nigdy
// nie zostało dotknięte).
//
// Integracja z patternSystem.js: WYŁĄCZNIE przez już istniejące,
// eksportowane funkcje recordPatternEntry()/evaluatePatterns() — ten
// plik (podobnie jak patternSystem.js) NIE JEST tu w ogóle
// modyfikowany. Wybory solo z polem patternTags karmią te same
// wzorce (avoidance/people-pleasing/overextension/repair/rest/
// transparency), które działały w relacji.

import { startNewRelationshipFromProspect } from "./newRelationshipSeedSystem.js?v=450";
import { recordPatternEntry, evaluatePatterns } from "./patternSystem.js?v=300";

const MAX_HISTORY = 40;
const MAINTENANCE_SPAN_DAYS = 5;

// Kolejność odsłon fazy A. Po ostatniej (readiness) solo.beat
// przechodzi na "resolution" — NIE z powrotem na "echo".
const BEAT_ORDER = ["echo", "boundaries", "social-contact", "readiness"];

// --------------------------------------------------------------------
// Treść: 4 odsłony, każda z 2-3 wyborami — WŁASNYM tytułem sceny,
// własną narracją otwierającą, własnym zestawem wyborów. Żadna karta
// się nie powtarza między odsłonami.
// --------------------------------------------------------------------

const BEATS = {
  echo: {
    sceneTitle: "Echo",
    narrative: "Coś z poprzedniej relacji jeszcze się w Tobie odzywa. Pytanie brzmi, co z tym dziś zrobisz.",
    choices: [
      {
        id: "echo_confront",
        spoonsCost: 2,
        title: "Zmierzyć się z tym wprost",
        text: "Przeczytać do końca to, czego wcześniej nie dało się dokończyć.",
        selfKnowledgeChange: 2,
        echoChange: -2,
        patternTags: ["transparency"],
        result: "Nic się nie naprawiło. Ale przestałeś/aś to obchodzić z daleka."
      },
      {
        id: "echo_bury_in_tasks",
        spoonsCost: 1,
        title: "Zagłuszyć to robotą",
        text: "Wypełnić dzień, żeby nie zostało miejsca na myślenie.",
        socialExhaustionChange: 1,
        echoChange: 0,
        patternTags: ["avoidance", "overextension"],
        result: "Dzień zniknął. Echo zostało — tylko ciszej."
      },
      {
        id: "echo_tell_someone",
        spoonsCost: 1,
        title: "Nazwać to komuś",
        text: "Powiedzieć wprost, co jeszcze boli, zamiast nosić to samemu/samej.",
        boundaryIntegrityChange: 1,
        echoChange: -1,
        patternTags: ["repair"],
        result: "Powiedziane na głos waży inaczej niż noszone w środku."
      }
    ]
  },
  boundaries: {
    sceneTitle: "Granice",
    narrative: "Część starych zasad była Twoja. Część należała do kogoś innego. Czas to rozdzielić.",
    choices: [
      {
        id: "boundary_refuse",
        spoonsCost: 1,
        title: "Odmówić czegoś, na co wcześniej zawsze się zgadzałeś/aś",
        text: "Powiedzieć nie tam, gdzie kiedyś automatycznie było tak.",
        boundaryIntegrityChange: 3,
        patternTags: ["transparency"],
        result: "Nikt nie umarł. Przetrwałeś/aś odmowę też."
      },
      {
        id: "boundary_retest",
        spoonsCost: 0,
        title: "Przetestować starą granicę na nowo",
        text: "Sprawdzić, czy stara zasada nadal ma sens, czy tylko nawyk.",
        selfKnowledgeChange: 1,
        boundaryIntegrityChange: 1,
        result: "Część granic była Twoja. Część należała do kogoś innego."
      },
      {
        id: "boundary_ignore_discomfort",
        spoonsCost: 0,
        title: "Zignorować własny dyskomfort, żeby nie robić problemu",
        text: "Przemilczeć to, co uwiera, bo tak prościej dla wszystkich.",
        boundaryIntegrityChange: -1,
        socialExhaustionChange: 1,
        patternTags: ["people-pleasing"],
        result: "Prościej teraz. Rachunek przyjdzie później."
      }
    ]
  },
  "social-contact": {
    sceneTitle: "Kontakt społeczny",
    narrative: "Świat dalej istnieje, niezależnie od tego, co się stało w relacji. Pytanie, czy dziś masz siłę to sprawdzić.",
    choices: [
      {
        id: "social_reach_out",
        spoonsCost: 1,
        title: "Odezwać się do kogoś, z kim dawno nie rozmawiałeś/aś",
        text: "Napisać bez planu, tylko żeby sprawdzić, czy kontakt jeszcze tam jest.",
        selfKnowledgeChange: 1,
        socialExhaustionChange: 1,
        result: "Rozmowa nie naprawiła samotności. Ale ją przewietrzyła."
      },
      {
        id: "social_walk_without_purpose",
        spoonsCost: 0,
        title: "Wyjść z domu bez celu",
        text: "Nie po nic konkretnego. Tylko żeby być gdzieś innym.",
        echoChange: -1,
        result: "Świat dalej istniał, niezależnie od Twojej relacji."
      },
      {
        id: "social_stay_home",
        spoonsCost: 0,
        title: "Zostać w domu, bo dziś nie ma siły",
        text: "Nie zmuszać się do kontaktu, którego nie czujesz.",
        socialExhaustionChange: -1,
        patternTags: ["rest"],
        result: "Odpoczynek nie jest cofnięciem się. Jest częścią trasy."
      }
    ]
  },
  readiness: {
    sceneTitle: "Gotowość",
    narrative: "Cztery odsłony prawie za Tobą. Zostało jedno pytanie, na które nikt inny nie odpowie za Ciebie.",
    choices: [
      {
        id: "readiness_ask_self",
        spoonsCost: 1,
        title: "Spytać siebie wprost, czego chcesz",
        text: "Bez gotowej odpowiedzi. Tylko z samym pytaniem.",
        selfKnowledgeChange: 2,
        echoChange: -1,
        result: "Pytanie nie miało jeszcze pełnej odpowiedzi. Ale zostało zadane."
      },
      {
        id: "readiness_avoid_question",
        spoonsCost: 0,
        title: "Unikać tego pytania jeszcze trochę",
        text: "Nie dziś. Może jutro.",
        socialExhaustionChange: 1,
        patternTags: ["avoidance"],
        result: "Pytanie poczeka. Nie zniknie."
      },
      {
        id: "readiness_ask_someone_close",
        spoonsCost: 1,
        title: "Zapytać kogoś bliskiego, co widzi z zewnątrz",
        text: "Poprosić o inny punkt widzenia niż własny.",
        selfKnowledgeChange: 1,
        boundaryIntegrityChange: 1,
        patternTags: ["transparency"],
        result: "Cudze spojrzenie nie jest wyrokiem. Jest tylko drugim punktem odniesienia."
      }
    ]
  }
};

// --------------------------------------------------------------------
// Rozstrzygnięcie po odsłonie "readiness" — DOKŁADNIE 3 ścieżki, żadna
// nie prowadzi do kolejnej nieskończonej puli.
// --------------------------------------------------------------------

const RESOLUTION_CHOICES = [
  {
    id: "resolution_open_to_signal",
    title: "Otworzyć się na możliwość",
    text: "Przestać pilnować, żeby nic się nie wydarzyło.",
    path: "signal"
  },
  {
    id: "resolution_stay_solo",
    title: "Zostać z tym, co jest, jeszcze trochę",
    text: `Dać sobie ${MAINTENANCE_SPAN_DAYS} dni bez decyzji o kimś nowym.`,
    path: "maintenance"
  },
  {
    id: "resolution_face_avoided",
    title: "Zmierzyć się z czymś, czego unikałeś/aś",
    text: "Zanim cokolwiek ruszy dalej, jedna sprawa domaga się odpowiedzi.",
    path: "high-stakes"
  }
];

const MAINTENANCE_CHOICES = [
  {
    id: "maintenance_routine",
        spoonsCost: 0,
    title: "Trzymać rutynę",
    text: "Nic dramatycznego. Zwykły dzień, zwykłe czynności.",
    socialExhaustionChange: -1,
    result: "Nic dramatycznego. To też jest budowanie czegoś."
  },
  {
    id: "maintenance_let_it_be_flat",
        spoonsCost: 0,
    title: "Pozwolić dniu być nijakim",
    text: "Bez narracji o postępie. Po prostu dzień.",
    result: "Nie każdy dzień musi coś oznaczać."
  }
];

const HIGH_STAKES_CHOICES = [
  {
    id: "high_stakes_confront",
        spoonsCost: 2,
    title: "Zmierzyć się z tym wprost",
    text: "Przestać odkładać sprawę, która wraca za każdym razem, kiedy jest cicho.",
    selfKnowledgeChange: 2,
    echoChange: -4,
    patternTags: ["transparency", "repair"],
    result: "To nie zniknęło. Ale przestało prowadzić."
  },
  {
    id: "high_stakes_postpone_again",
        spoonsCost: 1,
    title: "Odsunąć to jeszcze raz",
    text: "Nie dziś. Może kiedy będzie mniej trudno.",
    socialExhaustionChange: 1,
    echoChange: -1,
    patternTags: ["avoidance"],
    result: "Odsunięte. Nie rozwiązane. Ale lżejsze o jeden dzień."
  }
];

// --------------------------------------------------------------------
// Stan
// --------------------------------------------------------------------

export function ensureSoloRecoveryState(state) {
  if (!state || !state.player) {
    return null;
  }

  if (!state.soloRecovery) {
    state.soloRecovery = {
      active: false,
      startedDay: null,
      daysInSolitude: 0,
      selfKnowledge: 0,
      socialExhaustion: 0,
      boundaryIntegrity: 50,
      echo: 6,
      beat: "echo",
      stayUntilDay: null,
      readyForNewRelationship: false,
      lastChoiceDay: null,
      lastResult: null,
      lessons: [],
      history: []
    };
  }

  if (!Array.isArray(state.soloRecovery.lessons)) {
    state.soloRecovery.lessons = [];
  }

  if (!Array.isArray(state.soloRecovery.history)) {
    state.soloRecovery.history = [];
  }

  if (typeof state.soloRecovery.echo !== "number") {
    state.soloRecovery.echo = 6;
  }

  if (!state.soloRecovery.beat) {
    state.soloRecovery.beat = "echo";
  }

  state.player.isSingle = state.soloRecovery.active === true;
  state.soloRecovery.selfKnowledge = clamp(state.soloRecovery.selfKnowledge, 0, 12);
  state.soloRecovery.socialExhaustion = clamp(state.soloRecovery.socialExhaustion, 0, 12);
  state.soloRecovery.boundaryIntegrity = clamp(state.soloRecovery.boundaryIntegrity, 0, 100);
  state.soloRecovery.echo = clamp(state.soloRecovery.echo, 0, 12);

  return state.soloRecovery;
}

export function isSoloRecoveryActive(state) {
  return !!(state && state.player && state.player.isSingle === true && state.soloRecovery && state.soloRecovery.active === true);
}

export function enterSoloRecovery(state, source = "relationship-end") {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  if (!Array.isArray(state.relationshipHistory)) {
    state.relationshipHistory = [];
  }

  const alreadyArchivedToday = state.relationshipHistory.some((entry) => entry && entry.endedDay === state.day && entry.source === source);
  if (!alreadyArchivedToday) {
    state.relationshipHistory.push({
      endedDay: state.day,
      source,
      partnerSnapshot: snapshotPartner(state),
      endSummary: snapshotRelationshipEnd(state),
      scars: state.partner && Array.isArray(state.partner.scars) ? cloneSafe(state.partner.scars) : [],
      resolvedScars: state.partner && Array.isArray(state.partner.resolvedScars) ? cloneSafe(state.partner.resolvedScars) : [],
      patterns: state.patterns && Array.isArray(state.patterns.active) ? cloneSafe(state.patterns.active) : []
    });
  }

  solo.active = true;
  solo.startedDay = solo.startedDay || state.day;
  solo.daysInSolitude = Math.max(0, state.day - solo.startedDay);
  solo.beat = "echo";
  solo.stayUntilDay = null;
  solo.echo = 6;
  solo.readyForNewRelationship = false;
  solo.lastResult = null;

  state.player.isSingle = true;
  state.phase = "morning";

  if (state.relationshipEnd) {
    state.relationshipEnd.active = false;
    state.relationshipEnd.seen = true;
  }

  if (state.partner) {
    state.partner.status = "ex";
  }

  solo.history.push({
    day: state.day,
    source,
    action: "enter-solo-recovery"
  });
  cleanupHistory(solo);

  return solo;
}

// --------------------------------------------------------------------
// Wybory — dispatch po solo.beat. Max 3 wybory naraz, zawsze.
// --------------------------------------------------------------------

export function getSoloRecoveryChoices(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || !solo.active) {
    return [];
  }

  if (solo.beat === "resolution") {
    return RESOLUTION_CHOICES.map((choice) => ({ ...choice }));
  }

  if (solo.beat === "maintenance") {
    return MAINTENANCE_CHOICES.map((choice) => ({ ...choice }));
  }

  if (solo.beat === "high-stakes") {
    return HIGH_STAKES_CHOICES.map((choice) => ({ ...choice }));
  }

  const beatDefinition = BEATS[solo.beat];
  return beatDefinition ? beatDefinition.choices.map((choice) => ({ ...choice })) : [];
}

/**
 * Zwraca definicję AKTUALNEJ odsłony (tytuł sceny + narracja
 * otwierająca) — używane przez gameScreen.js do budowy sceny/narracji,
 * żeby każda odsłona wyglądała inaczej, nie tylko miała inne karty.
 */
export function getCurrentSoloSceneInfo(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return { sceneTitle: "Rekonstrukcja", narrative: "Coś się zmienia." };
  }

  if (solo.beat === "resolution") {
    return { sceneTitle: "Rozstrzygnięcie", narrative: "Cztery odsłony się skończyły. Coś musi ruszyć dalej." };
  }

  if (solo.beat === "maintenance") {
    return { sceneTitle: "Jeszcze trochę", narrative: "Nic nie musi się dziś rozstrzygnąć." };
  }

  if (solo.beat === "high-stakes") {
    return { sceneTitle: "To, czego unikałeś/aś", narrative: "Coś z przeszłości domaga się w końcu odpowiedzi." };
  }

  const beatDefinition = BEATS[solo.beat];
  return beatDefinition
    ? { sceneTitle: beatDefinition.sceneTitle, narrative: beatDefinition.narrative }
    : { sceneTitle: "Rekonstrukcja", narrative: "Coś się zmienia." };
}

export function applySoloRecoveryChoice(state, choiceId) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || !solo.active) {
    return { applied: false, reason: "Solo recovery is not active." };
  }

  if (solo.beat === "resolution") {
    return applyResolutionChoice(state, solo, choiceId);
  }

  if (solo.beat === "maintenance") {
    return applySimpleChoice(state, solo, choiceId, MAINTENANCE_CHOICES, "maintenance");
  }

  if (solo.beat === "high-stakes") {
    const result = applySimpleChoice(state, solo, choiceId, HIGH_STAKES_CHOICES, "high-stakes");
    if (result.applied) {
      // Po jednorazowym wydarzeniu wysokiej stawki rozstrzygnięcie
      // wraca — z już obniżonym Echo. Nigdy nie zostaje "high-stakes"
      // jako nowa pętla.
      solo.beat = "resolution";
    }
    return result;
  }

  const beatDefinition = BEATS[solo.beat];
  if (!beatDefinition) {
    return { applied: false, reason: "Unknown solo recovery beat." };
  }

  const choice = beatDefinition.choices.find((item) => item.id === choiceId);
  if (!choice) {
    return { applied: false, reason: "Unknown solo recovery choice." };
  }

  applyStatChanges(state, solo, choice);
  applyPatternTags(state, solo, choice, "beat");

  solo.daysInSolitude = Math.max(0, state.day - solo.startedDay);
  solo.lastChoiceDay = state.day;

  // Przejście do kolejnej odsłony w BEAT_ORDER. Po "readiness"
  // (ostatnia w kolejności) przechodzimy na "resolution" — NIGDY z
  // powrotem na "echo".
  const currentIndex = BEAT_ORDER.indexOf(solo.beat);
  const nextBeat = BEAT_ORDER[currentIndex + 1] || "resolution";
  solo.beat = nextBeat;

  const result = {
    applied: true,
    choiceId: choice.id,
    title: choice.title,
    result: choice.result,
    selfKnowledge: solo.selfKnowledge,
    socialExhaustion: solo.socialExhaustion,
    boundaryIntegrity: solo.boundaryIntegrity,
    echo: solo.echo
  };

  recordHistory(solo, state, choice, "beat", result);

  return result;
}

function applyResolutionChoice(state, solo, choiceId) {
  const choice = RESOLUTION_CHOICES.find((item) => item.id === choiceId);
  if (!choice) {
    return { applied: false, reason: "Unknown resolution choice." };
  }

  let startsDatingArc = false;

  if (choice.path === "signal") {
    solo.readyForNewRelationship = true;
    startsDatingArc = true;
    solo.beat = "resolution";
  } else if (choice.path === "maintenance") {
    solo.beat = "maintenance";
    solo.stayUntilDay = state.day + MAINTENANCE_SPAN_DAYS;
  } else if (choice.path === "high-stakes") {
    solo.beat = "high-stakes";
  }

  solo.lastChoiceDay = state.day;

  const result = {
    applied: true,
    choiceId: choice.id,
    title: choice.title,
    result: choice.text,
    startsDatingArc,
    selfKnowledge: solo.selfKnowledge,
    socialExhaustion: solo.socialExhaustion,
    boundaryIntegrity: solo.boundaryIntegrity,
    echo: solo.echo
  };

  recordHistory(solo, state, choice, "resolution", result);

  return result;
}

function applySimpleChoice(state, solo, choiceId, pool, source) {
  const choice = pool.find((item) => item.id === choiceId);
  if (!choice) {
    return { applied: false, reason: "Unknown choice." };
  }

  applyStatChanges(state, solo, choice);
  applyPatternTags(state, solo, choice, source);

  solo.daysInSolitude = Math.max(0, state.day - solo.startedDay);
  solo.lastChoiceDay = state.day;

  const result = {
    applied: true,
    choiceId: choice.id,
    title: choice.title,
    result: choice.result,
    selfKnowledge: solo.selfKnowledge,
    socialExhaustion: solo.socialExhaustion,
    boundaryIntegrity: solo.boundaryIntegrity,
    echo: solo.echo
  };

  recordHistory(solo, state, choice, source, result);

  return result;
}

function applyStatChanges(state, solo, choice) {
  applySpoonsCost(state, choice.spoonsCost);

  solo.selfKnowledge = clamp(solo.selfKnowledge + (choice.selfKnowledgeChange || 0), 0, 12);
  solo.socialExhaustion = clamp(solo.socialExhaustion + (choice.socialExhaustionChange || 0), 0, 12);
  solo.boundaryIntegrity = clamp(solo.boundaryIntegrity + (choice.boundaryIntegrityChange || 0), 0, 100);
  solo.echo = clamp(solo.echo + (choice.echoChange || 0), 0, 12);

  if (choice.lesson && !solo.lessons.includes(choice.lesson)) {
    solo.lessons.push(choice.lesson);
  }
}

function applySpoonsCost(state, cost) {
  const spoons = getSpoons(state);
  if (!spoons || !cost) {
    return;
  }

  spoons.current = clamp(spoons.current - Number(cost || 0), 0, spoons.max || 10);
}

// v0.45: integracja z patternSystem.js WYŁĄCZNIE przez już istniejące,
// eksportowane recordPatternEntry()/evaluatePatterns() — patternSystem.js
// samo w sobie NIE jest tu w ogóle dotykane. Klucz historii jest unikalny
// per dzień+odsłona+wybór, więc odświeżenie ekranu tego samego dnia nie
// dubluje wpisu (recordPatternEntry sam to sprawdza).
function applyPatternTags(state, solo, choice, source) {
  if (!Array.isArray(choice.patternTags) || choice.patternTags.length === 0) {
    return;
  }

  const recorded = recordPatternEntry(state, {
    key: `solo-recovery:${state.day}:${source}:${choice.id}`,
    day: state.day,
    source: "solo-recovery",
    tags: choice.patternTags
  });

  if (recorded) {
    evaluatePatterns(state);
  }
}

function recordHistory(solo, state, choice, source, result) {
  solo.lastResult = result;
  solo.history.push({
    day: state.day,
    source,
    choiceId: choice.id,
    beatAfter: solo.beat
  });
  cleanupHistory(solo);
}

/**
 * Przesuwa dzień gry. Jeśli aktualna odsłona to "maintenance" i dzień
 * po przesunięciu osiągnął/przekroczył stayUntilDay, WYMUSZA powrót do
 * "resolution" — to jest twarda granica przeciw bezterminowemu
 * klikaniu: maintenance trwa maksymalnie MAINTENANCE_SPAN_DAYS dni,
 * potem rozstrzygnięcie wraca, czy gracz tego chce, czy nie.
 */
export function advanceSoloRecoveryDay(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || !solo.active) {
    return null;
  }

  state.day += 1;
  state.phase = "morning";
  solo.daysInSolitude = Math.max(0, state.day - solo.startedDay);

  if (solo.beat === "maintenance" && typeof solo.stayUntilDay === "number" && state.day >= solo.stayUntilDay) {
    solo.beat = "resolution";
    solo.stayUntilDay = null;
  }

  const spoons = getSpoons(state);
  if (spoons) {
    const recovery = solo.socialExhaustion <= 3 ? 1 : 0;
    spoons.current = clamp(spoons.current + recovery, 0, spoons.max || 10);
  }

  solo.history.push({
    day: state.day,
    source: "solo-day-advance",
    daysInSolitude: solo.daysInSolitude,
    beat: solo.beat
  });
  cleanupHistory(solo);

  return solo;
}

/**
 * Zaczyna dating arc z poziomu rozstrzygnięcia solo. Wołane z
 * gameScreen.js PO result boxie ścieżki "resolution_open_to_signal"
 * (dopiero po "Dalej", nie natychmiast po kliknięciu karty — zgodnie
 * z obowiązkowym result boxem).
 */
export function resolveSoloToDatingArc(state, startDatingArcFn) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || typeof startDatingArcFn !== "function") {
    return null;
  }

  return startDatingArcFn(state, "solo-recovery");
}

export function buildSoloMorningLine(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo || !solo.active) {
    return null;
  }

  const lines = {
    echo: "Rekonstrukcja: dziś nie szukasz następcy. Sprawdzasz, co w Tobie zostało.",
    boundaries: "Rekonstrukcja: dziś sprawdzasz, gdzie kończy się Twoja granica, a zaczyna nawyk.",
    "social-contact": "Rekonstrukcja: świat na zewnątrz dalej istnieje. Pytanie, czy masz dziś siłę go sprawdzić.",
    readiness: "Rekonstrukcja: zostało jedno pytanie, na które nikt inny nie odpowie za Ciebie.",
    resolution: "Rekonstrukcja: cztery odsłony za Tobą. Coś musi ruszyć dalej.",
    maintenance: "Rekonstrukcja: dajesz sobie jeszcze trochę czasu, zanim cokolwiek zostanie nazwane.",
    "high-stakes": "Rekonstrukcja: jest coś, czego nie da się dziś dłużej odkładać."
  };

  return lines[solo.beat] || "Rekonstrukcja: coś się zmienia.";
}

export function getSoloRecoveryDebugSummary(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  return {
    isSingle: state.player ? state.player.isSingle === true : false,
    active: solo.active,
    beat: solo.beat,
    stayUntilDay: solo.stayUntilDay,
    startedDay: solo.startedDay,
    daysInSolitude: solo.daysInSolitude,
    selfKnowledge: solo.selfKnowledge,
    socialExhaustion: solo.socialExhaustion,
    boundaryIntegrity: solo.boundaryIntegrity,
    echo: solo.echo,
    readyForNewRelationship: solo.readyForNewRelationship,
    lessons: solo.lessons,
    lastResult: solo.lastResult,
    recentHistory: solo.history.slice(-10),
    relationshipHistoryCount: Array.isArray(state.relationshipHistory) ? state.relationshipHistory.length : 0
  };
}

/**
 * v0.45: devTools helper — NAZWA zachowana dla zgodności wstecznej
 * (window.oosDev.setSelfKnowledgeHigh() musi dalej działać), ale
 * zachowanie dopasowane do nowej, sekwencyjnej struktury: zamiast
 * tylko podnosić liczby, przeskakuje od razu do odsłony
 * "resolution" — najszybsza droga do przetestowania ścieżek
 * rozstrzygnięcia bez ręcznego klikania 4 odsłon.
 */
export function setSelfKnowledgeHigh(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  solo.active = true;
  state.player.isSingle = true;
  solo.startedDay = solo.startedDay || Math.max(1, state.day - 3);
  solo.daysInSolitude = Math.max(3, state.day - solo.startedDay);
  solo.selfKnowledge = 8;
  solo.boundaryIntegrity = Math.max(solo.boundaryIntegrity, 70);
  solo.beat = "resolution";
  solo.stayUntilDay = null;
  solo.readyForNewRelationship = true;
  solo.history.push({
    day: state.day,
    source: "devtools-self-knowledge-high",
    beat: solo.beat
  });
  cleanupHistory(solo);

  return solo;
}

export function clearSoloRecovery(state) {
  const solo = ensureSoloRecoveryState(state);
  if (!solo) {
    return null;
  }

  solo.active = false;
  solo.beat = "echo";
  solo.stayUntilDay = null;
  solo.readyForNewRelationship = false;
  state.player.isSingle = false;

  solo.history.push({
    day: state.day,
    source: "devtools-clear"
  });
  cleanupHistory(solo);

  return solo;
}

function snapshotPartner(state) {
  if (!state || !state.partner) {
    return null;
  }

  return cloneSafe({
    id: state.partner.id,
    name: state.partner.name,
    roleLabel: state.partner.roleLabel,
    relationshipLabel: state.partner.relationshipLabel,
    status: state.partner.status || "ended"
  });
}

function snapshotRelationshipEnd(state) {
  if (!state || !state.relationshipEnd) {
    return null;
  }

  return cloneSafe({
    type: state.relationshipEnd.type,
    title: state.relationshipEnd.title,
    reason: state.relationshipEnd.reason,
    day: state.relationshipEnd.day
  });
}

function getSpoons(state) {
  return state && state.resources && state.resources.spoons ? state.resources.spoons : null;
}

function cloneSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanupHistory(solo) {
  if (solo.history.length > MAX_HISTORY) {
    solo.history = solo.history.slice(solo.history.length - MAX_HISTORY);
  }
}
