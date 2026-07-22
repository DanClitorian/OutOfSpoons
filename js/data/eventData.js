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

// v0.13: agendaSlots przypisują eventy do slotów dziennej agendy.

export const eventPool = [
  {
    id: "talk_request",
    title: "Prośba o rozmowę",
    tags: ["relationship", "communication"],
    weightTags: ["repair", "high-trust"],
    agendaSlots: ["relationship"],
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
    agendaSlots: ["relationship", "inner"],
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
    agendaSlots: ["inner"],
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
    agendaSlots: ["relationship"],
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
    agendaSlots: ["obligation"],
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
    agendaSlots: ["obligation"],
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
  },

  // CLEAN v0.23 partner-autonomy events START
  // v0.23: Partner Capacity / Partner Autonomy Foundation. Pierwsza
  // realna oznaka tego, że partner ma własną pojemność, niezależną od
  // gracza. weightTags "partner-capacity-low" / "partner-needs-support"
  // dają tym eventom WIĘKSZĄ SZANSĘ (nie gwarancję) pojawienia się,
  // kiedy partnerCapacitySystem.js zgłasza niski capacity / wysoki
  // stress (patrz eventWeightSystem.js). Bez tego kontekstu zachowują
  // się jak zwykłe eventy relacyjne z normalną wagą bazową.
  {
    id: "partner_no_capacity",
    title: "Brak miejsca",
    tags: ["relationship", "partner-autonomy"],
    weightTags: ["partner-capacity-low"],
    agendaSlots: ["relationship"],
    description:
      "{partnerName} mówi, że nie ma dziś pojemności na trudną rozmowę. Nie brzmi to jak kara. " +
      "Bardziej jak informacja o stanie systemu.",
    choices: [
      {
        id: "give_space",
        label: "Dać przestrzeń",
        spoonsCost: 1,
        trustChange: 1,
        frustrationChange: -1,
        resultText:
          "Nie dostajesz wsparcia, po które przyszedłeś/przyszłaś, ale nie dokładasz ciężaru drugiej osobie."
      },
      {
        id: "ask_anyway",
        label: "Poprosić mimo wszystko",
        spoonsCost: 2,
        trustChange: -1,
        frustrationChange: 2,
        resultText:
          "Potrzebujesz rozmowy. {partnerName} próbuje być, ale między wami pojawia się koszt, którego nikt nie chciał nazwać."
      },
      {
        id: "withdraw",
        label: "Wycofać się bez słowa",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 1,
        resultText: "Robi się cicho. Technicznie nikt nie krzyczy. Relacja zna ten rodzaj ciszy."
      }
    ]
  },
  {
    id: "partner_needs_support",
    title: "To nie twój kryzys. Jeszcze.",
    tags: ["relationship", "partner-autonomy"],
    weightTags: ["partner-needs-support"],
    agendaSlots: ["relationship"],
    description:
      "{partnerName} przychodzi z czymś swoim — nie dramatycznym, ale ciężkim. Nie prosi wprost o pomoc. " +
      "Zostawia to gdzieś między słowami.",
    choices: [
      {
        id: "support_anyway",
        label: "Wesprzeć, mimo że sam/a niewiele masz",
        spoonsCost: 3,
        trustChange: 4,
        frustrationChange: -3,
        resultText:
          "{partnerName} czuje się mniej sam/a z tym, co niesie. Ty zostajesz z rachunkiem, który zapłacisz później."
      },
      {
        id: "name_limits",
        label: "Powiedzieć uczciwie, że nie masz dziś zasobów",
        spoonsCost: 1,
        trustChange: 1,
        frustrationChange: 1,
        resultText:
          "Nie brzmi to jak odrzucenie, ale i tak trochę nim jest. {partnerName} przyjmuje to — z wysiłkiem."
      },
      {
        id: "postpone_support",
        label: "Odroczyć rozmowę na inny dzień",
        spoonsCost: 0,
        trustChange: -1,
        frustrationChange: 2,
        resultText: "{partnerName} zostaje sam/a z tym jeszcze trochę dłużej. Nikt tego głośno nie nazywa problemem."
      }
    ]
  },
  // CLEAN v0.23 partner-autonomy events END
  // CLEAN v0.26 repair events START
  // v0.26: Repair Events / Naprawianie blizn relacyjnych. Pierwsza,
  // bardzo ograniczona możliwość pracy z bliznami z v0.25 — naprawa
  // działa WYŁĄCZNIE przez świadomy, kosztowny wybór (repairAction) w
  // tych konkretnych eventach (tag "repair-event"), nigdy automatycznie.
  // weightTags "relationship-scar" / "repair-opportunity" dają im
  // WIĘKSZĄ SZANSĘ (nie gwarancję) pojawienia się, kiedy istnieje
  // aktywna blizna (patrz eventWeightSystem.js).
  {
    id: "repair_old_conversation",
    title: "Wracając do tamtej rozmowy",
    tags: ["relationship", "communication", "repair-event", "repair"],
    weightTags: ["relationship-scar", "repair-opportunity"],
    agendaSlots: ["relationship"],
    description:
      "Temat, który kiedyś został źle domknięty, wraca nie jako awantura, tylko jako ciche miejsce między zdaniami.",
    choices: [
      {
        id: "name_what_hurt",
        label: "Nazwać, co wtedy naprawdę zabolało",
        spoonsCost: 2,
        trustChange: 3,
        frustrationChange: -1,
        repairAction: { type: "scar-repair", strength: 1 },
        resultText: "Nie wszystko się wyjaśnia. Ale coś przestaje udawać, że nie istnieje."
      },
      {
        id: "smooth_over",
        label: "Wygładzić temat, żeby nie bolało",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: 1,
        resultText: "Robi się spokojniej. Nie to samo co lepiej."
      },
      {
        id: "ask_for_more_time",
        label: "Poprosić o więcej czasu",
        spoonsCost: 1,
        trustChange: 1,
        frustrationChange: 0,
        resultText: "Nie uciekasz. Ale też jeszcze nie wchodzisz do środka."
      }
    ]
  },
  {
    id: "repair_small_proof",
    title: "Mały dowód",
    tags: ["relationship", "repair-event", "trust"],
    weightTags: ["relationship-scar", "repair-opportunity"],
    agendaSlots: ["relationship"],
    description:
      "Po ostatnim kryzysie wielkie deklaracje brzmią tanio. Dzisiaj liczy się coś mniejszego.",
    choices: [
      {
        id: "do_the_small_thing",
        label: "Zrobić małą rzecz, którą obiecałeś/aś",
        spoonsCost: 2,
        trustChange: 2,
        frustrationChange: -1,
        repairAction: { type: "scar-repair", strength: 1 },
        resultText: "To nie jest wielki gest. Właśnie dlatego działa."
      },
      {
        id: "explain_instead",
        label: "Wytłumaczyć, dlaczego ostatnio było trudno",
        spoonsCost: 1,
        trustChange: 1,
        frustrationChange: 0,
        resultText: "Wyjaśnienie pomaga. Trochę. Nie zastępuje obecności."
      },
      {
        id: "promise_better",
        label: "Obiecać, że następnym razem będzie inaczej",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: 1,
        resultText: "Słowa są lżejsze od czynów. Czasem za lekkie."
      }
    ]
  },
  {
    id: "repair_not_normal",
    title: "Nie wracajmy do normalności",
    tags: ["relationship", "repair-event", "boundaries", "repair"],
    weightTags: ["relationship-scar", "repair-opportunity"],
    agendaSlots: ["relationship"],
    description:
      "{partnerName} mówi, że nie chce po prostu udawać, że wszystko wróciło do normy. To brzmi uczciwie. I niewygodnie.",
    choices: [
      {
        id: "build_new_rule",
        label: "Ustalić jedną nową zasadę na przyszłość",
        spoonsCost: 2,
        trustChange: 3,
        frustrationChange: -2,
        repairAction: { type: "scar-repair", strength: 1 },
        resultText: "Nie naprawiacie przeszłości. Ale zmieniacie warunki, w których może się powtórzyć."
      },
      {
        id: "return_to_normal",
        label: "Spróbować wrócić do normalności",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: 2,
        resultText: "Normalność bywa wygodną nazwą dla rzeczy, których nikt nie chce ruszać."
      },
      {
        id: "admit_you_dont_know",
        label: "Przyznać, że nie wiesz jeszcze, jak to naprawić",
        spoonsCost: 1,
        trustChange: 1,
        frustrationChange: -1,
        resultText: "To mało. Ale jest w tym mniej udawania niż zwykle."
      }
    ]
  }
  // CLEAN v0.26 repair events END
  ,

  // CLEAN v0.28 metamour events START
  {
    id: "metamour_calendar",
    title: "Ktoś jeszcze w kalendarzu",
    tags: ["relationship", "metamour", "calendar", "boundaries"],
    weightTags: ["metamour-signal", "relationship-tension"],
    agendaSlots: ["relationship"],
    description:
      "W planach {partnerName} pojawia się {metamourName}. Nie ma w tym nic nieuczciwego. To właśnie jest najtrudniejsze.",
    choices: [
      {
        id: "ask_plainly",
        label: "Zapytać spokojnie, jak wygląda plan",
        spoonsCost: 1,
        trustChange: 2,
        frustrationChange: -1,
        metamourEffect: { familiarityChange: 6, tensionChange: -4 },
        resultText: "Pytanie nie znika w powietrzu. Dostajesz odpowiedź, a nie potwierdzenie najgorszego scenariusza."
      },
      {
        id: "pretend_unbothered",
        label: "Udać, że w ogóle cię to nie rusza",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: 2,
        metamourEffect: { familiarityChange: 0, tensionChange: 5 },
        resultText: "Na zewnątrz spokój. W środku ktoś przesuwa meble bez pytania."
      },
      {
        id: "demand_priority",
        label: "Zażądać jasnego priorytetu",
        spoonsCost: 2,
        trustChange: -3,
        frustrationChange: 5,
        metamourEffect: { familiarityChange: 0, tensionChange: 8 },
        resultText: "Dostajesz jasność. Nie tę, o którą chodziło."
      }
    ]
  },
  {
    id: "metamour_name_in_room",
    title: "Imię w rozmowie",
    tags: ["relationship", "metamour", "communication"],
    weightTags: ["metamour-signal", "low-trust", "tension"],
    agendaSlots: ["relationship"],
    description:
      "{metamourName} pojawia się w rozmowie mimochodem. Wystarcza jedno imię, żeby część ciebie zaczęła robić matematykę porównań.",
    choices: [
      {
        id: "name_the_reaction",
        label: "Nazwać swoją reakcję bez oskarżania",
        spoonsCost: 2,
        trustChange: 3,
        frustrationChange: -2,
        metamourEffect: { familiarityChange: 5, tensionChange: -5 },
        resultText: "Nie robisz z tego procesu sądowego. To pomaga rozmowie zostać rozmową."
      },
      {
        id: "joke_it_away",
        label: "Obrócić to w żart",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: 1,
        metamourEffect: { familiarityChange: 0, tensionChange: 3 },
        resultText: "Żart przechodzi. Prawie. Zostawia po sobie trochę kredy na języku."
      },
      {
        id: "compare_yourself",
        label: "Zapytać, czy wypadasz gorzej",
        spoonsCost: 2,
        trustChange: -2,
        frustrationChange: 4,
        metamourEffect: { familiarityChange: 0, tensionChange: 7 },
        resultText: "Porównanie udaje pytanie. Oboje to słyszycie."
      }
    ]
  },
  {
    id: "metamour_information_boundary",
    title: "Granice informacyjne",
    tags: ["relationship", "metamour", "boundaries", "communication"],
    weightTags: ["metamour-signal", "repair", "tension"],
    agendaSlots: ["relationship"],
    description:
      "Wraca temat tego, ile chcesz wiedzieć o relacji {partnerName} z {metamourName}. Za mało informacji boli. Za dużo też.",
    choices: [
      {
        id: "set_info_boundary",
        label: "Ustalić, jakie informacje są ci potrzebne",
        spoonsCost: 2,
        trustChange: 3,
        frustrationChange: -2,
        metamourEffect: { familiarityChange: 4, tensionChange: -6 },
        resultText: "Nie ustalacie kontroli. Ustalacie mapę, żeby nie chodzić po omacku."
      },
      {
        id: "want_everything",
        label: "Chcieć wiedzieć wszystko",
        spoonsCost: 3,
        trustChange: -1,
        frustrationChange: 3,
        metamourEffect: { familiarityChange: 8, tensionChange: 4 },
        resultText: "Więcej informacji nie zawsze oznacza więcej bezpieczeństwa."
      },
      {
        id: "want_nothing",
        label: "Nie chcieć wiedzieć nic",
        spoonsCost: 0,
        trustChange: -1,
        frustrationChange: 2,
        metamourEffect: { familiarityChange: -2, tensionChange: 4 },
        resultText: "Cisza też jest rodzajem informacji. Tylko trudniej ją zinterpretować."
      }
    ]
  }
  // CLEAN v0.28 metamour events END
  ,

  // CLEAN v0.29 work pressure events START
  {
    id: "work_deadline_evening",
    title: "Termin, który wszedł w wieczór",
    tags: ["work", "obligation", "time", "relationship"],
    weightTags: ["work-pressure", "tension", "low-spoons"],
    agendaSlots: ["obligation"],
    description:
      "Termin z pracy przesuwa się dokładnie tam, gdzie miał być kawałek wieczoru dla ciebie i {partnerName}. Nikt nie zrobił tego specjalnie. To prawie gorsze.",
    choices: [
      {
        id: "finish_work",
        label: "Dokończyć pracę i odwołać resztę wieczoru",
        spoonsCost: 2,
        trustChange: -2,
        frustrationChange: 3,
        workEffect: { pressureChange: -8, stabilityChange: 2, burnoutChange: 4 },
        resultText: "Termin przestaje wisieć nad głową. Zostaje miejsce, w którym miał być wieczór."
      },
      {
        id: "protect_evening",
        label: "Zamknąć laptop i ochronić wieczór",
        spoonsCost: 1,
        trustChange: 3,
        frustrationChange: -2,
        workEffect: { pressureChange: 6, stabilityChange: -2, burnoutChange: -2 },
        resultText: "Nie wszystko da się nadrobić spokojem. Ale przez chwilę naprawdę jesteś obecny/a."
      },
      {
        id: "split_attention",
        label: "Próbować robić jedno i drugie naraz",
        spoonsCost: 4,
        trustChange: -1,
        frustrationChange: 2,
        workEffect: { pressureChange: -3, stabilityChange: 0, burnoutChange: 6 },
        resultText: "Technicznie jesteś wszędzie. Emocjonalnie nigdzie na tyle długo, żeby to wystarczyło."
      }
    ]
  },
  {
    id: "work_after_hours_call",
    title: "Telefon po godzinach",
    tags: ["work", "boundaries", "obligation"],
    weightTags: ["work-pressure", "overextension", "tension"],
    agendaSlots: ["obligation"],
    description:
      "Po pracy przychodzi wiadomość. Niby drobiazg. Tak zaczynają się rzeczy, które potem mieszkają w twojej głowie bez czynszu.",
    choices: [
      {
        id: "answer_immediately",
        label: "Odpowiedzieć od razu",
        spoonsCost: 1,
        trustChange: 0,
        frustrationChange: 1,
        workEffect: { pressureChange: -4, stabilityChange: 1, burnoutChange: 5 },
        resultText: "Sprawa załatwiona. Granica też. Tylko w drugą stronę."
      },
      {
        id: "set_boundary",
        label: "Odpisać, że wrócisz do tego jutro",
        spoonsCost: 1,
        trustChange: 1,
        frustrationChange: -1,
        workEffect: { pressureChange: 3, stabilityChange: 0, burnoutChange: -3 },
        resultText: "Granica nie robi fanfar. Po prostu stoi tam, gdzie ją postawiono."
      },
      {
        id: "ignore_and_stew",
        label: "Nie odpisać, ale myśleć o tym cały wieczór",
        spoonsCost: 2,
        trustChange: -1,
        frustrationChange: 2,
        workEffect: { pressureChange: 5, stabilityChange: 0, burnoutChange: 3 },
        resultText: "Nie pracujesz. Nie odpoczywasz. Genialny kompromis wymyślony przez układ nerwowy."
      }
    ]
  },
  {
    id: "work_burnout_face",
    title: "Nie mam dziś twarzy do ludzi",
    tags: ["work", "burnout", "social", "spoons"],
    weightTags: ["work-pressure", "low-spoons", "high-frustration", "burnout"],
    agendaSlots: ["inner", "obligation"],
    description:
      "Po całym dniu funkcjonowania w trybie osoby kompetentnej zostaje ci twarz. Ale niekoniecznie twoja.",
    choices: [
      {
        id: "unmask_at_home",
        label: "Powiedzieć wprost, że nie masz dziś twarzy do ludzi",
        spoonsCost: 0,
        trustChange: 2,
        frustrationChange: -1,
        workEffect: { pressureChange: 0, stabilityChange: 0, burnoutChange: -4 },
        resultText: "To nie rozwiązuje dnia. Ale przestajesz grać jeszcze jedną scenę po napisach."
      },
      {
        id: "keep_performing",
        label: "Dociągnąć performans do końca dnia",
        spoonsCost: 3,
        trustChange: 0,
        frustrationChange: 2,
        workEffect: { pressureChange: -1, stabilityChange: 1, burnoutChange: 6 },
        resultText: "Nikt nie zauważa problemu. To znaczy: problem wykonał świetną robotę."
      },
      {
        id: "collapse_silently",
        label: "Zniknąć bez tłumaczenia",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 3,
        workEffect: { pressureChange: 1, stabilityChange: 0, burnoutChange: 2 },
        resultText: "Cisza daje ulgę. Potem zaczyna wysyłać własne powiadomienia."
      }
    ]
  },
  // CLEAN v0.29 work pressure events END

  // CLEAN v0.31 content expansion events START
  // v0.31: Content Expansion Pack 1. Wyłącznie nowa treść (9 eventów) w
  // ramach już istniejących systemów — zero nowych pól mechanicznych,
  // zero nowej logiki. Rozkład: 3 relationship/communication, 2
  // inner/spoons/masking, 2 work/life pressure, 2 metamour/network.
  // Wszystkie placeholdery ({partnerName}, {metamourName}) i pola
  // (metamourEffect, workEffect) są już w pełni obsługiwane przez
  // istniejące systemy od v0.28/v0.29 — ten blok tylko z nich korzysta.
  {
    id: "relationship_tone_mismatch",
    title: "Ton, którego nie było",
    tags: ["relationship", "communication", "tension"],
    weightTags: ["low-trust", "tension", "relationship-tension"],
    agendaSlots: ["relationship"],
    description:
      "{partnerName} odpowiada krótko. Może to zmęczenie. Może pośpiech. Może dokładnie ten ton, który twoje ciało zna lepiej niż rozsądek.",
    choices: [
      {
        id: "ask_if_something_happened",
        label: "Zapytać, czy coś się stało",
        spoonsCost: 1,
        trustChange: 2,
        frustrationChange: -1,
        resultText: "Pytanie nie oskarża. Dzięki temu odpowiedź nie musi od razu zakładać zbroi."
      },
      {
        id: "assume_you_know",
        label: "Założyć, że wiesz, o co chodzi",
        spoonsCost: 0,
        trustChange: -1,
        frustrationChange: 3,
        resultText: "Umysł dopisuje brakujące zdania. Ma świetny charakter pisma i fatalne intencje."
      },
      {
        id: "postpone_but_name_it",
        label: "Odłożyć rozmowę, ale nazwać to wprost",
        spoonsCost: 1,
        trustChange: 1,
        frustrationChange: 0,
        resultText: "Nie rozmawiacie teraz. Ale nie udajecie, że nic nie leży na stole."
      }
    ]
  },
  {
    id: "relationship_small_request",
    title: "Mała prośba w złym momencie",
    tags: ["relationship", "support", "spoons"],
    weightTags: ["low-spoons", "partner-capacity-low", "repair"],
    agendaSlots: ["relationship"],
    description:
      "{partnerName} prosi o coś małego. W innym dniu byłoby to naprawdę małe. Dzisiaj ma rozmiar mebla na klatce schodowej.",
    choices: [
      {
        id: "say_what_you_can_give",
        label: "Powiedzieć, ile realnie możesz dziś dać",
        spoonsCost: 1,
        trustChange: 3,
        frustrationChange: -1,
        resultText: "Nie dajesz wszystkiego. Dajesz prawdę o dostępnej części siebie."
      },
      {
        id: "agree_automatically",
        label: "Zgodzić się automatycznie",
        spoonsCost: 3,
        trustChange: 1,
        frustrationChange: 2,
        resultText: "Zgoda wychodzi z ust szybciej niż reszta ciebie zdąży zaprotestować."
      },
      {
        id: "snap_harder_than_needed",
        label: "Odpowiedzieć ostrzej, niż trzeba",
        spoonsCost: 0,
        trustChange: -3,
        frustrationChange: 4,
        resultText: "Prośba była mała. Huk po niej już nie."
      }
    ]
  },
  {
    id: "relationship_good_news_gap",
    title: "Dobra wiadomość w złym ciele",
    tags: ["relationship", "communication", "inner"],
    weightTags: ["high-trust", "low-spoons", "avoidance"],
    agendaSlots: ["relationship", "inner"],
    description:
      "{partnerName} dzieli się czymś dobrym. Chcesz się ucieszyć. Problem w tym, że twoje ciało nie dostało aktualizacji o radości.",
    choices: [
      {
        id: "say_you_are_glad",
        label: "Powiedzieć, że się cieszysz, choć nie umiesz tego pokazać",
        spoonsCost: 1,
        trustChange: 3,
        frustrationChange: -1,
        resultText: "Radość nie zawsze ma właściwą mimikę. Tym razem przynajmniej ma podpis."
      },
      {
        id: "force_enthusiasm",
        label: "Wymusić entuzjazm",
        spoonsCost: 2,
        trustChange: 0,
        frustrationChange: 1,
        resultText: "Występ jest przekonujący. Niestety publiczność siedzi też w twoim układzie nerwowym."
      },
      {
        id: "change_the_subject",
        label: "Zmienić temat",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 2,
        resultText: "Temat znika. Razem z nim znika coś małego, co chciało zostać zobaczone."
      }
    ]
  },
  {
    id: "inner_masking_receipt",
    title: "Paragon za funkcjonowanie",
    tags: ["inner", "masking", "spoons"],
    weightTags: ["low-spoons", "overextension", "avoidance"],
    agendaSlots: ["inner"],
    description:
      "Przez większość dnia działałeś/aś jak osoba, która ma zapasową baterię w kieszeni. Wieczorem okazuje się, że to była atrapa.",
    choices: [
      {
        id: "stop_performing_productivity",
        label: "Przestać udawać produktywność",
        spoonsCost: 0,
        trustChange: 0,
        frustrationChange: -1,
        resultText: "Świat nie klaszcze. Świat też się nie wali. Dziwne, ale użyteczne odkrycie."
      },
      {
        id: "push_one_more_thing",
        label: "Docisnąć jeszcze jedną rzecz",
        spoonsCost: 3,
        trustChange: 0,
        frustrationChange: 2,
        resultText: "Jedna rzecz zostaje zrobiona. Ty trochę mniej."
      },
      {
        id: "vanish_into_safe_stimulus",
        label: "Zniknąć w bezpiecznym bodźcu",
        spoonsCost: 0,
        trustChange: -1,
        frustrationChange: 1,
        resultText: "Bodziec robi za koc gaśniczy. Nie rozwiązuje pożaru, ale przez chwilę nie widać płomieni."
      }
    ]
  },
  {
    id: "inner_too_many_tabs",
    title: "Za dużo otwartych kart",
    tags: ["inner", "spoons", "static"],
    weightTags: ["low-spoons", "high-frustration"],
    agendaSlots: ["inner"],
    description:
      "W głowie masz otwarte karty, których nie da się zamknąć, bo każda twierdzi, że zawiera coś pilnego.",
    choices: [
      {
        id: "write_three_and_let_go",
        label: "Zapisać trzy rzeczy i odpuścić resztę na dziś",
        spoonsCost: 1,
        trustChange: 0,
        frustrationChange: -2,
        resultText: "Nie robisz porządku w życiu. Robisz mały spis zakładników."
      },
      {
        id: "try_to_remember_everything",
        label: "Próbować zapamiętać wszystko",
        spoonsCost: 2,
        trustChange: 0,
        frustrationChange: 2,
        resultText: "Pamięć obiecuje współpracę. Pamięć jest znana z optymizmu."
      },
      {
        id: "ask_partner_to_help_choose",
        label: "Poprosić {partnerName}, żeby pomógł/pomogła ci wybrać jedno",
        spoonsCost: 1,
        trustChange: 2,
        frustrationChange: -1,
        resultText: "To nie jest oddanie kontroli. To poproszenie o latarkę."
      }
    ]
  },
  {
    id: "work_fake_flexibility",
    title: "Elastyczność, która zgina ciebie",
    tags: ["work", "boundaries", "obligation"],
    weightTags: ["work-pressure", "overextension", "tension"],
    agendaSlots: ["obligation"],
    description:
      "W pracy pada słowo „elastycznie”. Z jakiegoś powodu zawsze oznacza ono, że to ty masz zmienić kształt.",
    choices: [
      {
        id: "clarify_availability_boundary",
        label: "Doprecyzować granicę dostępności",
        spoonsCost: 1,
        trustChange: 0,
        frustrationChange: -1,
        workEffect: { pressureChange: 3, stabilityChange: 0, burnoutChange: -3 },
        resultText: "Granica brzmi mniej spektakularnie niż bunt. Za to da się przy niej oddychać."
      },
      {
        id: "agree_before_sentence_ends",
        label: "Zgodzić się, zanim ktoś dokończy zdanie",
        spoonsCost: 2,
        trustChange: -1,
        frustrationChange: 2,
        workEffect: { pressureChange: -3, stabilityChange: 1, burnoutChange: 5 },
        resultText: "Zespół docenia twoją elastyczność. Twoje ciało składa reklamację."
      },
      {
        id: "move_tension_to_evening",
        label: "Przenieść napięcie na wieczór",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 3,
        workEffect: { pressureChange: 1, stabilityChange: 0, burnoutChange: 2 },
        resultText: "W pracy spokój. W domu przychodzi faktura za tę decyzję."
      }
    ]
  },
  {
    id: "work_calendar_collision",
    title: "Kolizja w kalendarzu",
    tags: ["work", "relationship", "calendar", "obligation"],
    weightTags: ["work-pressure", "relationship-tension", "tension"],
    agendaSlots: ["obligation", "relationship"],
    description:
      "Spotkanie z pracy wpada dokładnie w miejsce, które miało być wspólnym czasem. Kalendarz nie wygląda na winnego. To podejrzane.",
    choices: [
      {
        id: "warn_partner_immediately",
        label: "Uprzedzić {partnerName} od razu",
        spoonsCost: 1,
        trustChange: 2,
        frustrationChange: -1,
        workEffect: { pressureChange: 1, stabilityChange: 0, burnoutChange: 0 },
        resultText: "Nie naprawiasz kolizji. Ale nie robisz z niej zasadzki."
      },
      {
        id: "quietly_try_to_reshuffle_everything",
        label: "Najpierw spróbować wszystko przesunąć po cichu",
        spoonsCost: 3,
        trustChange: 0,
        frustrationChange: 2,
        workEffect: { pressureChange: 2, stabilityChange: 0, burnoutChange: 4 },
        resultText: "Przez chwilę jesteś własnym działem logistyki. Potem dział składa wypowiedzenie."
      },
      {
        id: "assume_it_will_work_out",
        label: "Uznać, że jakoś to będzie",
        spoonsCost: 0,
        trustChange: -2,
        frustrationChange: 3,
        workEffect: { pressureChange: 3, stabilityChange: -1, burnoutChange: 2 },
        resultText: "„Jakoś” zaczyna układać plan bez konsultacji z tobą."
      }
    ]
  },
  {
    id: "metamour_social_overlap",
    title: "Wspólny brzeg rozmowy",
    tags: ["relationship", "metamour", "social", "communication"],
    weightTags: ["metamour-signal", "tension", "low-trust"],
    agendaSlots: ["relationship"],
    description:
      "W rozmowie pojawia się możliwość, że ty i {metamourName} będziecie w tej samej przestrzeni. Nie dramat. Bardziej małe przeciągnięcie kabla przez środek pokoju.",
    choices: [
      {
        id: "ask_how_without_performance",
        label: "Zapytać, jak zrobić to bez performansu",
        spoonsCost: 2,
        trustChange: 3,
        frustrationChange: -1,
        metamourEffect: { familiarityChange: 5, tensionChange: -4 },
        resultText: "Nie ustalacie idealnej wersji siebie. Ustalacie wersję, która może oddychać."
      },
      {
        id: "pretend_its_neutral",
        label: "Udawać, że to zupełnie neutralne",
        spoonsCost: 1,
        trustChange: 0,
        frustrationChange: 2,
        metamourEffect: { familiarityChange: 0, tensionChange: 4 },
        resultText: "Neutralność wychodzi całkiem dobrze, jeśli nikt nie patrzy na twoje ramiona."
      },
      {
        id: "turn_it_into_loyalty_test",
        label: "Zrobić z tego test lojalności",
        spoonsCost: 2,
        trustChange: -3,
        frustrationChange: 5,
        metamourEffect: { familiarityChange: 0, tensionChange: 8 },
        resultText: "Test ma pytania, których nikt nie zgodził się pisać."
      }
    ]
  },
  {
    id: "metamour_information_echo",
    title: "Informacja z drugiej ręki",
    tags: ["relationship", "metamour", "boundaries", "communication"],
    weightTags: ["metamour-signal", "repair", "tension"],
    agendaSlots: ["relationship"],
    description:
      "Dowiadujesz się czegoś o {metamourName} nie wprost, tylko bocznym wejściem. Sama informacja jest mała. Droga, którą przyszła, już mniej.",
    choices: [
      {
        id: "talk_about_channel_not_blame",
        label: "Porozmawiać o kanale informacji, nie o winie",
        spoonsCost: 2,
        trustChange: 3,
        frustrationChange: -2,
        metamourEffect: { familiarityChange: 3, tensionChange: -5 },
        resultText: "Rozmowa zostaje przy mapie, zamiast szukać winnego kierowcy."
      },
      {
        id: "ask_for_details_unsure_why",
        label: "Zapytać o szczegóły, chociaż nie wiesz po co",
        spoonsCost: 2,
        trustChange: -1,
        frustrationChange: 2,
        metamourEffect: { familiarityChange: 5, tensionChange: 3 },
        resultText: "Więcej danych nie zawsze robi więcej bezpieczeństwa. Czasem tylko ostrzejszy obraz."
      },
      {
        id: "cut_the_topic_immediately",
        label: "Uciąć temat natychmiast",
        spoonsCost: 0,
        trustChange: -1,
        frustrationChange: 1,
        metamourEffect: { familiarityChange: -2, tensionChange: 3 },
        resultText: "Temat się kończy. Echo jeszcze chwilę chodzi po ścianach."
      }
    ]
  }
  // CLEAN v0.31 content expansion events END

];

// v0.37 romance interest event START
eventPool.push({
  id: "outside_attention_message",
  title: "KTOŚ PISZE W INNYM TONIE",
  tags: ["relationship", "inner", "romance", "tension"],
  weightTags: ["relationship", "tension", "avoidance"],
  agendaSlots: ["relationship", "inner"],
  description:
    "Na ekranie telefonu pojawia się wiadomość od osoby, z którą rozmowy ostatnio robią się za łatwe. Nie ma w tym jeszcze wielkiej historii. Jest za to ten mały moment, w którym wiesz, że możesz pójść w różne strony.",
  choices: [
    {
      id: "name_it_to_partner",
      label: "Powiedzieć partnerowi, że coś cię zaciekawiło",
      spoonsCost: 2,
      trustChange: 1,
      frustrationChange: 1,
      resultText:
        "Mówisz to bez fajerwerków i bez teatralnej spowiedzi. Sama fascynacja nie znika, ale przestaje być rzeczą, którą trzeba chować pod językiem.",
      romanceAction: {
        type: "disclosure",
        disclosed: true,
        askedFirst: true,
        attractionChange: 1,
        secrecyChange: -2,
        targetName: "Ktoś nowy",
        noteKind: "open"
      }
    },
    {
      id: "reply_in_secret",
      label: "Odpisać i zostawić to dla siebie",
      spoonsCost: 1,
      trustChange: -1,
      frustrationChange: 2,
      resultText:
        "Odpisujesz lekko, prawie niewinnie. Właśnie dlatego tak łatwo schować ten gest pod zwykłym dniem.",
      romanceAction: {
        type: "flirt",
        disclosed: false,
        askedFirst: false,
        attractionChange: 2,
        secrecyChange: 2,
        targetName: "Ktoś nowy",
        noteKind: "secret"
      }
    },
    {
      id: "do_not_reply_today",
      label: "Nie odpowiadać dzisiaj",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Odkładasz telefon ekranem do dołu. To pomaga na kilka godzin. Nie rozwiązuje pytania, dlaczego serce zdążyło już zrobić krok.",
      romanceAction: {
        type: "flirt",
        disclosed: false,
        askedFirst: false,
        attractionChange: 1,
        secrecyChange: 1,
        targetName: "Ktoś nowy",
        noteKind: "postponed"
      }
    }
  ]
});
// v0.37 romance interest event END

// v0.39 relationship agreement event START
eventPool.push({
  id: "relationship_agreement_conversation",
  title: "CZY MY NADAL WIEMY, NA CO SIĘ UMAWIAMY?",
  tags: ["relationship", "agreement", "tension", "repair"],
  weightTags: ["relationship", "tension", "repair"],
  agendaSlots: ["relationship"],
  description:
    "Temat zasad wraca nie jako wielka deklaracja, tylko jako drobne napięcie pod zwykłą rozmową. Niby wiadomo, kim dla siebie jesteście. A jednak część rzeczy od dawna działa bardziej jak domysł niż ustalenie.",
  choices: [
    {
      id: "name_agreements_plainly",
      label: "Nazwać zasady bez robienia z tego procesu",
      spoonsCost: 2,
      trustChange: 1,
      frustrationChange: 1,
      resultText:
        "Mówisz prosto, bez sądu i bez wielkiej przemowy. Nie wszystko robi się łatwe, ale przynajmniej część zasad przestaje mieszkać wyłącznie w domysłach.",
      agreementAction: {
        clarityChange: 18,
        noteKind: "clarified"
      }
    },
    {
      id: "ask_if_model_still_fits",
      label: "Zapytać, czy obecny układ nadal wam pasuje",
      spoonsCost: 3,
      trustChange: 2,
      frustrationChange: 2,
      resultText:
        "To pytanie nie daje natychmiastowej odpowiedzi. Daje za to miejsce, w którym odpowiedź może się kiedyś pojawić bez udawania, że wszystko jest oczywiste.",
      agreementAction: {
        clarityChange: 10,
        noteKind: "renegotiated"
      }
    },
    {
      id: "avoid_agreement_talk",
      label: "Nie ruszać tego dzisiaj",
      spoonsCost: 0,
      trustChange: -1,
      frustrationChange: 2,
      resultText:
        "Temat zostaje tam, gdzie był: pod spodem. Przez chwilę jest ciszej. To nie to samo, co spokojniej.",
      agreementAction: {
        clarityChange: -12,
        noteKind: "avoided"
      }
    }
  ]
});
// v0.39 relationship agreement event END

// CLEAN v0.46 work obligation variety events START
eventPool.push({
  id: "overdue_email_weight",
  title: "Mały mail, który waży za dużo",
  tags: ["obligation", "avoidance"],
  weightTags: ["obligation", "avoidance"],
  agendaSlots: ["obligation"],
  minDay: 3,
  description:
    "Ten mail czeka od czterech dni. Nie jest ważny. Jest tylko tym rodzajem małej rzeczy, która zajmuje więcej miejsca w głowie niż na ekranie.",
  choices: [
    {
      id: "answer_email_now",
      label: "Odpowiedzieć teraz, choć krótko",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -2,
      resultText: "Mail zniknął z listy. Głowa zrobiła się o jeden punkt lżejsza."
    },
    {
      id: "archive_without_answering",
      label: "Zarchiwizować bez odpowiedzi",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Znika z widoku. Nie znika z listy rzeczy, które kiedyś wrócą."
    },
    {
      id: "answer_email_overthinking",
      label: "Odpisać, ale przeredagować to zdanie osiem razy",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 2,
      resultText: "Mail wyszedł idealny. Koszt idealności był wyższy niż samego maila."
    }
  ]
});

eventPool.push({
  id: "family_favor_request",
  title: "Prośba, która brzmi jak drobiazg",
  tags: ["obligation", "family"],
  weightTags: ["obligation", "low-spoons"],
  agendaSlots: ["obligation"],
  minDay: 4,
  description:
    "Ktoś z rodziny prosi o przysługę. Brzmi jak nic wielkiego. Nigdy nie jest niczym wielkim, dopóki nie zsumujesz wszystkich razem.",
  choices: [
    {
      id: "help_with_clear_limit",
      label: "Pomóc, ale nazwać, ile czasu na to masz",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 0,
      boundaryNote: "named-limit",
      resultText: "Pomoc miała granicę. Granica została usłyszana, nie tylko wypowiedziana."
    },
    {
      id: "help_without_limit",
      label: "Pomóc bez stawiania warunków",
      spoonsCost: 4,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Przysługa się wydłużyła, jak zawsze. Nikt tego nie zaplanował. Nikt też nie zatrzymał."
    },
    {
      id: "decline_this_time",
      label: "Odmówić tym razem",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      resultText: "Odmowa nie została dobrze przyjęta. Nie została też źle przyjęta na tyle, żeby to cofnąć."
    }
  ]
});

eventPool.push({
  id: "avoided_formality",
  title: "Formalność, która czeka w szufladzie",
  tags: ["obligation", "avoidance"],
  weightTags: ["obligation", "avoidance"],
  agendaSlots: ["obligation"],
  minDay: 5,
  description:
    "Ten dokument/formularz/telefon do urzędu czeka już jakiś czas. Nie jest trudny. Jest tylko dokładnie tego rodzaju nudny, który łatwo odkładać w nieskończoność.",
  choices: [
    {
      id: "handle_formality_today",
      label: "Załatwić to dziś, całościowo",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: -1,
      resultText: "Zajęło mniej czasu, niż się bałeś/aś. Tak zwykle bywa z rzeczami, które się odkłada."
    },
    {
      id: "handle_partial_formality",
      label: "Zrobić tylko pierwszy krok",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 0,
      resultText: "Nie skończone. Ale zaczęte. Czasem to jedyna dostępna dziś wersja postępu."
    },
    {
      id: "postpone_formality_again",
      label: "Odłożyć jeszcze raz",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Szuflada trzyma się dobrze. Termin robi się coraz bliższy."
    }
  ]
});

eventPool.push({
  id: "domestic_chaos_pile",
  title: "Dom, który przestał udawać porządek",
  tags: ["obligation", "domestic"],
  weightTags: ["obligation", "low-spoons"],
  agendaSlots: ["obligation"],
  minDay: 2,
  description:
    "Naczynia, pranie, papiery na stole — nic z tego osobno nie jest problemem. Razem tworzą coś, co trudno już nazwać bałaganem, bo to już bardziej stan stały.",
  choices: [
    {
      id: "tackle_one_visible_pile",
      label: "Ogarnąć jedną, najbardziej widoczną rzecz",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      resultText: "Reszta dalej tam jest. Ale ten jeden kąt znowu wygląda jak Twój."
    },
    {
      id: "ignore_and_close_door",
      label: "Zamknąć drzwi do pokoju i nie patrzeć",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Nie widać, więc chwilowo nie istnieje. Chwilowo."
    },
    {
      id: "deep_clean_everything",
      label: "Ogarnąć wszystko naraz, do końca",
      spoonsCost: 4,
      trustChange: 0,
      frustrationChange: -2,
      resultText: "Dom wygląda inaczej. Ty też — bardziej zmęczony/a niż zadowolony/a."
    }
  ]
});

eventPool.push({
  id: "document_preparation_ahead",
  title: "Dokument, który musi powstać z niczego",
  tags: ["obligation", "work"],
  weightTags: ["obligation", "work-pressure"],
  agendaSlots: ["obligation"],
  minDay: 6,
  description:
    "Pusta strona i termin, który jeszcze nie naciska, ale już o sobie przypomina. Najtrudniejsza część nie jest trudna technicznie. Jest trudna, bo trzeba zacząć.",
  choices: [
    {
      id: "draft_rough_version",
      label: "Napisać brzydki szkic, byle zacząć",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      workEffect: { pressureChange: -1, stabilityChange: 1, burnoutChange: 0 },
      resultText: "Szkic jest brzydki. Ale pusta strona przestała być pusta."
    },
    {
      id: "perfect_first_paragraph",
      label: "Dopracować idealnie tylko pierwszy akapit",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 1,
      workEffect: { pressureChange: 0, stabilityChange: 0, burnoutChange: 1 },
      resultText: "Pierwszy akapit jest bez zarzutu. Reszta dokumentu nadal nie istnieje."
    },
    {
      id: "postpone_document_start",
      label: "Zostawić to na jutro, z czystą głową",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      workEffect: { pressureChange: 2, stabilityChange: 0, burnoutChange: 0 },
      resultText: "Jutro ma teraz jeden dokument więcej niż wczoraj miało dzisiaj."
    }
  ]
});

eventPool.push({
  id: "small_breakdown_interrupts",
  title: "Drobna awaria, która nie pytała o zgodę",
  tags: ["obligation", "disruption"],
  weightTags: ["obligation", "low-spoons"],
  agendaSlots: ["obligation"],
  minDay: 3,
  description:
    "Coś się zepsuło — nic dramatycznego, ale wystarczająco, żeby zjeść resztę dnia, którą miałeś/aś w planie na coś innego.",
  choices: [
    {
      id: "fix_it_yourself_now",
      label: "Zająć się tym samemu/samej, teraz",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 0,
      resultText: "Naprawione. Plan na dziś — mniej więcej też, tylko przesunięty."
    },
    {
      id: "call_for_help_with_it",
      label: "Poprosić kogoś o pomoc, zamiast robić to sam/a",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Pomoc przyszła. Poczucie, że powinieneś/aś dać radę sam/a, przyszło razem z nią."
    },
    {
      id: "leave_broken_for_now",
      label: "Zostawić zepsute na teraz",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      resultText: "Zepsute zostaje zepsute. Dzień zostaje Twój — trochę bardziej poszarpany."
    }
  ]
});

eventPool.push({
  id: "overdue_phone_call",
  title: "Telefon, który trzeba w końcu wykonać",
  tags: ["obligation", "avoidance"],
  weightTags: ["obligation", "avoidance"],
  agendaSlots: ["obligation"],
  minDay: 4,
  description:
    "Ten telefon jest odkładany od tygodnia. Nie jest to trudna rozmowa. Jest to rozmowa, którą łatwiej nie zacząć niż skończyć.",
  choices: [
    {
      id: "make_the_call_directly",
      label: "Zadzwonić wprost, bez przygotowywania scenariusza",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      resultText: "Rozmowa trwała cztery minuty. Odkładanie trwało tydzień."
    },
    {
      id: "text_instead_of_call",
      label: "Napisać wiadomość zamiast dzwonić",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 0,
      resultText: "Sprawa załatwiona. Nie tak, jak powinna być, ale załatwiona."
    },
    {
      id: "postpone_the_call_again",
      label: "Odłożyć telefon na jutro. Znowu",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Jutro brzmi jak plan. Wczoraj też tak brzmiało."
    }
  ]
});

eventPool.push({
  id: "weekly_recurring_task",
  title: "To, co wraca w każdym tygodniu",
  tags: ["obligation", "routine"],
  weightTags: ["obligation"],
  agendaSlots: ["obligation"],
  minDay: 7,
  description:
    "Nie jest to nic pilnego. Jest to coś, co po prostu wraca, tydzień po tygodniu, niezależnie od tego, jak minął poprzedni.",
  choices: [
    {
      id: "do_it_on_autopilot",
      label: "Zrobić to na autopilocie, bez zastanowienia",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 0,
      resultText: "Zrobione. Rytuał nie potrzebował dziś Twojej pełnej uwagi, żeby zadziałać."
    },
    {
      id: "question_if_still_needed",
      label: "Zapytać siebie, czy to nadal jest potrzebne",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      resultText: "Część rytuałów przetrwała, bo są ważne. Część — bo nikt ich nie zakwestionował."
    },
    {
      id: "skip_it_this_week",
      label: "Odpuścić w tym tygodniu",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Świat się nie zawalił. Wróci w przyszłym tygodniu i tak."
    }
  ]
});

eventPool.push({
  id: "recovering_from_overload",
  title: "Dzień po dniu, który kosztował za dużo",
  tags: ["obligation", "recovery"],
  weightTags: ["obligation", "low-spoons"],
  agendaSlots: ["obligation"],
  minDay: 5,
  description:
    "Wczoraj było za dużo. Dziś ciało i głowa domagają się rachunku — a lista obowiązków nie wie, że wczoraj był zły dzień.",
  choices: [
    {
      id: "clear_only_urgent_item",
      label: "Zrobić tylko to jedno, co naprawdę nie może czekać",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      resultText: "Reszta listy poczeka. Ta jedna rzecz przestała wisieć nad głową."
    },
    {
      id: "push_through_full_list",
      label: "Przejść przez całą listę mimo wszystko",
      spoonsCost: 4,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Lista jest pusta. Rachunek za wczoraj i dziś przyjdzie razem, w jednym terminie."
    },
    {
      id: "clear_nothing_today",
      label: "Nie ruszać dziś niczego z listy",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 0,
      resultText: "Lista nie stała się krótsza. Ty stałeś/aś się choć trochę bardziej wypoczęty/a."
    }
  ]
});

eventPool.push({
  id: "rest_versus_life_admin",
  title: "Odpoczynek kontra ogarnięcie życia",
  tags: ["obligation", "rest"],
  weightTags: ["obligation"],
  agendaSlots: ["obligation"],
  minDay: 6,
  description:
    "Masz wolne popołudnie. Lista spraw do ogarnięcia też o tym wie i patrzy wymownie. Obie strony mają rację co do tego, że są ważne.",
  choices: [
    {
      id: "protect_the_rest_fully",
      label: "Bronić odpoczynku bez wyjątków",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 0,
      resultText: "Popołudnie zostało Twoje. Lista spraw poczekała — trochę głośniej niż wczoraj."
    },
    {
      id: "split_time_between_both",
      label: "Podzielić czas na pół",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 0,
      resultText: "Ani odpoczynek, ani lista nie dostały pełnej uwagi. Obie dostały trochę."
    },
    {
      id: "sacrifice_rest_for_admin",
      label: "Poświęcić odpoczynek na rzecz obowiązków",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 1,
      resultText: "Lista jest krótsza. Popołudnie, które miało być Twoje, nie było."
    }
  ]
});

eventPool.push({
  id: "critical_prep_choice",
  title: "Coś większego czeka w kalendarzu",
  tags: ["obligation", "preparation"],
  weightTags: ["obligation", "critical-event-approaching"],
  agendaSlots: ["obligation"],
  minDay: 8,
  description:
    "Nie dziś. Ale wystarczająco blisko, żeby dawało się to poczuć. Jedna godzina przygotowań teraz mogłaby oszczędzić kilka później — kosztem czegoś innego dziś.",
  choices: [
    {
      id: "prepare_one_fragment_now",
      label: "Przygotować teraz jeden fragment",
      spoonsCost: 3,
      trustChange: -1,
      frustrationChange: 0,
      workEffect: { pressureChange: -2, stabilityChange: 1, burnoutChange: 0 },
      resultText: "Jeden fragment gotowy. Wieczór, który miał być dla kogoś innego, poszedł gdzie indziej."
    },
    {
      id: "leave_evening_for_partner",
      label: "Zostawić wieczór dla {partnerName}",
      spoonsCost: 1,
      trustChange: 2,
      frustrationChange: 0,
      workEffect: { pressureChange: 1, stabilityChange: 0, burnoutChange: 0 },
      resultText: "Wieczór był dla kogoś. Kalendarz zapamiętał, że dziś go nie dotknąłeś/aś."
    },
    {
      id: "pretend_calendar_doesnt_exist",
      label: "Udawać, że kalendarz nie istnieje",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      workEffect: { pressureChange: 3, stabilityChange: -1, burnoutChange: 1 },
      resultText: "Kalendarz nie zniknął od tego, że na niego nie patrzysz. Tylko stał się cichszy."
    }
  ]
});

eventPool.push({
  id: "obligation_masking_at_work",
  title: "Twarz, którą trzeba nosić do biura",
  tags: ["obligation", "masking", "work"],
  weightTags: ["obligation", "work-pressure"],
  agendaSlots: ["obligation"],
  minDay: 5,
  description:
    "Dzień w pracy wymaga wersji Ciebie, która wygląda na ogarniętą. Ta wersja jest przydatna. Nie jest za darmo.",
  choices: [
    {
      id: "show_up_honest_today",
      label: "Pokazać się dziś bez pełnej maski",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 1,
      workEffect: { pressureChange: 1, stabilityChange: -1, burnoutChange: -1 },
      resultText: "Nikt nie zareagował dramatycznie. To, że się dało, samo w sobie było informacją."
    },
    {
      id: "wear_the_functional_mask",
      label: "Założyć wersję, która dobrze funkcjonuje",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 0,
      workEffect: { pressureChange: 0, stabilityChange: 1, burnoutChange: 2 },
      resultText: "Dzień przeszedł gładko. Gładkość miała swoją cenę, zapisaną gdzie indziej."
    },
    {
      id: "cancel_plans_stay_home",
      label: "Odwołać dzień, zostać w domu",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 0,
      workEffect: { pressureChange: 2, stabilityChange: -2, burnoutChange: -1 },
      resultText: "Dzień w pracy nie odbył się. Praca zauważy — jutro, nie dziś."
    }
  ]
});
// CLEAN v0.46 work obligation variety events END

// v0.54 Month One Content Expansion & Anti-Repetition Pass START
// +34 nowych eventów (prefiks "v054_") w konwencji eventPool.push()
// z v0.46. Rozszerzają kategorie: relacja codzienna, praca,
// obowiązki/admin, maskowanie, ciało, sieć relacji (metamour),
// odpoczynek/samotność, dziwność/humor. Zero nowych pól efektów —
// wyłącznie spoonsCost/trustChange/frustrationChange/resultText +
// istniejące metamourEffect/workEffect tam, gdzie tematycznie
// pasują. agendaSlots ograniczone do realnych trzech slotów
// (obligation/relationship/inner) — finezja kategorii żyje w
// "tags", tak jak w reszcie puli.

eventPool.push({
  id: "v054_relationship_different_pace",
  title: "Różne tempo",
  tags: ["relationship", "communication"],
  weightTags: ["tension"],
  agendaSlots: ["relationship"],
  description:
    "{partnerName} chce dogadać coś w pięć minut. Ty potrzebujesz najpierw pomyśleć, a potem dopiero mówić. " +
    "Żadne z tych tempo nie jest złe. Tylko dziś muszą się jakoś spotkać.",
  choices: [
    {
      id: "ask_for_pause",
      label: "Prosisz o chwilę ciszy, zanim odpowiesz",
      spoonsCost: 1,
      trustChange: 3,
      frustrationChange: -1,
      resultText:
        "{partnerName} czeka, trochę niecierpliwie. Kiedy w końcu mówisz, brzmi to jak Ty, a nie jak pośpiech."
    },
    {
      id: "match_their_speed",
      label: "Dopasowujesz się do ich tempa",
      spoonsCost: 2,
      trustChange: 2,
      frustrationChange: 1,
      resultText:
        "Rozmowa idzie szybciej, niż byś chciał/a. Odpowiadasz zanim zdążysz to poczuć naprawdę."
    },
    {
      id: "name_the_mismatch",
      label: "Mówisz wprost, że macie różne tempo",
      spoonsCost: 1,
      trustChange: 4,
      frustrationChange: 0,
      resultText:
        "{partnerName} milknie na sekundę, potem kiwa głową. To nie rozwiązuje niczego dziś, ale nazywa coś prawdziwego."
    }
  ]
});

eventPool.push({
  id: "v054_relationship_unspoken_expectation",
  title: "Niewypowiedziane oczekiwanie",
  tags: ["relationship", "communication", "boundaries"],
  weightTags: ["low-trust", "tension"],
  agendaSlots: ["relationship"],
  description:
    "Czujesz, że {partnerName} czegoś od Ciebie oczekuje dziś wieczorem. Nikt tego nie powiedział na głos. " +
    "Może się mylisz. Może nie.",
  choices: [
    {
      id: "ask_outright",
      label: "Pytasz wprost, czego się spodziewa",
      spoonsCost: 1,
      trustChange: 4,
      frustrationChange: -2,
      resultText:
        "{partnerName} wygląda na zaskoczonego/ą pytaniem, ale odpowiada szczerze. Domysł znika, zostaje fakt."
    },
    {
      id: "guess_and_deliver",
      label: "Zgadujesz i próbujesz to dać, nic nie mówiąc",
      spoonsCost: 3,
      trustChange: 1,
      frustrationChange: 2,
      resultText:
        "Trafiasz w połowie. {partnerName} jest wdzięczny/a, ale Ty zostajesz z uczuciem, że graliście w zgadywankę."
    },
    {
      id: "let_it_stay_unspoken",
      label: "Zostawiasz to niewypowiedziane",
      spoonsCost: 0,
      trustChange: -3,
      frustrationChange: 4,
      resultText:
        "Wieczór mija bez incydentu. Ale coś w powietrzu zostaje nieodhaczone, jak lista, której nikt nie widzi."
    }
  ]
});

eventPool.push({
  id: "v054_relationship_quiet_closeness",
  title: "Bliskość bez programu",
  tags: ["relationship", "self-care"],
  weightTags: ["high-trust"],
  agendaSlots: ["relationship", "inner"],
  description:
    "Nie ma kryzysu. Nie ma tematu do przegadania. {partnerName} jest po prostu obok, a Ty masz wybór, " +
    "co zrobić z tą zwyczajną chwilą.",
  choices: [
    {
      id: "stay_present",
      label: "Zostajesz w tym bez robienia niczego więcej",
      spoonsCost: 1,
      trustChange: 3,
      frustrationChange: -3,
      resultText:
        "Nic się nie wydarza. To właśnie jest w tym dobre. {partnerName} zasypia trochę wcześniej, spokojny/a."
    },
    {
      id: "fill_it_with_plans",
      label: "Wypełniasz ciszę planowaniem czegoś przyszłego",
      spoonsCost: 2,
      trustChange: 1,
      frustrationChange: 0,
      resultText:
        "Rozmawiacie o tym, co będzie za miesiąc. Miła rozmowa. Ale ta konkretna chwila gdzieś Wam uciekła."
    },
    {
      id: "retreat_to_own_head",
      label: "Wycofujesz się myślami, mimo że siedzicie razem",
      spoonsCost: 0,
      trustChange: -1,
      frustrationChange: 1,
      resultText:
        "{partnerName} nic nie mówi, ale zauważa, że jesteś gdzieś indziej. Bliskość zostaje na papierze."
    }
  ]
});

eventPool.push({
  id: "v054_relationship_small_negotiation",
  title: "Drobna negocjacja",
  tags: ["relationship", "boundaries", "spoons"],
  weightTags: ["low-spoons"],
  agendaSlots: ["relationship"],
  description:
    "{partnerName} proponuje coś zupełnie zwyczajnego — wspólne gotowanie, spacer, drobiazg. " +
    "Zwyczajna rzecz, która dziś kosztuje więcej, niż powinna.",
  choices: [
    {
      id: "counter_propose",
      label: "Proponujesz coś mniejszego w zamian",
      spoonsCost: 1,
      trustChange: 2,
      frustrationChange: 0,
      resultText:
        "{partnerName} zgadza się bez dramatu. Negocjacja trwała trzy zdania i nikt nic nie stracił."
    },
    {
      id: "agree_and_pay_for_it",
      label: "Zgadzasz się na oryginalny plan",
      spoonsCost: 3,
      trustChange: 3,
      frustrationChange: -1,
      resultText:
        "Jest miło. Jest też wyraźnie drożej, niż wyglądało to na papierze."
    },
    {
      id: "decline_flatly",
      label: "Mówisz po prostu nie, bez negocjacji",
      spoonsCost: 0,
      trustChange: -2,
      frustrationChange: 3,
      resultText:
        "{partnerName} przyjmuje odmowę, ale plan zostaje odwołany bez żadnej alternatywy na stole."
    }
  ]
});

eventPool.push({
  id: "v054_relationship_joke_landed_wrong",
  title: "Żart, który nie wylądował",
  tags: ["relationship", "communication"],
  weightTags: ["tension"],
  agendaSlots: ["relationship"],
  description:
    "Rzuciłeś/aś żart, który miał rozładować napięcie. Zamiast tego {partnerName} spoważniał/a. " +
    "Cisza trwa o sekundę za długo.",
  choices: [
    {
      id: "explain_the_intent",
      label: "Tłumaczysz, o co Ci chodziło",
      spoonsCost: 1,
      trustChange: 2,
      frustrationChange: -1,
      resultText:
        "{partnerName} rozumie intencję, choć żart dalej nie był śmieszny. Napięcie opada o jeden stopień."
    },
    {
      id: "double_down",
      label: "Brniesz dalej w ten sam ton",
      spoonsCost: 0,
      trustChange: -3,
      frustrationChange: 4,
      resultText:
        "Drugi żart trafia jeszcze gorzej niż pierwszy. {partnerName} odwraca wzrok."
    },
    {
      id: "just_apologize",
      label: "Po prostu przepraszasz, bez tłumaczenia",
      spoonsCost: 1,
      trustChange: 3,
      frustrationChange: -2,
      resultText:
        "Krótkie \"przepraszam, nie tak to miało zabrzmieć\" robi więcej niż długie wyjaśnienie."
    }
  ]
});

eventPool.push({
  id: "v054_relationship_leftover_silence",
  title: "Wczorajsza cisza jeszcze tu jest",
  tags: ["relationship", "communication", "tension"],
  weightTags: ["low-trust", "tension"],
  agendaSlots: ["relationship"],
  description:
    "Wczorajsza niedokończona rozmowa z {partnerName} nie zniknęła, tylko przycupnęła gdzieś w kącie kuchni. " +
    "Dziś rano jest wciąż tam, gdzie ją zostawiliście.",
  choices: [
    {
      id: "pick_it_back_up",
      label: "Wracasz do tematu z własnej inicjatywy",
      spoonsCost: 2,
      trustChange: 4,
      frustrationChange: -2,
      resultText:
        "Nie kończycie tego dziś do końca, ale przynajmniej temat przestaje leżeć w kącie bez opieki."
    },
    {
      id: "wait_for_them",
      label: "Czekasz, aż {partnerName} wróci do tego pierwszy/a",
      spoonsCost: 0,
      trustChange: -1,
      frustrationChange: 2,
      resultText:
        "Nikt nie wraca do tematu. Kuchnia jest zwyczajna, tylko trochę cichsza niż zwykle."
    },
    {
      id: "name_that_you_are_avoiding",
      label: "Mówisz wprost, że wolisz to dziś przemilczeć",
      spoonsCost: 1,
      trustChange: 1,
      frustrationChange: 0,
      resultText:
        "{partnerName} przyjmuje to zaskakująco spokojnie. Uczciwe unikanie to wciąż uczciwość."
    }
  ]
});

eventPool.push({
  id: "v054_work_unsendable_email",
  title: "Mail, którego nie da się napisać",
  tags: ["work", "obligation"],
  weightTags: ["work-pressure", "obligation"],
  agendaSlots: ["obligation"],
  description:
    "Kursor miga w pustym mailu od czterdziestu minut. Treść jest prosta. Nic w Tobie nie chce jej dziś napisać.",
  choices: [
    {
      id: "force_three_sentences",
      label: "Wyciskasz z siebie trzy krótkie zdania i wysyłasz",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      workEffect: { pressureChange: -6, stabilityChange: 1, burnoutChange: 2 },
      resultText:
        "Mail wychodzi, suchy i wystarczający. Nikt nie zauważy, ile kosztowały te trzy zdania."
    },
    {
      id: "postpone_to_tomorrow",
      label: "Odkładasz to na jutro",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      workEffect: { pressureChange: 4, stabilityChange: -1, burnoutChange: 0 },
      resultText:
        "Kursor przestaje migać, kiedy zamykasz laptopa. Mail czeka teraz na jutrzejszą wersję Ciebie."
    },
    {
      id: "delegate_or_shorten_scope",
      label: "Piszesz krótką prośbę o pomoc zamiast pełnej odpowiedzi",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 0,
      workEffect: { pressureChange: -2, stabilityChange: 0, burnoutChange: -1 },
      resultText:
        "To nie jest odpowiedź, jakiej oczekiwano. Ale ktoś inny przejmuje część ciężaru."
    }
  ]
});

eventPool.push({
  id: "v054_work_meeting_eats_day",
  title: "Spotkanie, które zjadło dzień",
  tags: ["work", "obligation", "time"],
  weightTags: ["work-pressure", "burnout"],
  agendaSlots: ["obligation"],
  description:
    "Spotkanie miało trwać pół godziny. Trwało dwie. Reszta planów na dziś przesunęła się cicho w bok.",
  choices: [
    {
      id: "salvage_one_task",
      label: "Ratujesz z dnia jedno najważniejsze zadanie",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      workEffect: { pressureChange: -3, stabilityChange: 1, burnoutChange: 1 },
      resultText:
        "Reszta dnia i tak jest stracona, ale ta jedna rzecz jest zrobiona. To coś."
    },
    {
      id: "let_the_day_go",
      label: "Odpuszczasz resztę dnia całkowicie",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      workEffect: { pressureChange: 2, stabilityChange: 0, burnoutChange: -2 },
      resultText:
        "Lista zadań zostaje nietknięta. Twoja głowa jest odrobinę cichsza niż była godzinę temu."
    },
    {
      id: "cram_everything_late",
      label: "Próbujesz wcisnąć wszystko wieczorem",
      spoonsCost: 3,
      trustChange: -1,
      frustrationChange: 3,
      workEffect: { pressureChange: -8, stabilityChange: -2, burnoutChange: 5 },
      resultText:
        "Lista jest odhaczona. Wieczór, który miał być Twój, już nie istnieje."
    }
  ]
});

eventPool.push({
  id: "v054_work_micro_tasks_pileup",
  title: "Trzynaście małych rzeczy",
  tags: ["work", "obligation"],
  weightTags: ["obligation", "low-spoons"],
  agendaSlots: ["obligation"],
  description:
    "Żadne z tych zadań nie jest trudne z osobna. Razem tworzą ścianę, przez którą trzeba dziś jakoś przejść.",
  choices: [
    {
      id: "batch_three_easiest",
      label: "Robisz trzy najłatwiejsze i zostawiasz resztę",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      workEffect: { pressureChange: -2, stabilityChange: 0, burnoutChange: 0 },
      resultText:
        "Ściana jest wciąż tam, ale trochę cieńsza. Wystarczy na dziś."
    },
    {
      id: "power_through_all",
      label: "Przechodzisz przez wszystkie po kolei",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 1,
      workEffect: { pressureChange: -7, stabilityChange: 1, burnoutChange: 3 },
      resultText:
        "Lista jest pusta. Ty jesteś pusty/a razem z nią."
    },
    {
      id: "ignore_the_list_today",
      label: "Zamykasz listę i nie otwierasz jej dziś więcej",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      workEffect: { pressureChange: 3, stabilityChange: -1, burnoutChange: -1 },
      resultText:
        "Trzynaście rzeczy czeka na jutro. Jutro będzie ich prawdopodobnie więcej."
    }
  ]
});

eventPool.push({
  id: "v054_work_competence_vs_capacity",
  title: "Umiesz to zrobić. Pytanie, czy dasz radę",
  tags: ["work", "boundaries"],
  weightTags: ["work-pressure", "high-frustration"],
  agendaSlots: ["obligation"],
  description:
    "Zadanie trafia do Ciebie, bo jesteś w tym dobry/a. Nikt nie pyta, czy masz dziś na to miejsce.",
  choices: [
    {
      id: "take_it_competently",
      label: "Bierzesz zadanie, bo umiesz i tak jest łatwiej",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 2,
      workEffect: { pressureChange: -4, stabilityChange: 2, burnoutChange: 3 },
      resultText:
        "Robisz to dobrze, jak zawsze. Nikt się nie dowie, ile to dziś kosztowało."
    },
    {
      id: "flag_the_capacity_gap",
      label: "Mówisz, że umiesz, ale dziś nie masz na to zasobów",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      workEffect: { pressureChange: 1, stabilityChange: -1, burnoutChange: -2 },
      resultText:
        "Cisza po tym zdaniu jest niezręczna. Ale zadanie trafia do kogoś innego albo czeka."
    },
    {
      id: "do_it_badly_on_purpose",
      label: "Robisz zadanie połowicznie, celowo",
      spoonsCost: 1,
      trustChange: -2,
      frustrationChange: 1,
      workEffect: { pressureChange: -1, stabilityChange: -2, burnoutChange: 0 },
      resultText:
        "To nie jest strategia, którą byłbyś/byłabyś z siebie dumny/a. Ale kompetencja ma dziś limit."
    }
  ]
});

eventPool.push({
  id: "v054_work_refuse_being_reliable_one",
  title: "Odmowa bycia tym ogarniętym",
  tags: ["work", "boundaries", "masking"],
  weightTags: ["work-pressure", "burnout"],
  agendaSlots: ["obligation"],
  description:
    "Zespół znów patrzy w Twoją stronę, kiedy trzeba kogoś, kto \"to ogarnie\". Jesteś zmęczony/a bycia tą osobą.",
  choices: [
    {
      id: "say_not_today",
      label: "Mówisz wprost, że dziś nie jesteś tą osobą",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      workEffect: { pressureChange: 2, stabilityChange: -2, burnoutChange: -3 },
      resultText:
        "Krótka cisza, potem ktoś inny bierze sprawę. Reputacja \"ogarniętej osoby\" pęka odrobinę."
    },
    {
      id: "accept_the_role_again",
      label: "Znowu to bierzesz, jak zawsze",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 3,
      workEffect: { pressureChange: -5, stabilityChange: 3, burnoutChange: 4 },
      resultText:
        "Wszystko idzie sprawnie. Rola \"tej ogarniętej\" trzyma się mocniej niż kiedykolwiek."
    },
    {
      id: "make_a_joke_and_dodge",
      label: "Żartem odwracasz uwagę i wymykasz się bez odmowy wprost",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 1,
      workEffect: { pressureChange: 0, stabilityChange: 0, burnoutChange: 1 },
      resultText:
        "Nikt nie zauważa, że nic nie obiecałeś/aś. Ty wiesz, ile energii zajęło to udawanie lekkości."
    }
  ]
});

eventPool.push({
  id: "v054_admin_one_form_too_many",
  title: "Jeden formularz za dużo",
  tags: ["obligation", "admin"],
  weightTags: ["obligation", "low-spoons"],
  agendaSlots: ["obligation"],
  description:
    "Formularz jest krótki. Instrukcja jego wypełnienia jest długa. Urząd nie interesuje się Twoją pojemnością na dziś.",
  choices: [
    {
      id: "fill_it_now",
      label: "Wypełniasz go teraz, do końca",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -2,
      resultText:
        "Formularz jest gotowy. Zostaje po nim to specyficzne zmęczenie, którego nie widać na zewnątrz."
    },
    {
      id: "fill_half_and_stop",
      label: "Wypełniasz połowę i zostawiasz resztę",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Formularz leży na wpół gotowy. Jutro będzie trzeba przypomnieć sobie, gdzie się skończyło."
    },
    {
      id: "ask_someone_to_help",
      label: "Prosisz kogoś o pomoc z formularzem",
      spoonsCost: 1,
      trustChange: 1,
      frustrationChange: -1,
      resultText:
        "Formularz jest gotowy szybciej, niż myślałeś/aś. Proszenie o pomoc nie było tak trudne, jak się bałeś/aś."
    }
  ]
});

eventPool.push({
  id: "v054_admin_laundry_mountain",
  title: "Góra prania",
  tags: ["obligation", "admin", "chaos"],
  weightTags: ["low-spoons"],
  agendaSlots: ["obligation"],
  description:
    "Góra prania rośnie w kącie pokoju od kilku dni. Nie jest niebezpieczna. Jest tylko coraz bardziej widoczna.",
  choices: [
    {
      id: "do_one_load",
      label: "Robisz jedno pranie, nie całą górę",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Góra jest wciąż górą, tylko odrobinę niższą. To wystarczy, żeby przestać na nią patrzeć z niechęcią."
    },
    {
      id: "tackle_it_all",
      label: "Bierzesz się za wszystko naraz",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: -3,
      resultText:
        "Pokój wygląda inaczej. Ty wyglądasz jak ktoś, kto właśnie wygrał wojnę z tekstyliami."
    },
    {
      id: "close_the_door_on_it",
      label: "Zamykasz drzwi do pokoju i nie patrzysz",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Góra prania czeka za zamkniętymi drzwiami. Poza zasięgiem wzroku, w pełni w zasięgu myśli."
    }
  ]
});

eventPool.push({
  id: "v054_admin_grocery_decision_fatigue",
  title: "Zmęczenie decyzyjne w sklepie",
  tags: ["obligation", "admin", "spoons"],
  weightTags: ["low-spoons"],
  agendaSlots: ["obligation"],
  description:
    "Stoisz przed półką z pieczywem. To nie powinna być trudna decyzja. Dziś każda decyzja jest trudna.",
  choices: [
    {
      id: "grab_the_usual",
      label: "Bierzesz to samo co zawsze, bez myślenia",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Ten sam chleb co zawsze. Nuda ma dziś wartość — jedna decyzja mniej do podjęcia."
    },
    {
      id: "compare_everything",
      label: "Porównujesz wszystkie opcje dokładnie",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Wychodzisz z najlepszym możliwym chlebem i pustką w głowie, która nie była tego warta."
    },
    {
      id: "leave_without_deciding",
      label: "Wychodzisz ze sklepu bez pieczywa",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Lista zakupów zostaje nieodhaczona w jednym punkcie. Jutro będzie inny dzień na chleb."
    }
  ]
});

eventPool.push({
  id: "v054_admin_unpaid_bill_reminder",
  title: "Przypomnienie o rachunku",
  tags: ["obligation", "admin"],
  weightTags: ["obligation", "high-frustration"],
  agendaSlots: ["obligation"],
  description:
    "Powiadomienie o zaległym rachunku wisi na ekranie od trzech dni. Kwota nie jest duża. Samo powiadomienie już jest ciężarem.",
  choices: [
    {
      id: "pay_it_now",
      label: "Płacisz od razu, żeby zniknęło z ekranu",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -3,
      resultText:
        "Powiadomienie znika. Ulga jest nieproporcjonalna do wielkości sprawy, ale prawdziwa."
    },
    {
      id: "snooze_the_notification",
      label: "Odkładasz powiadomienie na później",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Ekran jest czystszy przez chwilę. Rachunek wróci, dokładnie tam, gdzie był."
    },
    {
      id: "set_autopay_to_stop_thinking",
      label: "Ustawiasz automatyczną płatność, żeby nigdy więcej o tym nie myśleć",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -2,
      resultText:
        "To kosztuje więcej uwagi teraz, ale ten konkretny rodzaj ciężaru znika z Twojej głowy na dobre."
    }
  ]
});

eventPool.push({
  id: "v054_admin_invisible_backlog",
  title: "Zaległości, których nikt nie widzi",
  tags: ["obligation", "admin", "inner"],
  weightTags: ["obligation", "burnout"],
  agendaSlots: ["obligation", "inner"],
  description:
    "Z zewnątrz wszystko wygląda w porządku. Tylko Ty wiesz, ile drobnych spraw czeka w kolejce, o której nikt nie pyta.",
  choices: [
    {
      id: "write_the_full_list",
      label: "Spisujesz całą listę zaległości, żeby ją zobaczyć",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Lista jest dłuższa, niż myślałeś/aś. Przynajmniej teraz jest widoczna, a nie tylko poczuwalna."
    },
    {
      id: "pick_one_and_close_it",
      label: "Wybierasz jedną zaległą sprawę i kończysz ją do końca",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -2,
      resultText:
        "Jedna sprawa mniej. Reszta kolejki nie zauważa różnicy, ale Ty tak."
    },
    {
      id: "keep_carrying_silently",
      label: "Nadal nosisz to w głowie, nic nie zapisując",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Kolejka zostaje niewidzialna dla wszystkich, łącznie z Tobą w te dni, kiedy udaje Ci się o niej zapomnieć."
    }
  ]
});

eventPool.push({
  id: "v054_masking_laugh_too_loud",
  title: "Śmiech trochę za głośny",
  tags: ["masking", "social", "inner"],
  weightTags: ["high-masking-debt"],
  agendaSlots: ["inner"],
  description:
    "Śmiejesz się z żartu głośniej, niż było trzeba. To zadziałało — nikt nic nie podejrzewa. " +
    "Ty wiesz dokładnie, ile to kosztowało.",
  choices: [
    {
      id: "let_the_performance_stand",
      label: "Zostawiasz to tak, jak wyszło, nie tłumacząc się",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Nikt nic nie zauważył. To właśnie jest cichy koszt trzymania formy — jest niewidoczny dla innych."
    },
    {
      id: "quietly_step_away",
      label: "Wymykasz się na chwilę, żeby złapać oddech",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Pięć minut w innym pokoju. Wystarczy, żeby wrócić z twarzą, która nie musi już nic udawać tak mocno."
    },
    {
      id: "admit_it_to_one_person",
      label: "Mówisz jednej zaufanej osobie, że dziś udajesz",
      spoonsCost: 2,
      trustChange: 3,
      frustrationChange: -2,
      resultText:
        "To krótkie zdanie zdejmuje coś, czego nie wiedziałeś/aś, że niesiesz. Nie wszystko trzeba grać do końca."
    }
  ]
});

eventPool.push({
  id: "v054_masking_fake_availability",
  title: "Udawana dostępność",
  tags: ["masking", "relationship", "boundaries"],
  weightTags: ["high-masking-debt", "avoidance"],
  agendaSlots: ["inner", "relationship"],
  description:
    "{partnerName} pyta, czy masz dziś czas i głowę na rozmowę. Odpowiedź \"tak\" wychodzi z Ciebie zanim zdążysz to sprawdzić naprawdę.",
  choices: [
    {
      id: "correct_yourself",
      label: "Poprawiasz się od razu, mówiąc prawdę",
      spoonsCost: 1,
      trustChange: 3,
      frustrationChange: -1,
      resultText:
        "\"Właściwie, chyba nie dam rady tak, jak bym chciał/a\" — {partnerName} przyjmuje to bez pretensji."
    },
    {
      id: "power_through_the_lie",
      label: "Trzymasz się \"tak\" i próbujesz jakoś dać radę",
      spoonsCost: 3,
      trustChange: 1,
      frustrationChange: 2,
      resultText:
        "Rozmowa się odbywa. Jesteś w niej obecny/a tylko połowicznie, i {partnerName} to gdzieś czuje."
    },
    {
      id: "cancel_with_excuse",
      label: "Wycofujesz się, wymyślając inny powód",
      spoonsCost: 0,
      trustChange: -2,
      frustrationChange: 1,
      resultText:
        "Rozmowa nie dochodzi do skutku. Prawdziwy powód zostaje ukryty pod fałszywym."
    }
  ]
});

eventPool.push({
  id: "v054_masking_smile_receipt",
  title: "Rachunek za zbyt dużo uśmiechu",
  tags: ["masking", "inner", "spoons"],
  weightTags: ["high-masking-debt", "low-spoons"],
  agendaSlots: ["inner"],
  description:
    "Wieczorem czujesz rachunek za cały dzień uśmiechania się na pokaz. Nikt Ci go nie wystawił. Sam/a go czujesz.",
  choices: [
    {
      id: "cancel_evening_plans",
      label: "Odwołujesz wszystko, co jeszcze było zaplanowane na wieczór",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: -2,
      resultText:
        "Wieczór staje się pusty w dobrym sensie. Rachunek nie znika, ale przestaje rosnąć."
    },
    {
      id: "push_through_evening_too",
      label: "Kontynuujesz w tym samym trybie do końca dnia",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Dzień kończy się gładko na zewnątrz. Rachunek rośnie o kolejną pozycję."
    },
    {
      id: "name_it_in_your_head",
      label: "Nazywasz to po cichu, tylko dla siebie",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "\"To był dzień trzymania formy\" — samo nazwanie tego nie płaci rachunku, ale trochę go uwidacznia."
    }
  ]
});

eventPool.push({
  id: "v054_masking_authenticity_vs_smoothness",
  title: "Autentyczność kontra płynność",
  tags: ["masking", "honesty", "social"],
  weightTags: ["high-masking-debt", "tension"],
  agendaSlots: ["inner", "relationship"],
  description:
    "Możesz powiedzieć, co naprawdę myślisz, i zaburzyć płynność rozmowy. Albo powiedzieć coś gładkiego i zostawić prawdę na później.",
  choices: [
    {
      id: "say_the_real_thing",
      label: "Mówisz to, co naprawdę myślisz",
      spoonsCost: 2,
      trustChange: 4,
      frustrationChange: 1,
      resultText:
        "Rozmowa robi się niezręczna na chwilę. Jest też bardziej prawdziwa, niż była minutę wcześniej."
    },
    {
      id: "say_the_smooth_thing",
      label: "Mówisz coś gładkiego, co utrzyma rozmowę na powierzchni",
      spoonsCost: 0,
      trustChange: -1,
      frustrationChange: -1,
      resultText:
        "Rozmowa płynie dalej bez zgrzytu. Prawda zostaje na później, które może nie nadejść."
    },
    {
      id: "split_the_difference",
      label: "Mówisz część prawdy, łagodząc resztę",
      spoonsCost: 1,
      trustChange: 2,
      frustrationChange: 0,
      resultText:
        "To nie jest cała prawda. Ale to więcej niż nic, i mniej niż to, co kosztowałoby Cię więcej."
    }
  ]
});

eventPool.push({
  id: "v054_body_shower_as_boss",
  title: "Prysznic jako boss finałowy",
  tags: ["body", "self-care", "spoons"],
  weightTags: ["high-fatigue", "low-spoons"],
  agendaSlots: ["inner"],
  description:
    "Prysznic wymaga dziś więcej niż zwykle: rozebrania się, decyzji o wodzie, stania pod nią, wytarcia się. " +
    "Każdy krok osobno jest mały. Razem tworzą przeciwnika.",
  choices: [
    {
      id: "do_the_full_shower",
      label: "Przechodzisz przez cały rytuał do końca",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -2,
      resultText:
        "Boss finałowy pokonany. Czujesz się lepiej niż przed, i trochę bardziej zmęczony/a niż przed."
    },
    {
      id: "quick_partial_version",
      label: "Robisz skróconą, częściową wersję",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Nie idealnie, ale wystarczająco. Czasem połowa rytuału to cały dostępny dziś rytuał."
    },
    {
      id: "skip_it_today",
      label: "Odpuszczasz dzisiaj całkowicie",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Jutro to zrobisz. Albo pojutrze. Boss czeka cierpliwie, nie idzie nigdzie."
    }
  ]
});

eventPool.push({
  id: "v054_body_sleepless_math",
  title: "Matematyka bezsenności",
  tags: ["body", "spoons"],
  weightTags: ["high-fatigue"],
  agendaSlots: ["inner"],
  description:
    "Liczysz w głowie, ile godzin snu Ci zostało, gdybyś zasnął/ęła w tej sekundzie. Liczba jest coraz mniejsza i coraz mniej pomaga.",
  choices: [
    {
      id: "get_up_and_do_something_calm",
      label: "Wstajesz i robisz coś spokojnego zamiast leżeć",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Nie śpisz więcej, ale przestajesz walczyć z łóżkiem. To osobny rodzaj odpoczynku."
    },
    {
      id: "keep_trying_to_sleep",
      label: "Zostajesz w łóżku i próbujesz dalej",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Matematyka bezsenności trwa dalej. Liczby robią się coraz bardziej absurdalne."
    },
    {
      id: "accept_the_short_night",
      label: "Godzisz się z tym, że noc będzie krótka",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Coś w Tobie przestaje walczyć. To nie sprawia, że śpisz, ale przestajesz się karać za to, że nie śpisz."
    }
  ]
});

eventPool.push({
  id: "v054_body_forgot_to_eat",
  title: "Zapomniałeś/aś zjeść",
  tags: ["body", "spoons"],
  weightTags: ["high-fatigue", "low-spoons"],
  agendaSlots: ["inner"],
  description:
    "Jest po trzeciej po południu, kiedy zdajesz sobie sprawę, że dziś jeszcze nic nie jadłeś/aś. Ciało już dawno próbowało to zgłosić.",
  choices: [
    {
      id: "make_a_real_meal",
      label: "Robisz coś, co przypomina prawdziwy posiłek",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -3,
      resultText:
        "Zajmuje to więcej energii, niż powinno. Ale różnica w tym, jak się czujesz potem, jest wyraźna."
    },
    {
      id: "eat_whatever_is_closest",
      label: "Jesz cokolwiek, co jest najbliżej ręki",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "To nie był posiłek godny pochwały. Ciało i tak przyjmuje to z ulgą."
    },
    {
      id: "keep_postponing",
      label: "Odkładasz jedzenie jeszcze trochę",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Głód zamienia się w tępe zmęczenie, które będzie teraz towarzyszyć reszcie dnia."
    }
  ]
});

eventPool.push({
  id: "v054_body_sensory_static_morning",
  title: "Sensoryczny szum poranka",
  tags: ["body", "static", "inner"],
  weightTags: ["high-fatigue"],
  agendaSlots: ["inner"],
  description:
    "Metka koszulki drapie. Lodówka brzęczy głośniej niż zwykle. Światło jest o jeden odcień za jasne. Nic z tego osobno nie powinno przeszkadzać.",
  choices: [
    {
      id: "remove_one_irritant",
      label: "Eliminujesz jeden konkretny drażniący czynnik",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -2,
      resultText:
        "Koszulka na lewą stronę albo zdjęta metka — mała rzecz, a szum w głowie wyraźnie cichnie."
    },
    {
      id: "push_through_the_noise",
      label: "Ignorujesz to i idziesz dalej z dniem",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Dzień toczy się dalej. Szum w tle też, cichy, ale niezmiennie obecny."
    },
    {
      id: "give_yourself_a_quiet_minute",
      label: "Dajesz sobie minutę w ciszy, zanim ruszysz dalej",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Minuta w ciszy nie naprawia wszystkiego. Ale reszta świata wraca odrobinę łagodniej."
    }
  ]
});

eventPool.push({
  id: "v054_metamour_kind_message",
  title: "Miła wiadomość od metamour",
  tags: ["metamour", "communication"],
  weightTags: ["metamour-signal"],
  agendaSlots: ["relationship"],
  description:
    "Metamour pisze coś zwyczajnie miłego — bez ukrytej agendy, bez porównywania. Zaskakująco trudno to po prostu przyjąć.",
  choices: [
    {
      id: "reply_warmly",
      label: "Odpisujesz ciepło, bez dystansu",
      spoonsCost: 1,
      trustChange: 2,
      frustrationChange: -2,
      metamourEffect: { familiarityChange: 5, tensionChange: -3 },
      resultText:
        "Krótka wymiana wiadomości robi się nieoczekiwanie przyjemna. Metamour to naprawdę tylko osoba."
    },
    {
      id: "reply_politely_distant",
      label: "Odpisujesz uprzejmie, ale z dystansem",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 0,
      metamourEffect: { familiarityChange: 1, tensionChange: 0 },
      resultText:
        "Wymiana jest poprawna. Ciepło wiadomości gdzieś po drodze się rozmywa."
    },
    {
      id: "overthink_the_message",
      label: "Analizujesz wiadomość pod kątem ukrytych znaczeń",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 2,
      metamourEffect: { familiarityChange: 0, tensionChange: 2 },
      resultText:
        "Nie znajdujesz nic podejrzanego, bo nic tam nie było. Analiza i tak zajęła swoje."
    }
  ]
});

eventPool.push({
  id: "v054_metamour_calendar_math",
  title: "Matematyka kalendarzy",
  tags: ["metamour", "calendar", "obligation"],
  weightTags: ["metamour-signal", "obligation"],
  agendaSlots: ["relationship"],
  description:
    "Trzy kalendarze — Twój, {partnerName} i metamour — próbują się dziś jakoś zsynchronizować. Logistyka poliamorii bez dramatu, tylko z Excelem.",
  choices: [
    {
      id: "propose_a_slot_directly",
      label: "Proponujesz konkretny termin od razu",
      spoonsCost: 1,
      trustChange: 2,
      frustrationChange: -1,
      metamourEffect: { familiarityChange: 2, tensionChange: -1 },
      resultText:
        "Termin pasuje wszystkim po drobnej korekcie. Logistyka rozwiązuje się szybciej niż niepokój przed nią."
    },
    {
      id: "let_partner_coordinate",
      label: "Zostawiasz koordynację {partnerName}",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      metamourEffect: { familiarityChange: 0, tensionChange: 1 },
      resultText:
        "Coś się w końcu ustala, bez Twojego udziału. Wygodne i lekko wyalienowujące naraz."
    },
    {
      id: "overcomplicate_with_conditions",
      label: "Dodajesz kilka dodatkowych warunków do terminu",
      spoonsCost: 2,
      trustChange: -1,
      frustrationChange: 2,
      metamourEffect: { familiarityChange: -1, tensionChange: 3 },
      resultText:
        "Prosty termin zamienia się w negocjację. Nikt nie jest zadowolony z efektu."
    }
  ]
});

eventPool.push({
  id: "v054_metamour_comparison_spiral",
  title: "Spirala porównań",
  tags: ["metamour", "inner"],
  weightTags: ["metamour-signal", "low-trust"],
  agendaSlots: ["relationship", "inner"],
  description:
    "Zaczynasz porównywać się z metamour — kto jest zabawniejszy, kto potrzebuje mniej, kto \"lepiej\" to wszystko ogarnia. Spirala nie ma dobrego dna.",
  choices: [
    {
      id: "interrupt_the_spiral",
      label: "Świadomie przerywasz porównywanie",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -2,
      metamourEffect: { familiarityChange: 0, tensionChange: -2 },
      resultText:
        "Nie jest to łatwe, ale udaje się zatrzymać spiralę, zanim zjedzie za daleko."
    },
    {
      id: "ride_it_out_privately",
      label: "Pozwalasz sobie na to porównywanie w milczeniu",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 3,
      metamourEffect: { familiarityChange: 0, tensionChange: 1 },
      resultText:
        "Spirala kręci się dalej, zamknięta w Twojej głowie. Nikt inny o niej nie wie."
    },
    {
      id: "voice_it_to_partner",
      label: "Mówisz {partnerName} o tym porównywaniu",
      spoonsCost: 2,
      trustChange: 3,
      frustrationChange: -1,
      metamourEffect: { familiarityChange: 0, tensionChange: 0 },
      resultText:
        "{partnerName} nie ma magicznej odpowiedzi, ale samo powiedzenie tego na głos rozładowuje część napięcia."
    }
  ]
});

eventPool.push({
  id: "v054_metamour_tenderness_and_jealousy",
  title: "Czułość i zazdrość w jednym pokoju",
  tags: ["metamour", "relationship", "inner"],
  weightTags: ["metamour-signal", "tension"],
  agendaSlots: ["relationship"],
  description:
    "Widzisz {partnerName} i metamour razem, czuli wobec siebie. Czujesz jednocześnie ciepło i coś ostrzejszego. Oba uczucia są prawdziwe naraz.",
  choices: [
    {
      id: "sit_with_both_feelings",
      label: "Zostajesz z obydwoma uczuciami, nie wybierając jednego",
      spoonsCost: 2,
      trustChange: 2,
      frustrationChange: 0,
      metamourEffect: { familiarityChange: 1, tensionChange: -1 },
      resultText:
        "Nie musisz wybierać między czułością a zazdrością. Obie mieszczą się w Tobie naraz, niewygodnie, ale prawdziwie."
    },
    {
      id: "leave_the_room",
      label: "Wychodzisz z pokoju na chwilę",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 1,
      metamourEffect: { familiarityChange: 0, tensionChange: 1 },
      resultText:
        "Nikt nic nie mówi o Twoim wyjściu. Uczucia zostają z Tobą, tylko w innym pokoju."
    },
    {
      id: "perform_being_fine",
      label: "Zostajesz i udajesz, że wszystko jest w porządku",
      spoonsCost: 1,
      trustChange: -1,
      frustrationChange: 2,
      metamourEffect: { familiarityChange: 1, tensionChange: 0 },
      resultText:
        "Twarz mówi \"wszystko gra\". Reszta Ciebie prowadzi zupełnie inną rozmowę."
    }
  ]
});

eventPool.push({
  id: "v054_recovery_not_every_silence_is_failure",
  title: "Nie każda cisza to porażka",
  tags: ["recovery", "self-care", "inner"],
  weightTags: ["low-spoons"],
  agendaSlots: ["inner"],
  description:
    "Nikt się dziś nie odezwał. Żadnych wiadomości, żadnych planów. Część Ciebie chce to nazwać porażką towarzyską.",
  choices: [
    {
      id: "name_it_as_rest",
      label: "Nazywasz ten dzień odpoczynkiem, nie porażką",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -3,
      resultText:
        "To małe przesunięcie w języku zmienia, jak czujesz resztę wieczoru. Cisza staje się wyborem, nie brakiem."
    },
    {
      id: "reach_out_anxiously",
      label: "Piszesz do kogoś, żeby przerwać ciszę",
      spoonsCost: 2,
      trustChange: 1,
      frustrationChange: 0,
      resultText:
        "Ktoś odpisuje miło. Ulga jest realna, choć wynika trochę z niepokoju, a nie z chęci kontaktu."
    },
    {
      id: "sit_with_the_discomfort",
      label: "Siedzisz z tym niewygodnym uczuciem, nic nie robiąc",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Niewygodne uczucie nie znika od razu. Ale nie robi się też większe od ignorowania go."
    }
  ]
});

eventPool.push({
  id: "v054_recovery_choosing_rest",
  title: "Odpoczynek jako wybór",
  tags: ["recovery", "self-care"],
  weightTags: ["low-spoons"],
  agendaSlots: ["inner"],
  description:
    "Masz dziś trochę wolnego czasu. Możesz go czymś wypełnić. Albo naprawdę nic nie robić — co brzmi podejrzanie prosto jak na coś tak trudnego.",
  choices: [
    {
      id: "do_genuinely_nothing",
      label: "Robisz naprawdę nic, celowo",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: -3,
      resultText:
        "Pierwsze dziesięć minut czujesz się winny/a. Potem cisza zaczyna działać tak, jak powinna."
    },
    {
      id: "fill_it_with_productive_rest",
      label: "Wypełniasz czas czymś \"produktywnie relaksującym\"",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "To miłe zajęcie. Nie jest jednak tym samym co odpoczynek bez celu do osiągnięcia."
    },
    {
      id: "use_it_to_catch_up_on_tasks",
      label: "Wykorzystujesz ten czas, żeby nadrobić zaległości",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "Lista zadań jest krótsza. Wolny czas zniknął razem z nią, niezauważony."
    }
  ]
});

eventPool.push({
  id: "v054_recovery_not_now_as_decision",
  title: "\"Nie teraz\" jako decyzja",
  tags: ["recovery", "boundaries", "inner"],
  weightTags: ["low-spoons", "avoidance"],
  agendaSlots: ["inner"],
  description:
    "Ktoś prosi Cię o coś zupełnie rozsądnego. Rozsądna prośba, zły moment. \"Nie teraz\" wisi na końcu języka.",
  choices: [
    {
      id: "say_not_now_clearly",
      label: "Mówisz \"nie teraz\" jasno, bez tłumaczenia się nadmiernie",
      spoonsCost: 1,
      trustChange: 1,
      frustrationChange: -2,
      resultText:
        "Krótkie zdanie, bez usprawiedliwień. Zaskakująco mało boli, kiedy się je wreszcie wypowie."
    },
    {
      id: "say_yes_and_regret_it",
      label: "Mówisz \"tak\", chociaż wiesz, że to zły moment",
      spoonsCost: 2,
      trustChange: 1,
      frustrationChange: 2,
      resultText:
        "Robisz to, o co proszono. Żal, że się zgodziłeś/aś, przychodzi szybciej niż satysfakcja."
    },
    {
      id: "overexplain_the_no",
      label: "Odmawiasz, ale z długim tłumaczeniem dlaczego",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: 0,
      resultText:
        "Odmowa dociera, opakowana w pięć zdań usprawiedliwień, których nikt nie potrzebował."
    }
  ]
});

eventPool.push({
  id: "v054_chaos_bureaucracy_absurd",
  title: "Formularz, który wymaga innego formularza",
  tags: ["admin", "obligation", "chaos"],
  weightTags: ["obligation"],
  agendaSlots: ["obligation"],
  description:
    "Urząd żąda dokumentu, który można uzyskać wyłącznie po złożeniu tego dokumentu, o który właśnie prosisz. Kafkowska pętla, tylko z gorszą kawą.",
  choices: [
    {
      id: "call_and_ask_directly",
      label: "Dzwonisz i pytasz wprost, jak to w ogóle ma działać",
      spoonsCost: 2,
      trustChange: 0,
      frustrationChange: -1,
      resultText:
        "Osoba po drugiej stronie śmieje się nerwowo i przyznaje, że to rzeczywiście nie ma sensu. Znajdujecie obejście."
    },
    {
      id: "laugh_at_the_absurdity",
      label: "Śmiejesz się z absurdu i odkładasz sprawę",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: 0,
      resultText:
        "Pętla zostaje nierozwiązana, ale przynajmniej rozśmieszyła Cię, zanim zdążyła zirytować."
    },
    {
      id: "try_to_beat_the_system",
      label: "Próbujesz na siłę obejść system po swojemu",
      spoonsCost: 3,
      trustChange: 0,
      frustrationChange: 3,
      resultText:
        "System wygrywa. System zawsze wygrywa. Zostajesz z pętlą i mniejszą ilością energii."
    }
  ]
});

eventPool.push({
  id: "v054_chaos_narrator_distance",
  title: "Ktoś jakby to komentuje",
  tags: ["inner", "chaos"],
  weightTags: ["tension"],
  agendaSlots: ["inner"],
  description:
    "Przez chwilę obserwujesz swój dzień z dziwnego dystansu, jakby ktoś inny go komentował z boku. \"A teraz bohater/ka otwiera lodówkę po raz trzeci.\"",
  choices: [
    {
      id: "lean_into_the_narration",
      label: "Wchodzisz w ten dystans i traktujesz go z humorem",
      spoonsCost: 0,
      trustChange: 0,
      frustrationChange: -2,
      resultText:
        "\"Bohater/ka zamyka lodówkę, tym razem z niczym w ręku.\" Dystans okazuje się zaskakująco kojący."
    },
    {
      id: "shake_it_off",
      label: "Otrząsasz się z tego uczucia i wracasz do siebie",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 0,
      resultText:
        "Dystans znika równie szybko, jak się pojawił. Zostajesz z sobą, w pełni, bez komentatora."
    },
    {
      id: "worry_about_the_distance",
      label: "Martwisz się, co ten dystans oznacza",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 2,
      resultText:
        "Analiza własnego dystansu tworzy kolejną warstwę dystansu. Lodówka nadal jest pusta."
    }
  ]
});

eventPool.push({
  id: "v054_chaos_smart_stumble",
  title: "Inteligentne potknięcie",
  tags: ["relationship", "chaos", "communication"],
  weightTags: ["tension"],
  agendaSlots: ["relationship"],
  description:
    "Próbujesz powiedzieć coś mądrego i uważnego do {partnerName}. Zdanie wychodzi w połowie do przodu, w połowie do tyłu, i ląduje gdzieś zupełnie obok.",
  choices: [
    {
      id: "own_the_stumble",
      label: "Przyznajesz się do potknięcia i próbujesz jeszcze raz",
      spoonsCost: 1,
      trustChange: 2,
      frustrationChange: -1,
      resultText:
        "Druga próba wychodzi lepiej. {partnerName} śmieje się z pierwszej, ale w dobry sposób."
    },
    {
      id: "pretend_it_was_intentional",
      label: "Udajesz, że tak miało być",
      spoonsCost: 1,
      trustChange: 0,
      frustrationChange: 1,
      resultText:
        "{partnerName} patrzy z powątpiewaniem, ale nie drąży tematu. Zdanie zostaje, dziwne i niewyjaśnione."
    },
    {
      id: "abandon_the_sentence",
      label: "Porzucasz zdanie w połowie i zmieniasz temat",
      spoonsCost: 0,
      trustChange: -1,
      frustrationChange: 1,
      resultText:
        "Cokolwiek chciałeś/aś powiedzieć, zostaje niewypowiedziane. Rozmowa płynie dalej, jakby nic się nie stało."
    }
  ]
});
// v0.54 Month One Content Expansion & Anti-Repetition Pass END
