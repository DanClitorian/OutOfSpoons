// partnerData.js
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
export const morningMessageTemplates = [];
