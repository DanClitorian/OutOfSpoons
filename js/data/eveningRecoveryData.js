// eveningRecoveryData.js
//
// v0.9: evening recovery options.
// The player chooses one way to end the day before the next morning starts.

export const eveningRecoveryOptions = [
  {
    id: "sleep-early",
    label: "Położyć się wcześniej",
    description: "Nie rozwiązuje wszystkiego, ale przynajmniej przestajesz dziś dokładać kolejne warstwy zmęczenia.",
    effects: {
      spoonsChange: 3,
      trustChange: 0,
      frustrationChange: -1
    }
  },
  {
    id: "mindless-scroll",
    label: "Scrollować, żeby nie myśleć",
    description: "Daje chwilowe odcięcie. Nie daje prawdziwej regeneracji.",
    effects: {
      spoonsChange: 1,
      trustChange: 0,
      frustrationChange: 1
    }
  },
  {
    id: "short-message",
    label: "Napisać krótką wiadomość do {partnerName}",
    description: "Nie masz siły na wielką rozmowę, ale możesz zostawić jasny sygnał obecności.",
    effects: {
      spoonsChange: -1,
      trustChange: 2,
      frustrationChange: -1
    }
  },
  {
    id: "pretend-fine",
    label: "Udawać, że wszystko jest okej",
    description: "Na zewnątrz nic się nie dzieje. W środku wszystko zostaje bez opieki.",
    effects: {
      spoonsChange: 0,
      trustChange: -1,
      frustrationChange: 2
    }
  },
  {
    id: "small-ritual",
    label: "Zrobić mały rytuał domknięcia dnia",
    description: "Herbata, prysznic, zapisanie jednej myśli. Małe rzeczy nie są małe, kiedy ledwo trzymasz strukturę.",
    effects: {
      spoonsChange: 2,
      trustChange: 0,
      frustrationChange: 0
    }
  }
];
