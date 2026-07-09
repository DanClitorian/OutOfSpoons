// partnerData.js
//
// Statyczne pule danych używane przez generator partnera
// (patrz systems/partnerSystem.js). Ten plik nie zawiera żadnej logiki
// losowania — tylko surowe dane, zgodnie z podziałem data / systems / ui.

// Minimum 8 imion — losowany partner nie musi za każdym razem nazywać
// się tak samo.
export const partnerNamePool = [
  "Mira",
  "Kuba",
  "Ola",
  "Tomek",
  "Zuzia",
  "Adam",
  "Nina",
  "Filip",
  "Hania",
  "Marek"
];

// Etykieta relacji pokazywana graczowi wprost na karcie partnera.
// To kluczowe dla czytelności: gracz musi od razu wiedzieć, że to osoba
// partnerska, a nie losowy, niezwiązany z nim NPC.
export const relationshipLabels = [
  "Twój partner",
  "Twoja partnerka",
  "Osoba partnerska",
  "Twój chłopak",
  "Twoja dziewczyna"
];

// Minimum 6 krótkich opisów relacji — kontekst, w jakim gracz i partner
// się znajdują. Celowo różnorodne: różne etapy, różne dynamiki.
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
export const morningMessageTemplates = [
  "{name} pisze: „Możemy dziś porozmawiać? Mam coś, co siedzi mi w głowie od wczoraj.”",
  "{name} pisze: „Cześć, myślałam/em o nas ostatnio. Znajdziesz dziś chwilę?”",
  "{name} pisze: „Nic złego się nie stało, ale chciałabym/chciałbym coś z Tobą omówić.”",
  "{name} pisze: „Hej, masz dziś trochę czasu? Chodzi mi coś po głowie odkąd się widzieliśmy.”"
];
