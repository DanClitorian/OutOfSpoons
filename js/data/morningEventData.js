// morningEventData.js
//
// Random morning events for Out of Spoons.
// These are not the main daily choice events.
// They are small day-start modifiers that make spoons carryover feel alive.

export const globalMorningEvents = [
  {
    id: "rain-heavy-air",
    type: "global",
    title: "Ciężkie powietrze nad miastem",
    description: "Dzień zaczyna się powoli. Wszystko wymaga odrobinę więcej tarcia niż zwykle.",
    spoonsChange: -1
  },
  {
    id: "quiet-morning",
    type: "global",
    title: "Cichy poranek",
    description: "Miasto przez chwilę nie domaga się niczego pilnego. To rzadkie.",
    spoonsChange: 1
  },
  {
    id: "admin-noise",
    type: "global",
    title: "Mały administracyjny chaos",
    description: "Powiadomienia, drobne sprawy i cudze pilności podgryzają poranną pojemność.",
    spoonsChange: -2
  },
  {
    id: "good-weather",
    type: "global",
    title: "Światło wchodzi przez okno",
    description: "Nie naprawia życia, ale robi je dziś trochę mniej szorstkim.",
    spoonsChange: 1
  },
  {
    id: "bad-sleep",
    type: "global",
    title: "Sen był technicznie obecny",
    description: "Ciało odnotowało kilka godzin poziomego leżenia. Regeneracja ma inne zdanie.",
    spoonsChange: -1
  },
  {
    id: "unexpected-ease",
    type: "global",
    title: "Jedna rzecz odpadła sama",
    description: "Coś, co miało zająć głowę, rozwiązało się bez Twojego udziału.",
    spoonsChange: 2
  }
];

export const partnerKindnessEvents = [
  {
    id: "tea",
    type: "partner-kindness",
    title: "{partnerName} robi Ci herbatę",
    description: "To drobiazg, ale bez pytania trafia dokładnie tam, gdzie trzeba.",
    spoonsChange: 1,
    trustChange: 1,
    frustrationChange: -1
  },
  {
    id: "soft-message",
    type: "partner-kindness",
    title: "{partnerName} wysyła spokojną wiadomość",
    description: "Bez presji, bez ukrytego testu. Po prostu sygnał: jestem obok.",
    spoonsChange: 1,
    trustChange: 2,
    frustrationChange: -1
  },
  {
    id: "takes-small-task",
    type: "partner-kindness",
    title: "{partnerName} przejmuje małą sprawę",
    description: "Jedna rzecz znika z Twojej głowy, zanim zdążyła rozrosnąć się w pięć kolejnych.",
    spoonsChange: 2,
    trustChange: 1,
    frustrationChange: -1
  },
  {
    id: "no-pressure",
    type: "partner-kindness",
    title: "{partnerName} daje Ci przestrzeń",
    description: "Nie jako chłód. Raczej jako ciche: nie musisz teraz udźwignąć wszystkiego.",
    spoonsChange: 1,
    trustChange: 1,
    frustrationChange: -2
  },
  {
    id: "remembers-detail",
    type: "partner-kindness",
    title: "{partnerName} pamięta mały szczegół",
    description: "Nie chodzi o gest. Chodzi o bycie zauważonym bez proszenia o uwagę.",
    spoonsChange: 1,
    trustChange: 2,
    frustrationChange: 0
  }
];
