// weeklySummaryScreen.js
//
// v0.11: weekly summary screen.
// The day has already advanced in eveningScreen.js before this screen appears.
// This screen does not call advanceToNextDay().
//
// v0.19: dodana ocena/generacja Weekly Stakes (idempotentna).
// v0.20: dodana ocena/generacja Critical Event / Wielki Test (idempotentna,
// niezależna od Weekly Stakes).
// v0.21: izolowany namespace ".oos-weekly-summary" (css/weekly-summary-v0-21.css).
//
// v0.47: Weekly Summary Game Feel Pass.
// MECHANIKA TYGODNIA JEST CAŁKOWICIE NIETKNIĘTA: dalej oceniamy i
// generujemy Weekly Stakes oraz Wielki Test w tej samej kolejności i w
// ten sam idempotentny sposób co w v0.19/v0.20/v0.30, zanim zbudujemy
// podsumowanie. Zmienia się WYŁĄCZNIE prezentacja:
//   1. HERO — "Tydzień X domknięty" + linia narracyjna zależna od wyniku.
//   2. Trzy główne karty: Największy sukces / Największy koszt / Styl
//      przetrwania (dominujący wzorzec).
//   3. Sekcja osiągnięć — odblokowania z ostatniego tygodnia jako
//      nagroda/badge, a nie lista debugowa.
//   4. Sekcja konsekwencji — co ten tydzień realnie zmienia na kolejny.
//   5. Teaser kolejnego tygodnia — Wielki Test / praca / napięcie / wzorzec.
//   6. Szczegóły tygodnia — cała dotychczasowa zawartość (chipsy, statystyki,
//      notatki, pełne bloki Stawki i Wielkiego Testu) przeniesiona do
//      zwijanego bloku <details>. NIC nie zostało usunięte.
//   7. CTA — "Wejdź w kolejny tydzień".
//
// Nowe style: css/weekly-summary-v0-47.css (dodatkowa warstwa w tym samym
// namespace .oos-weekly-summary; stary plik v0-21 zostaje bez zmian).
//
// Ten ekran CELOWO nie używa .oos-game ani oosLayout.js — to inny,
// osobny namespace (".oos-weekly-summary"), bo to nie jest część planszy
// gameplayowej (grid .oos-game zostaje całkowicie nietknięty).

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { saveGame } from "../../state/saveManager.js";
import { buildWeeklySummary } from "../../systems/weeklySummarySystem.js";
import {
  ensureWeeklyChallengeState,
  evaluateWeeklyChallenge,
  generateNextWeekChallenge,
  buildWeeklyChallengeSummary
} from "../../systems/weeklyChallengeSystem.js?v=300";
import {
  ensureCriticalEventState,
  evaluateCriticalEvent,
  generateNextCriticalEvent,
  buildCriticalEventSummary
} from "../../systems/criticalEventSystem.js?v=305";
import {
  ensurePatternState,
  recordPatternFromWeeklyResult,
  recordPatternFromCriticalResult,
  getWeeklyPatternEchoes
} from "../../systems/patternSystem.js?v=300";
import { buildWeeklyPartnerCapacityNote } from "../../systems/partnerCapacitySystem.js";
import { buildWeeklyRelationshipScarsNote } from "../../systems/relationshipScarsSystem.js";
import { buildWeeklyRelationshipRepairNote } from "../../systems/relationshipRepairSystem.js";
import { buildWeeklyStaticNote } from "../../systems/staticSystem.js?v=270";

import { buildWeeklyMetamourNote } from "../../systems/metamourSystem.js?v=300";
import { buildWeeklyWorkNote, getWorkPressureContext } from "../../systems/workPressureSystem.js?v=300";
import { evaluateMonthlyLoopAfterWeeklySummary, hasPendingMonthSummary } from "../../systems/monthlyLoopSystem.js?v=305";
// v0.47: tylko odczyt stanu osiągnięć (ensure jest bezpieczne i idempotentne,
// patrz achievementSystem.js). Ten ekran NICZEGO nie odblokowuje.
import { ensureAchievementState } from "../../systems/achievementSystem.js?v=400";
// v0.52: Weekly Stakes Tracking — ślad tygodnia w karcie Stawki
// (czysty odczyt; celowo BEZ ensure, żeby pokazać ślad WŁAŚNIE
// ocenionego tygodnia zanim nowy tydzień go zresetuje).
import { buildWeeklyTraceSummary } from "../../systems/weeklyStakesTrackingSystem.js?v=520";
// v0.55: Narrative Consequence Memory — maly blok "Co wracalo w
// tle", renderowany WYLACZNIE istniejacymi klasami sekcji
// konsekwencji (zero nowego CSS).
import { buildWeeklyMemorySummary } from "../../systems/narrativeMemorySystem.js?v=560";
// v0.56: Relationship Model Consequence Pass — maksymalnie jedno
// zdanie o tym, jak dzialaly ustalenia relacji w tym tygodniu.
import { buildRelationshipModelWeeklyLine } from "../../systems/relationshipModelConsequenceSystem.js?v=560";

export function renderWeeklySummaryScreen(container) {
  const state = getState();

  // v0.19: oceń poprzednie wyzwanie (jeśli jego termin minął) i od razu
  // wygeneruj kolejne na nadchodzący tydzień, ZANIM zbudujemy podsumowanie
  // — dzięki temu sekcje niżej pokazują spoons już po ewentualnej
  // nagrodzie/karze. Obie funkcje są idempotentne (patrz
  // weeklyChallengeSystem.js), więc bezpieczne nawet przy wielokrotnym
  // renderze tego ekranu. NIE ZMIENIONE w v0.47.
  ensureWeeklyChallengeState(state);
  const weeklyEvaluation = evaluateWeeklyChallenge(state);
  generateNextWeekChallenge(state);

  // v0.20: Monthly Critical Event Foundation. Ta sama idempotentna
  // logika co Weekly Stakes powyżej, ale z 28-dniowym cyklem i innymi
  // efektami (trust/frustration/current spoons, BEZ max spoons — patrz
  // criticalEventSystem.js). To DRUGI, niezależny system. NIE ZMIENIONE
  // w v0.47.
  ensureCriticalEventState(state);
  const criticalEvaluation = evaluateCriticalEvent(state);
  generateNextCriticalEvent(state);

  // v0.30: domknięcie pierwszego miesięcznego cyklu. NIE ZMIENIONE w v0.47.
  evaluateMonthlyLoopAfterWeeklySummary(state);

  // v0.22: Pattern Foundation / Narrative Echoes. evaluateWeeklyChallenge/
  // evaluateCriticalEvent zwracają wynik TYLKO na tym renderze, na którym
  // ocena faktycznie się wykonała — recordPatternFromWeeklyResult/
  // recordPatternFromCriticalResult są DODATKOWO idempotentne przez key
  // (patrz patternSystem.js). NIE ZMIENIONE w v0.47.
  ensurePatternState(state);
  if (weeklyEvaluation) {
    recordPatternFromWeeklyResult(state, weeklyEvaluation);
  }
  if (criticalEvaluation) {
    recordPatternFromCriticalResult(state, criticalEvaluation);
  }

  const summary = buildWeeklySummary(state);
  const challengeSummary = buildWeeklyChallengeSummary(state);
  const criticalSummary = buildCriticalEventSummary(state);
  const dominantPatterns = getWeeklyPatternEchoes(state, 3);

  const root = document.createElement("section");
  root.className = "oos-weekly-summary oos-weekly-summary--v47 screen";

  // 1. HERO — mocny komunikat tygodnia.
  root.appendChild(buildHero(summary, challengeSummary, criticalSummary));

  const main = document.createElement("main");
  main.className = "oos-weekly-summary__flow";

  // 2. Trzy główne karty: sukces / koszt / styl.
  const mainCards = document.createElement("div");
  mainCards.className = "oos-weekly-summary__main-cards";
  mainCards.appendChild(buildSuccessCard(summary, state, challengeSummary, criticalSummary, dominantPatterns));
  mainCards.appendChild(buildCostCard(summary, state, challengeSummary, criticalSummary));
  mainCards.appendChild(buildStyleCard(dominantPatterns));
  // (v0.52: ślad tygodnia jest pokazywany niżej, w karcie "Stawka
  // tygodnia" w sekcji szczegółów — jedna dopisana notka, zero
  // przebudowy struktury v0.47.)
  main.appendChild(mainCards);

  // 3. Osiągnięcia jako nagroda / milestone.
  main.appendChild(buildAchievementsSection(state, summary));

  // 4. Konsekwencje — co ten tydzień zmienia na kolejny.
  main.appendChild(buildConsequencesSection(state, challengeSummary, criticalSummary, dominantPatterns));

  // v0.55: sekcja opcjonalna — renderuje sie TYLKO gdy jest co
  // pokazac (buildWeeklyMemorySummary zwraca null, jesli tydzien nie
  // zostawil zadnego sladu wartego wzmianki).
  const memorySection = buildNarrativeMemorySection(state);
  if (memorySection) {
    main.appendChild(memorySection);
  }

  // v0.56: sekcja opcjonalna — jak wyzej, renderuje sie TYLKO gdy
  // jest co powiedziec (buildRelationshipModelWeeklyLine moze zwrocic null).
  const relationshipModelSection = buildRelationshipModelSection(state);
  if (relationshipModelSection) {
    main.appendChild(relationshipModelSection);
  }

  // 5. Teaser kolejnego tygodnia.
  main.appendChild(buildNextWeekTeaser(state, criticalSummary, dominantPatterns, summary));

  // 6. Szczegóły tygodnia — cała dotychczasowa zawartość, zwinięta.
  main.appendChild(buildDetailsSection(summary, state, challengeSummary, criticalSummary, dominantPatterns));

  root.appendChild(main);

  // 7. CTA.
  root.appendChild(buildFooter(state));

  container.appendChild(root);
}

// --------------------------------------------------------------------
// 1. HERO
// --------------------------------------------------------------------

function buildHero(summary, challengeSummary, criticalSummary) {
  const hero = document.createElement("header");
  hero.className = "oos-weekly-summary__hero";

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-weekly-summary__eyebrow";
  eyebrow.textContent = "Koniec tygodnia";
  hero.appendChild(eyebrow);

  const title = document.createElement("h1");
  title.className = "oos-weekly-summary__hero-title";
  title.textContent = `Tydzień ${summary.weekNumber} domknięty`;
  hero.appendChild(title);

  const line = document.createElement("p");
  line.className = "oos-weekly-summary__hero-line";
  line.textContent = buildHeroLine(summary, challengeSummary, criticalSummary);
  hero.appendChild(line);

  const period = document.createElement("p");
  period.className = "oos-weekly-summary__period";
  period.textContent = `Dni ${summary.startDay}–${summary.endDay}`;
  hero.appendChild(period);

  return hero;
}

// Linia narracyjna zależna od wyniku tygodnia. Czyta TE SAME dane, które
// ekran i tak już ma — zero nowej mechaniki.
function buildHeroLine(summary, challengeSummary, criticalSummary) {
  const criticalFailed = criticalSummary.lastResult && !criticalSummary.lastResult.success;
  const criticalPassed = criticalSummary.lastResult && criticalSummary.lastResult.success;
  const stakeFailed = challengeSummary.lastResult && !challengeSummary.lastResult.success;
  const stakePassed = challengeSummary.lastResult && challengeSummary.lastResult.success;

  if (criticalFailed) {
    return "Wielki Test przyszedł i nie poszło po twojemu. Ale historia się nie skończyła — po prostu waży więcej.";
  }

  if (criticalPassed) {
    return "Przetrwałeś/aś tydzień, który miał prawo cię złamać. Nie złamał.";
  }

  if (stakeFailed && summary.spoonsChange <= -8) {
    return "Ten tydzień wygrał kilka rund. Ty wciąż jesteś w grze.";
  }

  if (summary.trustChange >= 8) {
    return "Przetrwałeś/aś kolejny tydzień — i coś w relacji zrobiło się odrobinę bezpieczniejsze.";
  }

  if (summary.spoonsChange <= -12) {
    return "Przetrwałeś/aś kolejny tydzień. Kosztował więcej, niż było widać z zewnątrz.";
  }

  if (stakePassed) {
    return "Tydzień miał stawkę — i tym razem to ty ją zgarniasz.";
  }

  return "Przetrwałeś/aś kolejny tydzień. Siedem dni weszło, siedem dni wyszło. To się liczy.";
}

// --------------------------------------------------------------------
// 2a. Karta — Największy sukces tygodnia
// --------------------------------------------------------------------

function buildSuccessCard(summary, state, challengeSummary, criticalSummary, dominantPatterns) {
  const success = pickWeekSuccess(summary, state, challengeSummary, criticalSummary, dominantPatterns);
  return buildMainCard({
    modifier: "success",
    eyebrowText: "Największy sukces",
    titleText: success.title,
    bodyText: success.text
  });
}

// Sukces to nie tylko wygrana — patrz brief v0.47: przetrwanie, szczera
// rozmowa, ochrona granicy, odpoczynek, naprawa małej rzeczy. Heurystyka
// czyta wyłącznie istniejące dane.
function pickWeekSuccess(summary, state, challengeSummary, criticalSummary, dominantPatterns) {
  if (criticalSummary.lastResult && criticalSummary.lastResult.success) {
    return {
      title: "Wielki Test zaliczony",
      text: `„${criticalSummary.lastResult.title}” — relacja przeszła przez próbę, która mogła ją mocno nadwyrężyć.`
    };
  }

  if (challengeSummary.lastResult && challengeSummary.lastResult.success) {
    return {
      title: "Stawka tygodnia wytrzymała",
      text: `„${challengeSummary.lastResult.title}” — utrzymanie tego przez cały tydzień nie było darmowe. A jednak się udało.`
    };
  }

  const repairNote = buildWeeklyRelationshipRepairNote(state);
  if (repairNote) {
    return {
      title: "Naprawiona mała rzecz",
      text: "W tym tygodniu coś zostało naprawione zamiast zamiecione pod dywan. Relacja to zapamiętała."
    };
  }

  if (summary.trustChange >= 5) {
    return {
      title: "Więcej bezpieczeństwa",
      text: "Kilka decyzji z tego tygodnia zbudowało w relacji więcej zaufania, niż było go na starcie."
    };
  }

  const hasPattern = (id) => dominantPatterns.some((pattern) => pattern.id === id);

  if (hasPattern("transparency")) {
    return {
      title: "Powiedziane na głos",
      text: "Najtrudniejsze rzeczy tego tygodnia nie zostały przemilczane. To rzadszy sukces, niż się wydaje."
    };
  }

  if (hasPattern("rest")) {
    return {
      title: "Odpoczynek jako decyzja",
      text: "W tym tygodniu odpoczynek nie był porażką ani nagrodą za wszystko. Był wyborem."
    };
  }

  if (summary.spoonsChange >= 0) {
    return {
      title: "Ochrona zasobów",
      text: "Tydzień nie zjadł więcej, niż oddał. Granice, które to umożliwiły, były pracą — nawet jeśli cichą."
    };
  }

  return {
    title: "Przetrwanie",
    text: "Nic spektakularnego. Siedem dni, każdy z nich domknięty. Czasem to jest cały sukces — i wystarczy."
  };
}

// --------------------------------------------------------------------
// 2b. Karta — Największy koszt tygodnia
// --------------------------------------------------------------------

function buildCostCard(summary, state, challengeSummary, criticalSummary) {
  const cost = pickWeekCost(summary, state, challengeSummary, criticalSummary);
  return buildMainCard({
    modifier: "cost",
    eyebrowText: "Największy koszt",
    titleText: cost.title,
    bodyText: cost.text
  });
}

// Nazwanie kosztu tygodnia — narracyjnie użyteczne, nie idealnie
// precyzyjne (brief v0.47, punkt 5). Czyta wyłącznie istniejące dane.
function pickWeekCost(summary, state, challengeSummary, criticalSummary) {
  if (criticalSummary.lastResult && !criticalSummary.lastResult.success) {
    return {
      title: "Niezaliczony Wielki Test",
      text: `„${criticalSummary.lastResult.title}” — ten tydzień zostawia ślad, który będzie widać jeszcze przez jakiś czas.`
    };
  }

  if (challengeSummary.lastResult && !challengeSummary.lastResult.success) {
    return {
      title: "Przegrana stawka tygodnia",
      text: `„${challengeSummary.lastResult.title}” — nie wyszło. Kolejny tydzień zaczyna się z większym napięciem.`
    };
  }

  if (summary.spoonsChange <= -10) {
    return {
      title: "Zużyta pojemność",
      text: "Nie jedna wielka katastrofa — suma małych obciążeń, które przestały być małe. Zasoby są wyraźnie niżej."
    };
  }

  if (summary.frustrationChange >= 8) {
    return {
      title: "Narastające napięcie",
      text: "W relacji przybyło frustracji. Jeszcze nic nie pękło, ale coś zaczęło wymagać ostrożniejszego dotyku."
    };
  }

  const work = getWorkPressureContext(state);
  if (work && work.pressure >= 60) {
    return {
      title: "Praca na plecach",
      text: "Presja zawodowa nie została w biurze. Wchodziła wieczorami tam, gdzie miało być spokojnie."
    };
  }

  if (summary.hasFatigueData && summary.fatigueChange > 0) {
    return {
      title: "Przeciążenie",
      text: "Ciało prowadziło własną księgowość tego tygodnia. Bilans wyszedł na minus."
    };
  }

  if (summary.spoonsChange < 0) {
    return {
      title: "Zwykłe zużycie",
      text: "Nic wielkiego nie pękło. Ale tydzień i tak wziął swoją opłatę — po cichu, dzień po dniu."
    };
  }

  return {
    title: "Koszt odroczony",
    text: "Ten tydzień wyglądał na tani. Doświadczenie podpowiada, że rachunki lubią przychodzić później."
  };
}

// --------------------------------------------------------------------
// 2c. Karta — Styl przetrwania / dominujący wzorzec
// --------------------------------------------------------------------

// Miękkie, growe nazwanie stylu — NIE diagnoza (brief v0.47, punkt 4).
const PATTERN_STYLE_LINES = {
  avoidance: "Ten tydzień najczęściej ratowałeś/aś przez: unikanie.",
  "people-pleasing": "Ten tydzień najczęściej ratowałeś/aś przez: dbanie o komfort innych.",
  overextension: "Najczęściej wracał wzorzec: jeszcze jedna rzecz.",
  repair: "Ten tydzień najczęściej ratowałeś/aś przez: naprawianie.",
  rest: "Ten tydzień najczęściej ratowałeś/aś przez: odpoczynek.",
  transparency: "Ten tydzień najczęściej ratowałeś/aś przez: mówienie wprost."
};

function buildStyleCard(dominantPatterns) {
  const dominant = dominantPatterns.length > 0 ? dominantPatterns[0] : null;

  if (!dominant) {
    return buildMainCard({
      modifier: "style",
      eyebrowText: "Styl przetrwania",
      titleText: "Bez jednego stylu",
      bodyText: "Ten tydzień nie miał jednego wyraźnego wzorca. Może to dobrze — nic nie musiało cię ratować na okrągło."
    });
  }

  const styleLine = PATTERN_STYLE_LINES[dominant.id]
    || `Ten tydzień najczęściej ratowałeś/aś przez: ${dominant.title.toLowerCase()}.`;

  return buildMainCard({
    modifier: "style",
    eyebrowText: "Styl przetrwania",
    titleText: dominant.title,
    bodyText: `${styleLine} ${dominant.description}`
  });
}

// Wspólny budulec trzech głównych kart.
function buildMainCard({ modifier, eyebrowText, titleText, bodyText }) {
  const card = document.createElement("section");
  card.className = `oos-weekly-summary__main-card oos-weekly-summary__main-card--${modifier}`;

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-weekly-summary__main-card-eyebrow";
  eyebrow.textContent = eyebrowText;
  card.appendChild(eyebrow);

  const title = document.createElement("p");
  title.className = "oos-weekly-summary__main-card-title";
  title.textContent = titleText;
  card.appendChild(title);

  const body = document.createElement("p");
  body.className = "oos-weekly-summary__main-card-body";
  body.textContent = bodyText;
  card.appendChild(body);

  return card;
}

// --------------------------------------------------------------------
// 3. Osiągnięcia jako nagroda
// --------------------------------------------------------------------

function buildAchievementsSection(state, summary) {
  const section = document.createElement("section");
  section.className = "oos-weekly-summary__section oos-weekly-summary__section--achievements";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__section-heading";
  heading.textContent = "Kamienie milowe";
  section.appendChild(heading);

  const achievementState = ensureAchievementState(state);
  const unlockedAll = achievementState && Array.isArray(achievementState.unlocked)
    ? achievementState.unlocked
    : [];

  // "Ostatni tydzień" = wpisy z dniem >= początku podsumowywanego
  // tygodnia (obejmuje też odblokowania z bieżącego poranka, bo dzień
  // zdążył się już przesunąć — patrz komentarz na górze pliku).
  const unlockedThisWeek = unlockedAll.filter((entry) => Number(entry.day) >= summary.startDay);

  if (unlockedThisWeek.length > 0) {
    const badges = document.createElement("div");
    badges.className = "oos-weekly-summary__badges";
    unlockedThisWeek.slice(-3).forEach((entry) => {
      badges.appendChild(buildAchievementBadge(entry, "Nowe"));
    });
    section.appendChild(badges);
    return section;
  }

  // Nic nowego w tym tygodniu → pokaż ostatnio odblokowane (jeśli jest)
  // jako cichszy milestone, plus subtelny sygnał progresu.
  const latest = unlockedAll.length > 0 ? unlockedAll[unlockedAll.length - 1] : null;

  if (latest) {
    const badges = document.createElement("div");
    badges.className = "oos-weekly-summary__badges";
    badges.appendChild(buildAchievementBadge(latest, "Ostatnio"));
    section.appendChild(badges);
  }

  const progress = document.createElement("p");
  progress.className = "oos-weekly-summary__achievements-progress";
  progress.textContent = latest
    ? "W tym tygodniu nic nowego nie kliknęło. Ale gra dalej notuje."
    : "Jeszcze nic nie kliknęło. Ale coś się zapisuje.";
  section.appendChild(progress);

  return section;
}

function buildAchievementBadge(entry, tagText) {
  const badge = document.createElement("div");
  badge.className = "oos-weekly-summary__badge";

  const tag = document.createElement("span");
  tag.className = "oos-weekly-summary__badge-tag";
  tag.textContent = tagText;
  badge.appendChild(tag);

  const title = document.createElement("p");
  title.className = "oos-weekly-summary__badge-title";
  title.textContent = entry.title;
  badge.appendChild(title);

  if (entry.text) {
    const text = document.createElement("p");
    text.className = "oos-weekly-summary__badge-text";
    text.textContent = entry.text;
    badge.appendChild(text);
  }

  return badge;
}

// --------------------------------------------------------------------
// 4. Konsekwencje — co ten tydzień zmienia na kolejny
// --------------------------------------------------------------------

/**
 * v0.55: Narrative Consequence Memory. Mala, cicha sekcja — sam
 * naglowek + lead + max 3 pozycje, w TEJ SAMEJ konwencji wizualnej co
 * buildConsequencesSection powyzej (te same klasy CSS, zero nowych
 * regul). Zwraca null, gdy nie ma nic aktywnego do pokazania — sekcja
 * wtedy w ogole sie nie pojawia (nie ma pustej ramki/dashboardu).
 */
function buildNarrativeMemorySection(state) {
  const summary = buildWeeklyMemorySummary(state);
  if (!summary) return null;

  const section = document.createElement("section");
  section.className = "oos-weekly-summary__section oos-weekly-summary__section--consequences";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__section-heading";
  heading.textContent = "Co wracało w tle";
  section.appendChild(heading);

  const lead = document.createElement("p");
  lead.className = "oos-weekly-summary__consequence-item";
  lead.textContent = summary.leadText;
  section.appendChild(lead);

  if (summary.items.length > 0) {
    const list = document.createElement("ul");
    list.className = "oos-weekly-summary__consequence-list";
    summary.items.forEach((text) => {
      const item = document.createElement("li");
      item.className = "oos-weekly-summary__consequence-item";
      item.textContent = text;
      list.appendChild(item);
    });
    section.appendChild(list);
  }

  return section;
}

/**
 * v0.56: Relationship Model Consequence Pass. Ta sama konwencja
 * wizualna co buildNarrativeMemorySection powyzej (zero nowego CSS) —
 * tylko naglowek + jedno zdanie, bez listy, bez tabeli, bez liczb.
 * Zwraca null, gdy nie ma nic wartego wzmianki.
 */
function buildRelationshipModelSection(state) {
  const line = buildRelationshipModelWeeklyLine(state);
  if (!line) return null;

  const section = document.createElement("section");
  section.className = "oos-weekly-summary__section oos-weekly-summary__section--consequences";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__section-heading";
  heading.textContent = "Ustalenia relacji";
  section.appendChild(heading);

  const body = document.createElement("p");
  body.className = "oos-weekly-summary__consequence-item";
  body.textContent = line;
  section.appendChild(body);

  return section;
}

function buildConsequencesSection(state, challengeSummary, criticalSummary, dominantPatterns) {
  const section = document.createElement("section");
  section.className = "oos-weekly-summary__section oos-weekly-summary__section--consequences";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__section-heading";
  heading.textContent = "Co ten tydzień zmienia";
  section.appendChild(heading);

  const items = [];

  if (challengeSummary.lastResult) {
    items.push(challengeSummary.lastResult.success
      ? "+1 do maksymalnych spoons — nowy tydzień zaczyna się z odrobinę większym zapasem."
      : "-2 spoons na starcie — początek nowego tygodnia będzie cięższy.");
  }

  if (criticalSummary.lastResult && criticalSummary.lastResult.effect) {
    items.push(`Wielki Test zostawił ślad: ${formatCriticalEventEffect(criticalSummary.lastResult.effect)}.`);
  }

  dominantPatterns.slice(0, 2).forEach((pattern) => {
    items.push(`Aktywny wzorzec: ${pattern.title} — gra będzie go zauważać w kolejnych dniach.`);
  });

  if (criticalSummary.upcoming) {
    items.push("Nadchodzący test podnosi stawkę najbliższych dni.");
  }

  if (items.length === 0) {
    items.push("Ten tydzień nie zostawia twardych modyfikatorów. Wszystko, co ważne, zostało w relacji i w tobie.");
  }

  const list = document.createElement("ul");
  list.className = "oos-weekly-summary__consequence-list";
  items.forEach((text) => {
    const item = document.createElement("li");
    item.className = "oos-weekly-summary__consequence-item";
    item.textContent = text;
    list.appendChild(item);
  });
  section.appendChild(list);

  return section;
}

// --------------------------------------------------------------------
// 5. Teaser kolejnego tygodnia
// --------------------------------------------------------------------

function buildNextWeekTeaser(state, criticalSummary, dominantPatterns, summary) {
  const section = document.createElement("section");
  section.className = "oos-weekly-summary__section oos-weekly-summary__teaser";

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-weekly-summary__teaser-eyebrow";
  eyebrow.textContent = "W przyszłym tygodniu cień rzuca…";
  section.appendChild(eyebrow);

  const teaser = pickTeaser(state, criticalSummary, dominantPatterns, summary);

  const title = document.createElement("p");
  title.className = "oos-weekly-summary__teaser-title";
  title.textContent = teaser.title;
  section.appendChild(title);

  if (teaser.line) {
    const line = document.createElement("p");
    line.className = "oos-weekly-summary__teaser-line";
    line.textContent = teaser.line;
    section.appendChild(line);
  }

  return section;
}

function pickTeaser(state, criticalSummary, dominantPatterns, summary) {
  // Priorytet 1: aktywny Wielki Test (brief v0.47, punkt 7).
  if (criticalSummary.upcoming) {
    const daysLeft = criticalSummary.upcomingDaysLeft;
    return {
      title: `Na horyzoncie: ${criticalSummary.upcoming.title}`,
      line: typeof daysLeft === "number" ? `Zostało około ${daysLeft} dni.` : ""
    };
  }

  // Priorytet 2: presja pracy.
  const work = getWorkPressureContext(state);
  if (work && work.pressure >= 55) {
    return {
      title: "Praca nie zamierza odpuścić",
      line: "Presja z tego tygodnia raczej nie zniknie przez weekend."
    };
  }

  // Priorytet 3: napięcie w relacji.
  if (typeof summary.currentFrustration === "number" && summary.currentFrustration >= 55) {
    return {
      title: "Napięcie w relacji szuka ujścia",
      line: "To, co niedopowiedziane, ma zwyczaj samo wybierać sobie moment."
    };
  }

  // Priorytet 4: dominujący wzorzec.
  if (dominantPatterns.length > 0) {
    return {
      title: `Wzorzec: ${dominantPatterns[0].title}`,
      line: "Raczej sam nie zniknie. Pytanie brzmi, kto będzie go prowadził."
    };
  }

  return {
    title: "Nowy tydzień przychodzi bez zapowiedzi",
    line: "To też jest informacja."
  };
}

// --------------------------------------------------------------------
// 6. Szczegóły tygodnia (zwinięte) — CAŁA dotychczasowa zawartość
// --------------------------------------------------------------------

function buildDetailsSection(summary, state, challengeSummary, criticalSummary, dominantPatterns) {
  const details = document.createElement("details");
  details.className = "oos-weekly-summary__details";

  const toggle = document.createElement("summary");
  toggle.className = "oos-weekly-summary__details-toggle";
  toggle.textContent = "Szczegóły tygodnia";
  details.appendChild(toggle);

  const grid = document.createElement("div");
  grid.className = "oos-weekly-summary__grid";
  grid.appendChild(buildStoryCard(summary, state, dominantPatterns));
  grid.appendChild(buildStateCard(summary, state));
  grid.appendChild(buildWeeklyStakeCard(challengeSummary, summary, state));
  grid.appendChild(buildCriticalEventCard(criticalSummary, state));
  details.appendChild(grid);

  return details;
}

// Dawna karta 1 — Wynik tygodnia (story). Przeniesiona 1:1 do sekcji
// szczegółów; jedyna zmiana to przyjęcie już pobranych wzorców zamiast
// ponownego wywołania getWeeklyPatternEchoes (ten sam wynik, bez
// podwójnego dotykania lastWeeklyPatternDay).
function buildStoryCard(summary, state, dominantPatterns) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--story";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Jak minął tydzień";
  card.appendChild(heading);

  const text = document.createElement("p");
  text.className = "oos-weekly-summary__story-text";
  text.textContent = summary.summaryText;
  card.appendChild(text);

  const chips = document.createElement("div");
  chips.className = "oos-weekly-summary__effect-chips";

  chips.appendChild(createEffectChip("🥄 Spoons", summary.spoonsChange));
  chips.appendChild(createEffectChip("🤝 Zaufanie", summary.trustChange));
  // Frustracja ma ODWRÓCONĄ semantykę koloru — wzrost jest złym efektem
  // (czerwony), spadek dobrym (zielony). Ta sama zasada co w
  // reflectionScreen.js (patrz oosLayout.js#createResultTile).
  chips.appendChild(createEffectChip("🌡️ Frustracja", summary.frustrationChange, "down"));

  if (summary.hasFatigueData && summary.fatigueChange !== 0) {
    chips.appendChild(createEffectChip("🌀 Przeciążenie", summary.fatigueChange, "down"));
  }

  card.appendChild(chips);

  // v0.22: blok "Co zaczyna być wzorem" (style: css/patterns-v0-22.css).
  if (dominantPatterns.length > 0) {
    card.appendChild(buildPatternsBlock(dominantPatterns));
  }

  // v0.28: Metamour. Krótka wzmianka, jeśli sieć relacji była w tym tygodniu obecna.
  const metamourNote = buildWeeklyMetamourNote(state);
  if (metamourNote) {
    const metamourNoteEl = document.createElement("p");
    metamourNoteEl.className = "oos-weekly-summary__mood-description";
    metamourNoteEl.textContent = metamourNote;
    card.appendChild(metamourNoteEl);
  }

  // v0.29: Work Pressure. Krótka wzmianka, jeśli praca wchodziła w tydzień.
  const workNote = buildWeeklyWorkNote(state);
  if (workNote) {
    const workNoteEl = document.createElement("p");
    workNoteEl.className = "oos-weekly-summary__mood-description";
    workNoteEl.textContent = workNote;
    card.appendChild(workNoteEl);
  }

  return card;
}

function buildPatternsBlock(patterns) {
  const wrapper = document.createElement("div");
  wrapper.className = "oos-weekly-summary__patterns";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__patterns-heading";
  heading.textContent = "Co zaczyna być wzorem";
  wrapper.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "oos-weekly-summary__pattern-list";

  patterns.forEach((pattern) => {
    const item = document.createElement("li");
    item.className = "oos-weekly-summary__pattern-item";

    const title = document.createElement("span");
    title.className = "oos-weekly-summary__pattern-title";
    title.textContent = pattern.title;
    item.appendChild(title);

    const description = document.createElement("span");
    description.className = "oos-weekly-summary__pattern-description";
    description.textContent = ` — ${pattern.description}`;
    item.appendChild(description);

    list.appendChild(item);
  });

  wrapper.appendChild(list);
  return wrapper;
}

function createEffectChip(label, value, desirableDirection) {
  const direction = resolveChipDirection(value, desirableDirection);

  const chip = document.createElement("span");
  chip.className = `oos-weekly-summary__effect-chip oos-weekly-summary__effect-chip--${direction}`;

  const labelEl = document.createElement("span");
  labelEl.className = "oos-weekly-summary__effect-chip-label";
  labelEl.textContent = label;
  chip.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "oos-weekly-summary__effect-chip-value";
  valueEl.textContent = formatSigned(value);
  chip.appendChild(valueEl);

  return chip;
}

function resolveChipDirection(value, desirableDirection) {
  if (!value) {
    return "neutral";
  }

  const isIncrease = value > 0;

  if (desirableDirection === "down") {
    return isIncrease ? "negative" : "positive";
  }

  return isIncrease ? "positive" : "negative";
}

// Dawna karta 2 — Aktualny stan. Przeniesiona 1:1 do sekcji szczegółów.
function buildStateCard(summary, state) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--state";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Aktualny stan";
  card.appendChild(heading);

  const list = document.createElement("div");
  list.className = "oos-weekly-summary__stat-lines";

  list.appendChild(createStatLine("Spoons", `${summary.currentSpoons}/${summary.maxSpoons}`));

  if (summary.currentTrust !== null) {
    list.appendChild(createStatLine("Zaufanie", `${summary.currentTrust}/100`));
  }

  if (summary.currentFrustration !== null) {
    list.appendChild(createStatLine("Frustracja", `${summary.currentFrustration}/100`));
  }

  if (summary.relationshipMoodLabel) {
    list.appendChild(createStatLine("Stan relacji", summary.relationshipMoodLabel));
  }

  card.appendChild(list);

  if (summary.relationshipMoodDescription) {
    const description = document.createElement("p");
    description.className = "oos-weekly-summary__mood-description";
    description.textContent = summary.relationshipMoodDescription;
    card.appendChild(description);
  }

  // v0.23: Partner Capacity Foundation.
  const partnerNote = buildWeeklyPartnerCapacityNote(state);
  if (partnerNote) {
    const partnerNoteEl = document.createElement("p");
    partnerNoteEl.className = "oos-weekly-summary__mood-description";
    partnerNoteEl.textContent = partnerNote;
    card.appendChild(partnerNoteEl);
  }

  // v0.25: Relationship Scars.
  const scarsNote = buildWeeklyRelationshipScarsNote(state);
  if (scarsNote) {
    const scarsNoteEl = document.createElement("p");
    scarsNoteEl.className = "oos-weekly-summary__mood-description";
    scarsNoteEl.textContent = scarsNote;
    card.appendChild(scarsNoteEl);
  }

  // v0.26: Repair Events.
  const repairNote = buildWeeklyRelationshipRepairNote(state);
  if (repairNote) {
    const repairNoteEl = document.createElement("p");
    repairNoteEl.className = "oos-weekly-summary__mood-description";
    repairNoteEl.textContent = repairNote;
    card.appendChild(repairNoteEl);
  }

  // v0.27: The Static.
  const staticNote = buildWeeklyStaticNote(state);
  if (staticNote) {
    const staticNoteEl = document.createElement("p");
    staticNoteEl.className = "oos-weekly-summary__mood-description";
    staticNoteEl.textContent = staticNote;
    card.appendChild(staticNoteEl);
  }

  return card;
}

function createStatLine(label, value) {
  const line = document.createElement("div");
  line.className = "oos-weekly-summary__stat-line";

  const labelEl = document.createElement("span");
  labelEl.className = "oos-weekly-summary__stat-line-label";
  labelEl.textContent = label;
  line.appendChild(labelEl);

  const valueEl = document.createElement("span");
  valueEl.className = "oos-weekly-summary__stat-line-value";
  valueEl.textContent = value;
  line.appendChild(valueEl);

  return line;
}

// Dawna karta 3 — Stawka tygodnia. Przeniesiona 1:1 do sekcji szczegółów.
function buildWeeklyStakeCard(challengeSummary, summary, state) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--weekly-stake";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Stawka tygodnia";
  card.appendChild(heading);

  // v0.52: Ślad tygodnia — ton + max 3 najważniejsze ślady jako małe
  // notatki (NIGDY pełna tabela 7 dni). Brak śladów (stary zapis,
  // pierwszy tydzień) => blok po prostu się nie renderuje.
  const trace = buildWeeklyTraceSummary(state, summary.startDay, summary.endDay);
  if (trace) {
    card.appendChild(buildWeeklyTraceBlock(trace));
  }

  if (challengeSummary.lastResult) {
    card.appendChild(buildResultBlock({
      titleText: challengeSummary.lastResult.success
        ? `Udało się: ${challengeSummary.lastResult.title}`
        : `Nie udało się: ${challengeSummary.lastResult.title}`,
      detailText: challengeSummary.lastResult.success
        ? "Relacja wytrzymała próbę."
        : "Wchodzisz w kolejny tydzień z większym napięciem.",
      effectText: challengeSummary.lastResult.success
        ? "Nagroda: +1 do maksymalnych spoons."
        : "Kara: -2 spoons na start tygodnia.",
      success: challengeSummary.lastResult.success
    }));
  }

  if (challengeSummary.upcoming) {
    card.appendChild(buildUpcomingBlock({
      eyebrowText: "Stawka nadchodzącego tygodnia",
      titleText: challengeSummary.upcoming.title,
      conditionText: challengeSummary.upcomingConditionText,
      daysLeftText: `Pozostało: ${challengeSummary.upcomingDaysLeft} dni`
    }));
  }

  return card;
}

// v0.52: blok "Ślad tygodnia" wewnątrz karty Stawki.
function buildWeeklyTraceBlock(trace) {
  const wrapper = document.createElement("div");
  wrapper.className = "oos-weekly-trace";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-trace__heading";
  heading.textContent = `Ślad tygodnia: ${trace.tone}`;
  wrapper.appendChild(heading);

  const text = document.createElement("p");
  text.className = "oos-weekly-trace__text";
  text.textContent = trace.text;
  wrapper.appendChild(text);

  if (trace.topMarks.length > 0) {
    const list = document.createElement("ul");
    list.className = "oos-weekly-trace__marks";

    trace.topMarks.forEach((mark) => {
      const item = document.createElement("li");
      item.className = `oos-weekly-trace__mark oos-weekly-trace__mark--${mark.value > 0 ? "good" : mark.value < 0 ? "costly" : "neutral"}`;

      const day = document.createElement("span");
      day.className = "oos-weekly-trace__mark-day";
      day.textContent = `Dzień ${mark.day}`;
      item.appendChild(day);

      const note = document.createElement("span");
      note.className = "oos-weekly-trace__mark-note";
      note.textContent = ` — ${mark.note}`;
      item.appendChild(note);

      list.appendChild(item);
    });

    wrapper.appendChild(list);
  }

  return wrapper;
}

// Dawna karta 4 — Wielki Test. Przeniesiona 1:1 do sekcji szczegółów.
function buildCriticalEventCard(criticalSummary, state) {
  const card = document.createElement("section");
  card.className = "oos-weekly-summary__card oos-weekly-summary__card--critical-event";

  const heading = document.createElement("p");
  heading.className = "oos-weekly-summary__card-heading";
  heading.textContent = "Wielki Test";
  card.appendChild(heading);

  if (criticalSummary.lastResult) {
    card.appendChild(buildResultBlock({
      titleText: criticalSummary.lastResult.success
        ? `Wielki Test zaliczony: ${criticalSummary.lastResult.title}`
        : `Wielki Test niezaliczony: ${criticalSummary.lastResult.title}`,
      detailText: criticalSummary.lastResult.text || "",
      effectText: `Efekt: ${formatCriticalEventEffect(criticalSummary.lastResult.effect)}`,
      success: criticalSummary.lastResult.success
    }));
  }

  if (criticalSummary.upcoming) {
    // v0.20.1, Część D (przeniesione bez zmian): separator "·" zamiast
    // " i " TYLKO w tym miejscu (Wielki Test w weekly summary) — sam
    // formatter w criticalEventSystem.js i Weekly Stakes dalej używają
    // pełnego " i ".
    const compactCondition = criticalSummary.upcomingConditionText.replace(/ i /g, " · ");

    const upcomingBlock = buildUpcomingBlock({
      eyebrowText: "Na horyzoncie",
      titleText: criticalSummary.upcoming.title,
      conditionText: compactCondition,
      daysLeftText: `Pozostało: ${criticalSummary.upcomingDaysLeft} dni`
    });

    // v0.20.1, Część B (przeniesione bez zmian): postęp miesięcznego
    // cyklu, liczony lokalnie tutaj — nie wymaga zmian w
    // criticalEventSystem.js. v0.47: klasa przemianowana na
    // __cycle-progress (stylowana w css/weekly-summary-v0-47.css;
    // stara reguła w v0-21 zostaje nieużywana, ale nietknięta).
    const cycleProgress = document.createElement("p");
    cycleProgress.className = "oos-weekly-summary__cycle-progress";
    cycleProgress.textContent = buildMonthlyCycleProgressText(criticalSummary.upcoming, state);
    upcomingBlock.appendChild(cycleProgress);

    card.appendChild(upcomingBlock);
  }

  return card;
}

function formatCriticalEventEffect(effect) {
  if (!effect) {
    return "";
  }

  return [
    `Zaufanie ${formatSigned(effect.trustChange)}`,
    `Frustracja ${formatSigned(effect.frustrationChange)}`,
    `Spoons ${formatSigned(effect.spoonsChange)}`
  ].join(", ");
}

// UWAGA: `arcStartDay` to ISTNIEJĄCA nazwa pola w zapisanym stanie gry
// (patrz criticalEventSystem.js#generateNextCriticalEvent) — nie wolno
// jej zmieniać bez migracji save'ów, więc zostaje.
function buildMonthlyCycleProgressText(event, state) {
  const total = event.dueDay - event.arcStartDay + 1;
  const rawDay = state.day - event.arcStartDay + 1;
  const clampedDay = Math.min(total, Math.max(1, rawDay));
  return `Miesięczny cykl: dzień ${clampedDay} z ${total}`;
}

// --------------------------------------------------------------------
// Wspólne bloki (result / upcoming) dla kart Stawka tygodnia i Wielki Test
// --------------------------------------------------------------------

function buildResultBlock({ titleText, detailText, effectText, success }) {
  const wrapper = document.createElement("div");
  wrapper.className = success
    ? "oos-weekly-summary__result oos-weekly-summary__result--success"
    : "oos-weekly-summary__result oos-weekly-summary__result--failure";

  const title = document.createElement("p");
  title.className = "oos-weekly-summary__result-title";
  title.textContent = titleText;
  wrapper.appendChild(title);

  if (detailText) {
    const detail = document.createElement("p");
    detail.className = "oos-weekly-summary__result-detail";
    detail.textContent = detailText;
    wrapper.appendChild(detail);
  }

  const effect = document.createElement("p");
  effect.className = "oos-weekly-summary__result-effect";
  effect.textContent = effectText;
  wrapper.appendChild(effect);

  return wrapper;
}

function buildUpcomingBlock({ eyebrowText, titleText, conditionText, daysLeftText }) {
  const wrapper = document.createElement("div");
  wrapper.className = "oos-weekly-summary__upcoming";

  const eyebrow = document.createElement("p");
  eyebrow.className = "oos-weekly-summary__upcoming-eyebrow";
  eyebrow.textContent = eyebrowText;
  wrapper.appendChild(eyebrow);

  const title = document.createElement("p");
  title.className = "oos-weekly-summary__upcoming-title";
  title.textContent = titleText;
  wrapper.appendChild(title);

  const condition = document.createElement("p");
  condition.className = "oos-weekly-summary__upcoming-condition";
  condition.textContent = `Warunek: ${conditionText}`;
  wrapper.appendChild(condition);

  const countdown = document.createElement("p");
  countdown.className = "oos-weekly-summary__upcoming-countdown";
  countdown.textContent = daysLeftText;
  wrapper.appendChild(countdown);

  return wrapper;
}

// --------------------------------------------------------------------
// 7. Footer / CTA
// --------------------------------------------------------------------

// v0.30.5: buildFooter przyjmuje `state` jawnie (naprawa ReferenceError).
// v0.47: zmieniony wyłącznie tekst przycisku — logika (saveGame +
// przejście do monthSummary albo game) NIETKNIĘTA.
function buildFooter(state) {
  const footer = document.createElement("footer");
  footer.className = "oos-weekly-summary__footer";

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Wejdź w kolejny tydzień";
  continueButton.addEventListener("click", () => {
    saveGame();
    showScreen(hasPendingMonthSummary(state) ? "monthSummary" : "game");
  });
  footer.appendChild(continueButton);

  return footer;
}

function formatSigned(value) {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "0";
}
