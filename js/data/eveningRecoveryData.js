// eveningRecoveryData.js
//
// v0.9: evening recovery options (5 statycznych).
// v0.51: Contextual Evening Recovery — pula rozszerzona do 17 opcji.
//
// To są opcje RECOVERY, nie dzienne wydarzenia (celowo NIE eventData).
// Logika doboru (gates/boosts/limit 3-4) mieszka w
// eveningRecoverySystem.js — ten plik to czysta treść + deklaratywne
// warunki, łatwe do czytania i rozbudowy.
//
// Struktura opcji:
//   id          - stabilny identyfikator (5 starych id ZACHOWANE 1:1,
//                 bo patternSystem#EVENING_OPTION_TAGS mapuje po nich)
//   type        - typ do CSS/etykiet (sleep/rest/grounding/connection/
//                 repair/work/preparation/unmasking/admin/solitude/
//                 avoidance); NIGDY nie pokazywany jako debug
//   label/description - tekst karty; {partnerName}/{metamourName}
//                 podmieniane przy renderze; ZERO liczb efektów
//   effects     - umiarkowana skala (patrz brief v0.51 pkt 8):
//                 spoonsChange, trustChange, frustrationChange,
//                 fatigueChange, maskingDebtChange, workPressureChange,
//                 staticChange — wszystkie opcjonalne
//   gate        - deklaratywne warunki dostępności (AND); brak = zawsze
//   base        - bazowy priorytet
//   boosts      - [{ when: {gate...}, add: liczba }] — kontekstowe
//                 podbicia priorytetu
//
// UWAGA balansowa: sleep-early to gwarantowana "bezpieczna opcja
// minimum" (system ZAWSZE ją dołącza) — jej trade-offem jest koszt
// alternatywny: nic poza ciałem się nie poprawia. Świadomie zgodne z
// briefem ("śpisz wcześniej: odzyskujesz pojemność, ale relacja
// zostaje nieruszona").
//
// UWAGA wzorce: teksty i efekty są pisane POD heurystyki
// patternSystem#deriveTags (spoons>=2 -> rest, "szczer/rozmow" ->
// transparency, "unik/odłóż" -> avoidance, trust>=2 -> repair...) —
// nowe opcje wpinają się w system wzorców bez zmian w patternSystem.js.

export const eveningRecoveryOptions = [

  // ---------------- A/B: odpoczynek ciała / sen ----------------------

  {
    id: "sleep-early",
    type: "sleep",
    label: "Położyć się wcześniej",
    description: "Położyć ciało wcześniej niż ambicje. Nie rozwiązuje wszystkiego, ale przestajesz dokładać kolejne warstwy zmęczenia.",
    effects: { spoonsChange: 2, fatigueChange: -1 },
    base: 45,
    boosts: [
      { when: { maxSpoons: 1 }, add: 40 },
      { when: { minFatigue: 4 }, add: 25 }
    ]
  },
  {
    id: "deep-rest",
    type: "rest",
    label: "Wieczór całkiem dla siebie",
    description: "Bez ekranu, bez rozmów, bez bycia dostępnym/ą. Ktoś to pewnie zauważy — i trudno.",
    effects: { spoonsChange: 3, trustChange: -1 },
    base: 28,
    boosts: [
      { when: { minFatigue: 3 }, add: 30 },
      { when: { maxSpoons: 2 }, add: 20 }
    ]
  },
  {
    id: "let-go",
    type: "rest",
    label: "Nie naprawiać siebie dzisiaj",
    description: "Zostawić zaległości tam, gdzie leżą. Odpuścić świadomie — jutro też będzie dzień, może nawet lepszy do tego.",
    effects: { spoonsChange: 1, frustrationChange: -1 },
    base: 35,
    boosts: []
  },
  {
    id: "small-ritual",
    type: "grounding",
    label: "Zrobić mały rytuał domknięcia dnia",
    description: "Herbata, prysznic, zapisanie jednej myśli. Małe rzeczy nie są małe, kiedy ledwo trzymasz strukturę.",
    effects: { spoonsChange: 1, fatigueChange: -1, staticChange: -1 },
    base: 32,
    boosts: [
      { when: { minStatic: 1 }, add: 15 }
    ]
  },

  // ---------------- C: kontakt z partnerem ---------------------------

  {
    id: "short-message",
    type: "connection",
    label: "Napisać krótką wiadomość do {partnerName}",
    description: "Nie masz siły na wielką rozmowę, ale możesz zostawić jeden szczery sygnał obecności.",
    effects: { spoonsChange: -1, trustChange: 2, frustrationChange: -1 },
    gate: { partnerRequired: true },
    base: 34,
    boosts: [
      { when: { maxTrust: 45 }, add: 25 },
      { when: { minFrustration: 50 }, add: 10 }
    ]
  },
  {
    id: "metamour-honest-question",
    type: "connection",
    label: "Zapytać wprost o {metamourName}",
    description: "Jedno uczciwe pytanie zamiast wieczoru domysłów. Odpowiedź może nie być wygodna — domysły są gorsze.",
    effects: { spoonsChange: -1, trustChange: 2, frustrationChange: 1, metamourTensionChange: -8 },
    gate: { partnerRequired: true, minMetamourTension: 55 },
    base: 20,
    boosts: [
      { when: { minMetamourTension: 70 }, add: 35 }
    ]
  },

  // ---------------- D: mała naprawa relacji --------------------------

  {
    id: "honest-return",
    type: "repair",
    label: "Wrócić do dzisiejszej rozmowy",
    description: "Powiedzieć szczerze jedno zdanie, które powinno było paść wcześniej. Kosztuje — właśnie dlatego działa.",
    effects: { spoonsChange: -2, trustChange: 3, frustrationChange: -3 },
    gate: { partnerRequired: true, minFrustration: 45 },
    base: 25,
    boosts: [
      { when: { conflictAtLeast: "critical" }, add: 45 },
      { when: { minFrustration: 60 }, add: 20 }
    ]
  },

  // ---------------- E: ograniczenie pracy ----------------------------

  {
    id: "close-laptop",
    type: "work",
    label: "Zamknąć laptopa naprawdę",
    description: "Odmówić pracy jednego wieczoru. Niepokój zostanie, ale przynajmniej będzie twój, nie firmowy.",
    effects: { workPressureChange: -5, frustrationChange: 1, spoonsChange: 1 },
    gate: { minWorkPressure: 45 },
    base: 22,
    boosts: [
      { when: { minWorkPressure: 65 }, add: 25 }
    ]
  },
  {
    id: "finish-one-task",
    type: "work",
    label: "Dokończyć jedną rzecz z pracy",
    description: "Żeby jutro nie gryzła od progu. Ciało zapłaci, kalendarz odetchnie.",
    effects: { workPressureChange: -7, spoonsChange: -2, fatigueChange: 1 },
    gate: { minWorkPressure: 55 },
    base: 20,
    boosts: [
      { when: { minWorkPressure: 70 }, add: 30 }
    ]
  },

  // ---------------- F/G: przygotowanie (bez nowej mechaniki) ---------

  {
    id: "prep-bigger-test",
    type: "preparation",
    label: "Przejrzeć to, co nadchodzi",
    description: "Nie da się przygotować na wszystko. Da się przestać udawać, że nic nie nadchodzi — i porozmawiać o planie.",
    effects: { frustrationChange: -2, spoonsChange: -1, trustChange: 1 },
    gate: { criticalWithinDays: 3 },
    base: 34,
    boosts: [
      { when: { criticalWithinDays: 1 }, add: 25 }
    ]
  },
  {
    id: "plan-tomorrow",
    type: "preparation",
    label: "Poukładać jutro zawczasu",
    description: "Pięć minut planu potrafi kupić spokojniejszy poranek. Kosztuje tylko końcówkę dzisiaj.",
    effects: { frustrationChange: -2, fatigueChange: -1, spoonsChange: -1 },
    gate: { weeklyWithinDays: 2 },
    base: 33,
    boosts: [
      { when: { weeklyWithinDays: 1 }, add: 20 }
    ]
  },

  // ---------------- H: redukcja maskowania ---------------------------

  {
    id: "drop-the-mask",
    type: "unmasking",
    label: "Przestać grać na dziś",
    description: "Pokazać {partnerName} zmęczenie takie, jakie jest. W pokoju zrobi się prawdziwiej — niekoniecznie od razu lżej.",
    effects: { maskingDebtChange: -2, spoonsChange: 1, frustrationChange: 1 },
    gate: { partnerRequired: true, minMaskingDebt: 2 },
    base: 24,
    boosts: [
      { when: { minMaskingDebt: 3 }, add: 25 },
      { when: { minMaskingDebt: 4 }, add: 20 }
    ]
  },

  // ---------------- I: wyciszenie szumu ------------------------------

  {
    id: "silence-everything",
    type: "grounding",
    label: "Wyciszyć wszystko, co miga",
    description: "Telefon ekranem w dół, światło niżej. Szum nie znika, ale przestaje dyrygować.",
    effects: { staticChange: -2, fatigueChange: -1 },
    gate: { minStatic: 2 },
    base: 26,
    boosts: [
      { when: { minStatic: 3 }, add: 25 }
    ]
  },

  // ---------------- J: samotność jako wybór --------------------------

  {
    id: "chosen-solitude",
    type: "solitude",
    label: "Wybrać samotność na własnych warunkach",
    description: "Nie ucieczka — decyzja. Wieczór bez nikogo, żeby jutro było z czego dawać.",
    effects: { spoonsChange: 2, trustChange: -1, frustrationChange: -2 },
    gate: { minFrustration: 45 },
    base: 20,
    boosts: [
      { when: { minFrustration: 60 }, add: 15 }
    ]
  },

  // ---------------- K: mała administracja życia ----------------------

  {
    id: "one-small-errand",
    type: "admin",
    label: "Zamknąć jedną zaległość",
    description: "Nie całe życie — jedną rzecz. Rachunek, formularz, wiadomość. Mała ulga, ale prawdziwa.",
    effects: { spoonsChange: -1, frustrationChange: -2, workPressureChange: -2 },
    base: 27,
    boosts: [
      { when: { minFrustration: 40 }, add: 8 }
    ]
  },

  // ---------------- L: uniki (kuszące, nie zakazane) -----------------
  //
  // DECYZJA PROJEKTOWA: opcje typu "avoidance" są CELOWO gorsze
  // mechanicznie od uczciwych odpowiedników — to pułapki budujące
  // wzorzec unikania (patternSystem taguje je jako avoidance), nie
  // "fałszywe wybory". Zakaz ścisłej dominacji (brief pkt 4) dotyczy
  // opcji oczywiście NAJLEPSZYCH, nie kuszących najgorszych.

  {
    id: "pretend-fine",
    type: "avoidance",
    label: "Udawać, że wszystko jest okej",
    description: "Na zewnątrz nic się nie dzieje. W środku wszystko zostaje bez opieki — i odkłada się na później.",
    effects: { spoonsChange: 1, trustChange: -1, frustrationChange: 2, maskingDebtChange: 1 },
    base: 15,
    boosts: [
      { when: { maxSpoons: 1 }, add: 20 }
    ]
  },
  {
    id: "mindless-scroll",
    type: "avoidance",
    label: "Scrollować, żeby nie myśleć",
    description: "Daje chwilowe odcięcie i odkłada wszystko na później. Prawdziwej regeneracji w tym niewiele.",
    effects: { spoonsChange: 1, frustrationChange: 1, staticChange: 1 },
    base: 15,
    boosts: [
      { when: { minFatigue: 3 }, add: 10 }
    ]
  }
];
