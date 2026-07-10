# apply_hotfix_v0_8_2_persistent_spoons_and_morning_events.py
#
# Hotfix v0.8.2 for Out of Spoons.
#
# Problem:
# v0.8 made choices depend on current spoons, but the day loop still made
# spoons feel like they reset. This patch changes the loop:
#
# - current spoons carry over between days,
# - next morning starts from whatever was left after the previous day,
# - then random morning events modify that number,
# - every morning gets:
#   1. one global event,
#   2. one kind partner action.
#
# This makes "Dostepne spoons: X/Y" actually matter.
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_hotfix_v0_8_2_persistent_spoons_and_morning_events.py

from pathlib import Path
import re
import sys

ROOT = Path.cwd()

def require(rel):
    path = ROOT / rel
    if not path.exists():
        print(f"BLAD: nie znaleziono {rel}")
        print("Uruchom skrypt z folderu C:\\OutOfSpoons.")
        sys.exit(1)
    return path

def write(rel, text):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

def replace_function(text, function_name, replacement):
    marker = f"export function {function_name}("
    start = text.find(marker)
    if start == -1:
        print(f"BLAD: nie znaleziono funkcji {function_name}().")
        sys.exit(1)

    brace_start = text.find("{", start)
    if brace_start == -1:
        print(f"BLAD: nie znaleziono otwarcia funkcji {function_name}().")
        sys.exit(1)

    depth = 0
    end = None
    for i in range(brace_start, len(text)):
        char = text[i]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    if end is None:
        print(f"BLAD: nie znaleziono konca funkcji {function_name}().")
        sys.exit(1)

    return text[:start] + replacement + text[end:]


# ---------------------------------------------------------------------------
# 1. Data: global morning events + kind partner actions
# ---------------------------------------------------------------------------

morning_event_data = r'''// morningEventData.js
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
'''

write(Path("js/data/morningEventData.js"), morning_event_data)


# ---------------------------------------------------------------------------
# 2. System: resolve morning events and apply effects
# ---------------------------------------------------------------------------

morning_event_system = r'''// morningEventSystem.js
//
// Hotfix v0.8.2.
// Morning events make spoons persistent and alive:
//
// previous day leftover spoons
// + global morning event
// + kind partner action
// = current spoons for the new day

import { globalMorningEvents, partnerKindnessEvents } from "../data/morningEventData.js";

export function ensureMorningEventState(state) {
  if (!state.morningEventHistory) {
    state.morningEventHistory = {
      lastGlobalId: null,
      lastPartnerKindnessId: null
    };
  }

  if (!state.todayMorningEvents) {
    state.todayMorningEvents = {
      day: state.day,
      events: [],
      spoonsBefore: state.resources.spoons.current,
      spoonsAfter: state.resources.spoons.current,
      netSpoonsChange: 0
    };
  }

  return state.morningEventHistory;
}

export function resolveMorningEvents(state) {
  ensureMorningEventState(state);

  const spoonsBefore = state.resources.spoons.current;
  const events = [];

  const globalEvent = pickWithoutImmediateRepeat(
    globalMorningEvents,
    state.morningEventHistory.lastGlobalId
  );

  if (globalEvent) {
    events.push(applyMorningEvent(state, globalEvent));
    state.morningEventHistory.lastGlobalId = globalEvent.id;
  }

  if (state.partner) {
    const partnerEvent = pickWithoutImmediateRepeat(
      partnerKindnessEvents,
      state.morningEventHistory.lastPartnerKindnessId
    );

    if (partnerEvent) {
      events.push(applyMorningEvent(state, partnerEvent));
      state.morningEventHistory.lastPartnerKindnessId = partnerEvent.id;
    }
  }

  const spoonsAfter = state.resources.spoons.current;

  state.todayMorningEvents = {
    day: state.day,
    events,
    spoonsBefore,
    spoonsAfter,
    netSpoonsChange: spoonsAfter - spoonsBefore
  };

  return state.todayMorningEvents;
}

function applyMorningEvent(state, event) {
  const resolved = {
    id: event.id,
    type: event.type,
    title: replacePlaceholders(event.title, state),
    description: replacePlaceholders(event.description, state),
    spoonsChange: Number(event.spoonsChange) || 0,
    trustChange: Number(event.trustChange) || 0,
    frustrationChange: Number(event.frustrationChange) || 0
  };

  const actualSpoonsChange = applySpoonsChange(state, resolved.spoonsChange);
  resolved.actualSpoonsChange = actualSpoonsChange;

  if (resolved.type === "partner-kindness") {
    applyPartnerRelationshipChange(state, resolved.trustChange, resolved.frustrationChange);
  }

  return resolved;
}

function applySpoonsChange(state, delta) {
  const spoons = state.resources.spoons;
  const before = spoons.current;
  const max = spoons.max;

  spoons.current = clamp(before + delta, 0, max);

  return spoons.current - before;
}

function applyPartnerRelationshipChange(state, trustChange, frustrationChange) {
  if (!state.partner || !state.npcs) {
    return;
  }

  const npc = state.npcs[state.partner.id];
  if (!npc) {
    return;
  }

  if (typeof npc.trust === "number") {
    npc.trust = clamp(npc.trust + trustChange, 0, 100);
  }

  if (typeof npc.frustration === "number") {
    npc.frustration = clamp(npc.frustration + frustrationChange, 0, 100);
  }
}

function pickWithoutImmediateRepeat(items, previousId) {
  if (!items || items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return items[0];
  }

  const candidates = items.filter((item) => item.id !== previousId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function replacePlaceholders(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}
'''

write(Path("js/systems/morningEventSystem.js"), morning_event_system)


# ---------------------------------------------------------------------------
# 3. Patch dayCycle.js: no daily reset, resolve morning events on next day
# ---------------------------------------------------------------------------

day_cycle_path = require(Path("js/systems/dayCycle.js"))
day_cycle = day_cycle_path.read_text(encoding="utf-8")

if "morningEventSystem.js" not in day_cycle:
    # Add import after the last import line.
    import_lines = list(re.finditer(r'^import .+;\s*$', day_cycle, flags=re.MULTILINE))
    if import_lines:
        insert_at = import_lines[-1].end()
        day_cycle = (
            day_cycle[:insert_at]
            + '\nimport { ensureMorningEventState, resolveMorningEvents } from "./morningEventSystem.js";'
            + day_cycle[insert_at:]
        )
    else:
        day_cycle = 'import { ensureMorningEventState, resolveMorningEvents } from "./morningEventSystem.js";\n' + day_cycle

# Ensure new game has morning event fields but do not force day-1 modifiers.
if "morningEventHistory" not in day_cycle:
    # Add after state object is created if possible.
    day_cycle = day_cycle.replace(
        "  setState(state);",
        '  state.morningEventHistory = { lastGlobalId: null, lastPartnerKindnessId: null };\n'
        '  state.todayMorningEvents = {\n'
        '    day: state.day,\n'
        '    events: [],\n'
        '    spoonsBefore: state.resources.spoons.current,\n'
        '    spoonsAfter: state.resources.spoons.current,\n'
        '    netSpoonsChange: 0\n'
        '  };\n\n'
        '  setState(state);',
        1
    )

advance_replacement = r'''export function advanceToNextDay() {
  const state = getState();

  // v0.8.2:
  // Spoons are persistent. We do NOT reset them to max here.
  // The new morning starts with whatever was left after the previous day,
  // then global and partner morning events modify that number.
  state.day += 1;
  state.phase = "morning";
  state.currentEventId = null;

  ensureMorningEventState(state);
  resolveMorningEvents(state);

  return state;
}'''

day_cycle = replace_function(day_cycle, "advanceToNextDay", advance_replacement)

day_cycle_path.write_text(day_cycle, encoding="utf-8", newline="\n")
print("OK -> js/systems/dayCycle.js")


# ---------------------------------------------------------------------------
# 4. Overwrite gameScreen.js cleanly: v0.8.2 display morning events
# ---------------------------------------------------------------------------

game_screen = r'''// gameScreen.js
//
// Morning screen.
// Shows persistent spoons, morning events, player status, partner card,
// relationship bars and relationship mood.

import { showScreen } from "../uiManager.js";
import { getState } from "../../state/gameState.js";
import { goToEvent } from "../../systems/dayCycle.js";
import { buildStatusSentence } from "../../systems/characterSystem.js";

export function renderGameScreen(container) {
  const state = getState();
  const playerName = state.player ? state.player.name : "Ty";

  const wrapper = document.createElement("div");
  wrapper.className = "screen game-screen";

  const marker = document.createElement("p");
  marker.className = "debug-version-marker";
  marker.textContent = "UI v0.8.2";
  wrapper.appendChild(marker);

  const header = document.createElement("h2");
  header.textContent = `Dzie\u0144 ${state.day} \u2014 ${playerName}`;
  wrapper.appendChild(header);

  wrapper.appendChild(renderSpoonsMeter(state.resources.spoons));
  wrapper.appendChild(renderPersistentSpoonsNote());

  const morningEvents = renderMorningEvents(state);
  if (morningEvents) {
    wrapper.appendChild(morningEvents);
  }

  if (state.player) {
    const statusSentence = document.createElement("p");
    statusSentence.className = "status-sentence";
    statusSentence.textContent = buildStatusSentence(state.player);
    wrapper.appendChild(statusSentence);
  }

  if (state.partner) {
    const npc = state.npcs ? state.npcs[state.partner.id] : undefined;
    wrapper.appendChild(renderPartnerCard(state.partner, npc));
  }

  const continueButton = document.createElement("button");
  continueButton.className = "primary-button";
  continueButton.textContent = "Przejd\u017a do wydarzenia dnia";
  continueButton.addEventListener("click", () => {
    goToEvent();
    showScreen("event");
  });
  wrapper.appendChild(continueButton);

  container.appendChild(wrapper);
}

function renderSpoonsMeter(spoons) {
  const meter = document.createElement("div");
  meter.className = "spoons-meter";

  const label = document.createElement("span");
  label.className = "spoons-label";
  label.textContent = `Spoons: ${spoons.current}/${spoons.max}`;
  meter.appendChild(label);

  const row = document.createElement("div");
  row.className = "spoons-row";

  for (let i = 0; i < spoons.max; i++) {
    const spoon = document.createElement("span");
    spoon.className = i < spoons.current ? "spoon full" : "spoon empty";
    row.appendChild(spoon);
  }

  meter.appendChild(row);
  return meter;
}

function renderPersistentSpoonsNote() {
  const note = document.createElement("p");
  note.className = "persistent-spoons-note";
  note.textContent = "Spoons nie odnawiają się automatycznie. To, co zostaje po dniu, przechodzi na kolejny poranek.";
  return note;
}

function renderMorningEvents(state) {
  const morning = state.todayMorningEvents;

  if (!morning || !Array.isArray(morning.events) || morning.events.length === 0) {
    return null;
  }

  if (morning.day !== state.day) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "morning-events";

  const heading = document.createElement("p");
  heading.className = "morning-events-heading";
  heading.textContent = "Poranek";
  section.appendChild(heading);

  morning.events.forEach((event) => {
    section.appendChild(renderMorningEvent(event));
  });

  if (typeof morning.netSpoonsChange === "number" && morning.netSpoonsChange !== 0) {
    const net = document.createElement("p");
    net.className = "morning-events-net";
    net.textContent = `Bilans poranka: ${formatSigned(morning.netSpoonsChange)} spoons`;
    section.appendChild(net);
  }

  return section;
}

function renderMorningEvent(event) {
  const item = document.createElement("div");
  item.className = `morning-event morning-event--${event.type}`;

  const title = document.createElement("p");
  title.className = "morning-event-title";
  title.textContent = event.title;
  item.appendChild(title);

  const description = document.createElement("p");
  description.className = "morning-event-description";
  description.textContent = event.description;
  item.appendChild(description);

  const effects = buildMorningEventEffects(event);
  if (effects.length > 0) {
    const effectLine = document.createElement("p");
    effectLine.className = "morning-event-effects";
    effectLine.textContent = effects.join(" · ");
    item.appendChild(effectLine);
  }

  return item;
}

function buildMorningEventEffects(event) {
  const effects = [];

  if (typeof event.actualSpoonsChange === "number" && event.actualSpoonsChange !== 0) {
    effects.push(`Spoons ${formatSigned(event.actualSpoonsChange)}`);
  }

  if (typeof event.trustChange === "number" && event.trustChange !== 0) {
    effects.push(`Zaufanie ${formatSigned(event.trustChange)}`);
  }

  if (typeof event.frustrationChange === "number" && event.frustrationChange !== 0) {
    effects.push(`Frustracja ${formatSigned(event.frustrationChange)}`);
  }

  return effects;
}

function renderPartnerCard(partner, npc) {
  const card = document.createElement("div");
  card.className = "partner-card";

  const name = document.createElement("p");
  name.className = "partner-name";
  name.textContent = partner.name;
  card.appendChild(name);

  const relationshipLabel = document.createElement("p");
  relationshipLabel.className = "partner-relationship-label";
  relationshipLabel.textContent = partner.relationshipLabel;
  card.appendChild(relationshipLabel);

  const summary = document.createElement("p");
  summary.className = "partner-relationship-summary";
  summary.textContent = partner.relationshipSummary;
  card.appendChild(summary);

  const communicationStyle = document.createElement("p");
  communicationStyle.className = "partner-communication-style";
  communicationStyle.textContent = `Styl komunikacji: ${partner.communicationStyle}`;
  card.appendChild(communicationStyle);

  card.appendChild(renderRelationshipState(npc));

  return card;
}

function renderRelationshipState(npc) {
  const section = document.createElement("div");
  section.className = "relationship-state";

  const heading = document.createElement("p");
  heading.className = "relationship-state-heading";
  heading.textContent = "Stan relacji";
  section.appendChild(heading);

  if (!npc) {
    const fallback = document.createElement("p");
    fallback.className = "relationship-state-empty";
    fallback.textContent = "Brak danych";
    section.appendChild(fallback);
    return section;
  }

  section.appendChild(renderRelationshipMeter("Zaufanie", npc.trust, "trust"));
  section.appendChild(renderRelationshipMeter("Frustracja", npc.frustration, "frustration"));
  section.appendChild(renderRelationshipMood(npc));

  return section;
}

function renderRelationshipMeter(label, value, modifier) {
  const safeValue = clampToPercentage(Number(value) || 0);

  const meter = document.createElement("div");
  meter.className = "relationship-meter";

  const labelEl = document.createElement("span");
  labelEl.className = "relationship-meter-label";
  labelEl.textContent = label;
  meter.appendChild(labelEl);

  const track = document.createElement("div");
  track.className = "relationship-meter-track";

  const fill = document.createElement("div");
  fill.className = `relationship-meter-fill relationship-meter-fill--${modifier}`;
  fill.style.width = `${safeValue}%`;
  track.appendChild(fill);
  meter.appendChild(track);

  const valueEl = document.createElement("span");
  valueEl.className = "relationship-meter-value";
  valueEl.textContent = `${safeValue}/100`;
  meter.appendChild(valueEl);

  return meter;
}

function renderRelationshipMood(npc) {
  const mood = buildRelationshipMood(npc);

  const moodSection = document.createElement("div");
  moodSection.className = "relationship-mood";

  const label = document.createElement("p");
  label.className = "relationship-mood-label";
  label.textContent = `Stan emocjonalny relacji: ${mood.label}`;
  moodSection.appendChild(label);

  const description = document.createElement("p");
  description.className = "relationship-mood-description";
  description.textContent = mood.description;
  moodSection.appendChild(description);

  return moodSection;
}

function buildRelationshipMood(npc) {
  const trust = clampToPercentage(Number(npc.trust) || 0);
  const frustration = clampToPercentage(Number(npc.frustration) || 0);

  if (trust >= 70 && frustration <= 25) {
    return {
      label: "Bezpiecznie",
      description: "W tej relacji jest dużo zaufania i niewiele napięcia."
    };
  }

  if (trust >= 50 && frustration <= 45) {
    return {
      label: "Stabilnie",
      description: "Relacja trzyma się dobrze, choć nadal wymaga uważności."
    };
  }

  if (frustration >= 70 && trust >= 40) {
    return {
      label: "Napięcie",
      description: "Zaufanie jeszcze istnieje, ale napięcie zaczyna dominować."
    };
  }

  if (trust < 35 && frustration >= 55) {
    return {
      label: "Krucho",
      description: "Relacja może źle znosić kolejne uniki albo niejasne sygnały."
    };
  }

  if (trust < 35) {
    return {
      label: "Niepewnie",
      description: "W relacji brakuje poczucia bezpieczeństwa."
    };
  }

  if (frustration >= 55) {
    return {
      label: "Przeciążenie",
      description: "Nagromadzone napięcie zaczyna być trudne do ignorowania."
    };
  }

  return {
    label: "Niejasno",
    description: "Relacja jest w ruchu. Jeszcze nie wiadomo, w którą stronę pójdzie."
  };
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function clampToPercentage(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
'''

write(Path("js/ui/screens/gameScreen.js"), game_screen)


# ---------------------------------------------------------------------------
# 5. CSS additions
# ---------------------------------------------------------------------------

style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

style = re.sub(
    r"/\* HOTFIX v0\.8\.2 persistent spoons and morning events \*/[\s\S]*?/\* END HOTFIX v0\.8\.2 persistent spoons and morning events \*/",
    "",
    style
)

style += r'''

/* HOTFIX v0.8.2 persistent spoons and morning events */
.persistent-spoons-note {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-style: italic;
  margin: calc(-1 * var(--space-md)) 0 var(--space-md) 0;
}

.morning-events {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin: var(--space-md) 0 var(--space-lg) 0;
}

.morning-events-heading {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.morning-event {
  border-top: 1px dotted var(--color-line);
  padding-top: var(--space-sm);
  margin-top: var(--space-sm);
}

.morning-event:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.morning-event-title {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 2px 0;
}

.morning-event-description {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin: 0;
}

.morning-event-effects {
  color: var(--color-muted);
  font-size: 0.8rem;
  font-style: italic;
  margin: 4px 0 0 0;
}

.morning-events-net {
  border-top: 1px dotted var(--color-line);
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 600;
  margin: var(--space-sm) 0 0 0;
  padding-top: var(--space-sm);
}
/* END HOTFIX v0.8.2 persistent spoons and morning events */
'''

style_path.write_text(style, encoding="utf-8", newline="\n")
print("OK -> css/style.css")


# ---------------------------------------------------------------------------
# 6. Cache bust index.html only
# ---------------------------------------------------------------------------

index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=082"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")


# ---------------------------------------------------------------------------
# 7. Verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

checks = {
    "js/data/morningEventData.js": ["globalMorningEvents", "partnerKindnessEvents"],
    "js/systems/morningEventSystem.js": ["resolveMorningEvents", "applySpoonsChange", "partner-kindness"],
    "js/systems/dayCycle.js": ["resolveMorningEvents(state)", "Spoons are persistent"],
    "js/ui/screens/gameScreen.js": ["UI v0.8.2", "renderMorningEvents", "Spoons nie odnawiają się automatycznie"],
    "css/style.css": [".morning-events", ".persistent-spoons-note"],
}

for rel, tokens in checks.items():
    text = (ROOT / rel).read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            print(f"BLAD: {rel} nie zawiera {token}")
            sys.exit(1)

day_text = (ROOT / "js/systems/dayCycle.js").read_text(encoding="utf-8")
advance_match = re.search(r"export function advanceToNextDay\(\)\s*\{[\s\S]*?\n\}", day_text)
if not advance_match or "reset" in advance_match.group(0).lower() and "do NOT reset" not in advance_match.group(0):
    print("UWAGA: sprawdz recznie advanceToNextDay, bo wykryto slowo reset.")
else:
    print("OK: advanceToNextDay nie resetuje spoons do max.")

print("OK: spoons carry over between days.")
print("OK: morning global events added.")
print("OK: morning partner kindness events added.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=082")
print("4. Ctrl+F5")
print("5. Nowa gra")
print("")
print("Test:")
print("- zakoncz dzien z np. 7 spoons")
print("- kolejny poranek powinien zaczac z 7 plus/minus wydarzenia poranka")
print("- zobaczysz sekcje Poranek z wydarzeniem globalnym i akcja partnera")
