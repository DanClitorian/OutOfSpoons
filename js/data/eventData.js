// eventData.js
//
// Statyczna definicja puli wydarzeń decyzyjnych.
// Pula zawiera jedno wydarzenie (dokładnie ten przykład z dokumentu
// projektowego Core Gameplay, punkt 7: "Partner chce rozmowy").
// Kolejne wydarzenia dodaje się jako kolejne obiekty w tej tablicy —
// eventSystem.js jest już przygotowany, by z nich korzystać.
//
// v0.3: wydarzenie nie wskazuje już statycznego NPC (dawne "npcId: alex").
// Zamiast tego opis i teksty wyników używają placeholdera {partnerName},
// który eventSystem.js / eventScreen.js podmieniają na imię aktualnego,
// wylosowanego partnera z rozgrywki (state.partner.name). Dzięki temu
// to samo wydarzenie działa niezależnie od tego, kto został wylosowany.
//
// Obecnie każde wydarzenie w puli dotyczy partnera z rozgrywki. Gdy w
// przyszłości pojawią się wydarzenia z innymi NPC (przyjaciele, rodzina
// itd.), trzeba tu będzie dodać jawne wskazanie celu, np. pole
// targetNpcId, i odpowiednio rozbudować eventSystem.applyChoice.

export const eventPool = [
  {
    id: "talk_request",
    title: "Prośba o rozmowę",
    description:
      "{partnerName} chce dziś poważnie porozmawiać o Waszej relacji. Widzisz, że to dla niego/niej ważne, " +
      "ale Twoje zasoby na dziś są ograniczone.",
    choices: [
      {
        id: "talk_now",
        label: "Rozmawiasz teraz",
        spoonsCost: 2,
        trustChange: 10,
        frustrationChange: -5,
        resultText:
          "Rozmowa była trudna, ale szczera. {partnerName} czuje się wysłuchany/a. " +
          "Kosztowało Cię to jednak część dzisiejszej energii."
      },
      {
        id: "postpone",
        label: "Prosisz o przełożenie rozmowy",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 5,
        resultText:
          "{partnerName} przyjmuje to ze zrozumieniem, choć widać lekkie rozczarowanie. " +
          "Zachowujesz swoje zasoby na dziś."
      },
      {
        id: "ignore",
        label: "Ignorujesz wiadomość",
        spoonsCost: 0,
        trustChange: -8,
        frustrationChange: 12,
        resultText:
          "Nie odpowiadasz. {partnerName} czeka na wiadomość, która nie przychodzi. " +
          "Coś między Wami cichnie."
      }
    ]
  }
];
