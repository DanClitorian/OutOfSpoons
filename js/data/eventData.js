// eventData.js
//
// Statyczna definicja puli wydarzeń decyzyjnych.
// W v0.1 pula zawiera jedno wydarzenie (dokładnie ten przykład
// z dokumentu projektowego Core Gameplay, punkt 7: "Partner chce rozmowy").
// Kolejne wydarzenia dodaje się jako kolejne obiekty w tej tablicy —
// eventSystem.js jest już przygotowany, by z nich korzystać.

export const eventPool = [
  {
    id: "talk_request",
    npcId: "alex",
    title: "Prośba o rozmowę",
    description:
      "Alex chce dziś poważnie porozmawiać o Waszej relacji. Widzisz, że to dla niego/niej ważne, " +
      "ale Twoje zasoby na dziś są ograniczone.",
    choices: [
      {
        id: "talk_now",
        label: "Rozmawiasz teraz",
        spoonsCost: 2,
        trustChange: 10,
        frustrationChange: -5,
        resultText:
          "Rozmowa była trudna, ale szczera. Alex czuje się wysłuchany/a. " +
          "Kosztowało Cię to jednak część dzisiejszej energii."
      },
      {
        id: "postpone",
        label: "Prosisz o przełożenie rozmowy",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 5,
        resultText:
          "Alex przyjmuje to ze zrozumieniem, choć widać lekkie rozczarowanie. " +
          "Zachowujesz swoje zasoby na dziś."
      },
      {
        id: "ignore",
        label: "Ignorujesz wiadomość",
        spoonsCost: 0,
        trustChange: -8,
        frustrationChange: 12,
        resultText:
          "Nie odpowiadasz. Alex czeka na wiadomość, która nie przychodzi. " +
          "Coś między Wami cichnie."
      }
    ]
  }
];
