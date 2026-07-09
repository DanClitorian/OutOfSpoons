// traitsData.js
//
// Statyczna lista cech psychologicznych dostępnych w kreatorze postaci.
// To NIE są diagnozy medyczne — to sposoby, w jakie postać reaguje
// na obciążenie i presję. Gracz wybiera od MIN do MAX cech (patrz
// systems/characterSystem.js).
//
// Każda cecha może mieć:
// - spoonsModifier: jednorazowy wpływ na startowe/maksymalne spoons,
// - flavorText: krótki opis pokazywany graczowi (nieoceniający),
// - flags: lista "future flag" zapisywanych w player.flags — na razie
//   bierne, przygotowane pod przyszłe mechaniki (np. inny przebieg
//   wydarzeń w zależności od flag).

export const traitsData = [
  {
    id: "adhd",
    label: "ADHD",
    spoonsModifier: -1,
    flavorText: "Łatwiej wpadasz w hyperfocus — potrafisz zniknąć w jednej rzeczy i stracić poczucie czasu.",
    flags: []
  },
  {
    id: "autism",
    label: "Autyzm",
    spoonsModifier: -1,
    flavorText: "Przewidywalność dnia daje Ci poczucie bezpieczeństwa — niespodzianki kosztują więcej.",
    flags: []
  },
  {
    id: "anxiety",
    label: "Lęk",
    spoonsModifier: 0,
    flavorText: null,
    flags: ["anxiety"]
  },
  {
    id: "depression",
    label: "Depresyjność",
    spoonsModifier: -2,
    flavorText: null,
    flags: []
  },
  {
    id: "rejectionSensitivity",
    label: "BPD / wysoka wrażliwość na odrzucenie",
    spoonsModifier: 0,
    flavorText: null,
    flags: ["rejectionSensitivity"]
  },
  {
    id: "sensorySensitivity",
    label: "HSP / wysoka wrażliwość sensoryczna",
    spoonsModifier: 0,
    flavorText: null,
    flags: ["sensorySensitivity"]
  },
  {
    id: "peoplePleasing",
    label: "People pleasing",
    spoonsModifier: 0,
    flavorText: null,
    flags: ["peoplePleasing"]
  },
  {
    id: "introvert",
    label: "Introwersja",
    spoonsModifier: 0,
    flavorText: null,
    flags: ["introvert"]
  },
  {
    id: "autonomyNeed",
    label: "Wysoka potrzeba autonomii",
    spoonsModifier: 0,
    flavorText: null,
    flags: ["autonomyNeed"]
  },
  {
    id: "closenessNeed",
    label: "Wysoka potrzeba bliskości",
    spoonsModifier: 0,
    flavorText: null,
    flags: ["closenessNeed"]
  }
];