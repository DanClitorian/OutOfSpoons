// eventData.js
//
// Statyczna definicja puli wydarzeń decyzyjnych.
//
// v0.4: pula rozrosła się z jednego wydarzenia do sześciu, pokrywających
// różne obszary życia (nie tylko "partner chce rozmawiać"). Każdy event
// ma teraz pole "tags" (kategoryzacja, na razie tylko informacyjna —
// żaden system jeszcze z niej nie korzysta) oraz opcjonalne "minDay"
// (wydarzenie nie pojawi się wcześniej niż danego dnia rozgrywki).
// Losowaniem i respektowaniem minDay zajmuje się systems/eventSystem.js.
//
// Wydarzenia nadal używają placeholdera {partnerName}, podmienianego na
// imię aktualnego partnera z rozgrywki (state.partner.name) przez
// eventSystem.js / eventScreen.js — patrz uzasadnienie w komentarzach
// tamtych plików.

// v0.12: weightTags wpływają na częstotliwość losowania eventu.

export const eventPool = [
  {
    id: "talk_request",
    title: "Prośba o rozmowę",
    tags: ["relationship", "communication"],
    weightTags: ["repair", "high-trust"],
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
  },
  {
    id: "cancel_plans",
    title: "Za mało zasobów na dziś",
    tags: ["relationship", "spoons", "boundaries"],
    weightTags: ["low-spoons", "avoidance"],
    description:
      "Masz umówione spotkanie z {partnerName}, ale czujesz, że dzisiaj po prostu nie dasz rady. " +
      "Wieczór zaczyna wyglądać jak zadanie do odhaczenia, a nie coś, na co miałeś/aś ochotę.",
    choices: [
      {
        id: "go_anyway",
        label: "Idziesz mimo wszystko",
        spoonsCost: 3,
        trustChange: 3,
        frustrationChange: -2,
        resultText:
          "Dajesz radę, ale kosztem reszty wieczoru. {partnerName} jest zadowolony/a, " +
          "Ty wracasz do domu kompletnie wydrenowany/a."
      },
      {
        id: "cancel_honestly",
        label: "Odwołujesz, mówiąc wprost dlaczego",
        spoonsCost: 0,
        trustChange: 4,
        frustrationChange: 2,
        resultText:
          "{partnerName} trochę żałuje, ale docenia szczerość. Zostaje Ci reszta energii na dziś."
      },
      {
        id: "cancel_vague",
        label: "Odwołujesz bez wyjaśnienia",
        spoonsCost: 0,
        trustChange: -5,
        frustrationChange: 8,
        resultText:
          "{partnerName} pyta, czy wszystko w porządku. Nie odpowiadasz wprost. " +
          "Cisza między Wami robi się gęstsza niż powinna."
      }
    ]
  },
  {
    id: "need_rest",
    title: "Dzień, w którym nic nie chce ruszyć",
    tags: ["self-care", "spoons"],
    weightTags: ["low-spoons", "avoidance"],
    description:
      "Budzisz się i wiesz, że priorytetem powinno być dziś po prostu nic nie robić. " +
      "Świat, jak zwykle, ma inne plany.",
    choices: [
      {
        id: "protect_day",
        label: "Chronisz dzień dla siebie",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: 0,
        resultText: "Nic się nie pali. Świat jakoś przetrwa bez Ciebie przez jeden dzień."
      },
      {
        id: "push_through",
        label: "Przepychasz się przez obowiązki mimo zmęczenia",
        spoonsCost: 4,
        trustChange: 0,
        frustrationChange: 0,
        resultText:
          "Kończysz listę zadań. Ciało wystawi rachunek później, ale na razie masz poczucie kontroli."
      },
      {
        id: "half_measure",
        label: "Robisz tylko to, co absolutnie konieczne",
        spoonsCost: 2,
        trustChange: 0,
        frustrationChange: 0,
        resultText: "Nie wszystko zrobione, ale nie wszystko musiało być. To już coś."
      }
    ]
  },
  {
    id: "text_misunderstanding",
    title: "Wiadomość, którą można czytać na dziesięć sposobów",
    tags: ["communication", "anxiety"],
    weightTags: ["low-trust", "tension"],
    description:
      "{partnerName} wysyła wiadomość, która brzmi krócej niż zwykle. Zaczynasz się zastanawiać, " +
      "czy to nic, czy jednak coś.",
    choices: [
      {
        id: "ask_directly",
        label: "Pytasz wprost, o co chodzi",
        spoonsCost: 1,
        trustChange: 6,
        frustrationChange: -3,
        resultText:
          "{partnerName} tłumaczy, że po prostu spieszył/a się między spotkaniami. " +
          "Cała sprawa rozwiewa się w kilka zdań."
      },
      {
        id: "overthink",
        label: "Analizujesz wiadomość przez pół dnia zamiast zapytać",
        spoonsCost: 3,
        trustChange: -1,
        frustrationChange: 1,
        resultText: "Wymyślasz kilka scenariuszy, żaden się nie sprawdza. Zostaje tylko zmęczenie."
      },
      {
        id: "mirror_tone",
        label: "Odpisujesz równie krótko",
        spoonsCost: 0,
        trustChange: -3,
        frustrationChange: 6,
        resultText:
          "{partnerName} pyta później, czy wszystko w porządku. Nie odpowiadasz wprost. " +
          "Cisza między Wami robi się gęstsza niż powinna."
      }
    ]
  },
  {
    id: "social_invitation",
    title: "Zaproszenie na spotkanie towarzyskie",
    tags: ["social", "spoons"],
    weightTags: ["high-spoons"],
    minDay: 2,
    description:
      "Znajomi organizują coś w ten weekend. {partnerName} chętnie by poszedł/poszła. " +
      "Ty patrzysz na to zaproszenie jak na kolejną pozycję w budżecie, którego akurat nie masz.",
    choices: [
      {
        id: "go_together",
        label: "Idziecie razem",
        spoonsCost: 4,
        trustChange: 5,
        frustrationChange: -2,
        resultText:
          "Wieczór jest w porządku, ale wracasz do domu na rezerwach. " +
          "{partnerName} był/a zadowolony/a z wieczoru."
      },
      {
        id: "partner_goes_alone",
        label: "Zostajesz w domu, {partnerName} idzie sam/a",
        spoonsCost: 0,
        trustChange: 1,
        frustrationChange: 1,
        resultText:
          "{partnerName} rozumie, choć trochę żal mu/jej, że nie ma Cię obok. " +
          "Ty masz spokojny wieczór."
      },
      {
        id: "decline_both",
        label: "Odmawiacie oboje",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 3,
        resultText:
          "{partnerName} niechętnie się zgadza, choć wygląda na to, że miał/a ochotę pójść."
      }
    ]
  },
  {
    id: "life_obligation",
    title: "Obowiązek, który nie pyta o zgodę",
    tags: ["obligation", "time"],
    weightTags: ["tension"],
    minDay: 3,
    description:
      "Formalność, której nie da się przełożyć bez konsekwencji, wchodzi dokładnie w czas, " +
      "który miał należeć do {partnerName}.",
    choices: [
      {
        id: "handle_obligation",
        label: "Zajmujesz się obowiązkiem, przekładasz czas z {partnerName}",
        spoonsCost: 2,
        trustChange: -3,
        frustrationChange: 4,
        resultText:
          "Sprawa załatwiona. {partnerName} mówi, że rozumie — ale czas, którego nie było, " +
          "i tak się nie odda."
      },
      {
        id: "squeeze_both",
        label: "Próbujesz zmieścić jedno i drugie",
        spoonsCost: 5,
        trustChange: 2,
        frustrationChange: -1,
        resultText:
          "Udaje się, ale dzień kończy się wcześniej, niż powinien — z Tobą kompletnie bez sił."
      },
      {
        id: "ask_for_extension",
        label: "Prosisz o przesunięcie terminu obowiązku",
        spoonsCost: 1,
        trustChange: 3,
        frustrationChange: -2,
        resultText: "Zaskakująco się udaje. {partnerName} docenia zmianę priorytetów."
      }
    ]
  }
];
