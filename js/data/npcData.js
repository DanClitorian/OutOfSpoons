// npcData.js
//
// Statyczna definicja NPC dostępnych w prototypie.
// To są "surowe dane" — logika, która się nimi posługuje, znajduje
// się w systems/npcSystem.js. Dzięki temu rozdzieleniu, zamiana tego
// pliku na generator losowy w przyszłości nie wymaga zmian w logice.

export const npcData = {
  alex: {
    id: "alex",
    name: "Alex",
    description: "Twój partner. Ceni szczerość i czas spędzony razem.",
    baseTrust: 50,
    baseFrustration: 20,
    morningMessage:
      "Alex pisze: „Możemy dziś porozmawiać? Chciałbym/chciałabym coś z Tobą omówić.”"
  }
};
