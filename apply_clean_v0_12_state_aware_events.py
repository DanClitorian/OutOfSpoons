# apply_clean_v0_12_state_aware_events.py
from pathlib import Path
import re, sys

ROOT = Path.cwd()
VERSION = "v0.12"
CACHE = "120"
FORBIDDEN = ["morningMessage", "npc-message", "pisze:", "{name} pisze"]

EVENT_TAGS = {
    "talk_request": ["repair", "high-trust"],
    "cancel_plans": ["low-spoons", "avoidance"],
    "need_rest": ["low-spoons", "avoidance"],
    "text_misunderstanding": ["low-trust", "tension"],
    "social_invitation": ["high-spoons"],
    "life_obligation": ["tension"],
}

def fail(msg):
    print("BLAD:", msg)
    sys.exit(1)

def p(rel):
    path = ROOT / rel
    if not path.exists():
        fail(f"nie znaleziono {rel}; uruchom z C:\\OutOfSpoons")
    return path

def read(rel):
    return p(rel).read_text(encoding="utf-8")

def guard(rel, text):
    for tok in FORBIDDEN:
        if tok in text:
            fail(f"{rel} zawiera zabroniony token regresji: {tok}")

def write(rel, text):
    guard(str(rel), text)
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print("OK ->", rel)

def find_matching_brace(text, open_i):
    depth = 0
    quote = None
    esc = False
    line = False
    block = False
    for i in range(open_i, len(text)):
        ch = text[i]
        nxt = text[i+1] if i+1 < len(text) else ""
        if line:
            if ch == "\n": line = False
            continue
        if block:
            if ch == "*" and nxt == "/": block = False
            continue
        if quote:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == quote: quote = None
            continue
        if ch == "/" and nxt == "/":
            line = True
            continue
        if ch == "/" and nxt == "*":
            block = True
            continue
        if ch in ['"', "'", "`"]:
            quote = ch
            continue
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return i
    fail("nie znaleziono pasującej klamry")
    return -1

def extract_function(text, name, required=True):
    start = text.find(f"export function {name}")
    if start == -1:
        if required: fail(f"nie znaleziono funkcji {name}")
        return None
    open_i = text.find("{", start)
    if open_i == -1: fail(f"nie znaleziono otwarcia funkcji {name}")
    end = find_matching_brace(text, open_i)
    return text[start:end+1]

def replace_function(text, name, repl):
    old = extract_function(text, name, True)
    return text.replace(old, repl, 1)

def event_bounds(text, event_id):
    m = re.search(r'id\s*:\s*["\']' + re.escape(event_id) + r'["\']', text)
    if not m: fail(f"nie znaleziono eventu {event_id}")
    open_i = text.rfind("{", 0, m.start())
    if open_i == -1: fail(f"nie znaleziono początku obiektu eventu {event_id}")
    end = find_matching_brace(text, open_i)
    return open_i, end+1

def tag_array(tags):
    return "[" + ", ".join(f'"{t}"' for t in tags) + "]"

def patch_event_data(text):
    out = text
    for event_id, tags in EVENT_TAGS.items():
        s, e = event_bounds(out, event_id)
        obj = out[s:e]
        line = f"weightTags: {tag_array(tags)}"
        if re.search(r'weightTags\s*:', obj):
            obj2 = re.sub(r'weightTags\s*:\s*\[[^\]]*\]', line, obj, count=1)
        else:
            m = re.search(r'^(\s*)tags\s*:\s*\[[^\]]*\]\s*,?', obj, flags=re.M)
            if m:
                indent = m.group(1)
                pos = m.end()
                comma = "" if obj[pos-1] == "," else ","
                obj2 = obj[:pos] + comma + f"\n{indent}{line}," + obj[pos:]
            else:
                m = re.search(r'^(\s*)id\s*:\s*["\']' + re.escape(event_id) + r'["\']\s*,?', obj, flags=re.M)
                if not m: fail(f"brak miejsca dla weightTags w {event_id}")
                indent = m.group(1)
                pos = m.end()
                comma = "" if obj[pos-1] == "," else ","
                obj2 = obj[:pos] + comma + f"\n{indent}{line}," + obj[pos:]
        out = out[:s] + obj2 + out[e:]
    if "weightTags wpływają" not in out:
        i = out.find("export const eventPool")
        if i != -1:
            out = out[:i] + "// v0.12: weightTags wpływają na częstotliwość losowania eventu.\n\n" + out[i:]
    return out

def check_no_reset(day_cycle):
    fn = extract_function(day_cycle, "advanceToNextDay", required=False)
    if fn and re.search(r"spoons\.current\s*=\s*[^;\n]*\.max", fn):
        fail("advanceToNextDay wygląda jak reset spoons do max")

def sanity():
    for rel in [
        "js/data/eventData.js",
        "js/systems/eventSystem.js",
        "js/systems/dayCycle.js",
        "js/data/versionData.js",
        "index.html",
    ]:
        p(rel)
    if "export function getEventForDay" not in read("js/systems/eventSystem.js"):
        fail("brak getEventForDay")
    if "export function goToEvent" not in read("js/systems/dayCycle.js"):
        fail("brak goToEvent")
    check_no_reset(read("js/systems/dayCycle.js"))

EVENT_WEIGHT_SYSTEM = r'''// eventWeightSystem.js
export function getWeightedEventForDay(events, state, previousEventId = null) {
  try {
    const candidates = excludeImmediateRepeat(events, previousEventId);
    if (!candidates || candidates.length === 0) return pickRandom(events);
    return pickWeightedRandom(candidates, state);
  } catch (error) {
    console.warn("eventWeightSystem fallback:", error);
    return pickRandom(events);
  }
}

function excludeImmediateRepeat(events, previousEventId) {
  if (!Array.isArray(events) || events.length === 0) return [];
  if (events.length > 1 && previousEventId) {
    const filtered = events.filter((event) => event.id !== previousEventId);
    if (filtered.length > 0) return filtered;
  }
  return events;
}

function pickWeightedRandom(candidates, state) {
  const weighted = candidates.map((event) => ({
    event,
    weight: computeEventWeight(event, state)
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return pickRandom(candidates);
  let roll = Math.random() * totalWeight;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.event;
  }
  return weighted[weighted.length - 1].event;
}

function computeEventWeight(event, state) {
  let weight = 1;
  const tags = event && Array.isArray(event.weightTags) ? event.weightTags : [];
  if (tags.length === 0) return weight;

  const spoons = readCurrentSpoons(state);
  const trust = readCurrentTrust(state);
  const frustration = readCurrentFrustration(state);

  if (tags.includes("low-spoons") && spoons !== null && spoons <= 3) weight += 3;
  if (tags.includes("high-spoons") && spoons !== null && spoons >= 7) weight += 2;
  if (tags.includes("high-frustration") && frustration !== null && frustration >= 60) weight += 3;
  if (tags.includes("low-trust") && trust !== null && trust <= 35) weight += 3;
  if (tags.includes("high-trust") && trust !== null && trust >= 70) weight += 3;

  if (
    tags.includes("repair") &&
    trust !== null &&
    frustration !== null &&
    trust >= 45 &&
    frustration >= 35
  ) weight += 2;

  if (tags.includes("tension") && frustration !== null && frustration >= 50) weight += 2;
  if (tags.includes("avoidance") && spoons !== null && spoons <= 4) weight += 2;

  return Math.max(1, weight);
}

function readCurrentSpoons(state) {
  return state &&
    state.resources &&
    state.resources.spoons &&
    typeof state.resources.spoons.current === "number"
    ? state.resources.spoons.current
    : null;
}

function readCurrentTrust(state) {
  const npc = readCurrentNpc(state);
  return npc && typeof npc.trust === "number" ? npc.trust : null;
}

function readCurrentFrustration(state) {
  const npc = readCurrentNpc(state);
  return npc && typeof npc.frustration === "number" ? npc.frustration : null;
}

function readCurrentNpc(state) {
  return state && state.partner && state.npcs ? state.npcs[state.partner.id] || null : null;
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error("No events available.");
  return list[Math.floor(Math.random() * list.length)];
}
'''

GET_EVENT_REPL = r'''export function getEventForDay(day, previousEventId = null, state = null) {
  const eligibleEvents = getEligibleEvents(day);
  const pool = eligibleEvents.length > 0 ? eligibleEvents : eventPool;

  if (state) {
    return getWeightedEventForDay(pool, state, previousEventId);
  }

  let candidates = pool;

  if (pool.length > 1 && previousEventId) {
    const withoutPrevious = pool.filter((event) => event.id !== previousEventId);

    if (withoutPrevious.length > 0) {
      candidates = withoutPrevious;
    }
  }

  return pickRandom(candidates);
}'''

def main():
    sanity()

    print("Out of Spoons - v0.12 state-aware event selection")

    write(Path("js/systems/eventWeightSystem.js"), EVENT_WEIGHT_SYSTEM)

    event_data = patch_event_data(read("js/data/eventData.js"))
    write(Path("js/data/eventData.js"), event_data)

    event_system = read("js/systems/eventSystem.js")
    if "eventWeightSystem.js" not in event_system:
        imports = list(re.finditer(r'^import .+;\s*$', event_system, flags=re.M))
        if not imports: fail("brak importów w eventSystem.js")
        at = imports[-1].end()
        event_system = event_system[:at] + '\nimport { getWeightedEventForDay } from "./eventWeightSystem.js";' + event_system[at:]
    if "getEventForDay(day, previousEventId = null, state = null)" not in event_system:
        event_system = replace_function(event_system, "getEventForDay", GET_EVENT_REPL)
    write(Path("js/systems/eventSystem.js"), event_system)

    day_cycle = read("js/systems/dayCycle.js")
    go = extract_function(day_cycle, "goToEvent", True)
    if "getEventForDay(state.day, previousEventId, state)" not in go:
        go2 = go.replace("getEventForDay(state.day, previousEventId)", "getEventForDay(state.day, previousEventId, state)")
        if go2 == go:
            fail("nie znaleziono wywołania getEventForDay(state.day, previousEventId) w goToEvent")
        day_cycle = day_cycle.replace(go, go2, 1)
    check_no_reset(day_cycle)
    write(Path("js/systems/dayCycle.js"), day_cycle)

    version = read("js/data/versionData.js")
    version, n1 = re.subn(r'GAME_VERSION\s*=\s*"[^"]*"', f'GAME_VERSION = "{VERSION}"', version, count=1)
    version, n2 = re.subn(r'GAME_VERSION_LABEL\s*=\s*"[^"]*"', f'GAME_VERSION_LABEL = "Out of Spoons {VERSION}"', version, count=1)
    if n1 != 1 or n2 != 1:
        fail("nie udało się zaktualizować versionData.js")
    write(Path("js/data/versionData.js"), version)

    index = read("index.html")
    index, n = re.subn(
        r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
        f'src="./js/main.js?v={CACHE}"',
        index,
        count=1
    )
    if n != 1:
        fail("nie znaleziono script src dla js/main.js")
    write(Path("index.html"), index)

    print("")
    print("Weryfikacja:")
    checks = {
        "js/systems/eventWeightSystem.js": ["getWeightedEventForDay", "low-spoons", "pickWeightedRandom"],
        "js/data/eventData.js": ["weightTags", '"repair"', '"avoidance"', '"tension"'],
        "js/systems/eventSystem.js": ["eventWeightSystem.js", "getEventForDay(day, previousEventId = null, state = null)", "getWeightedEventForDay(pool, state, previousEventId)"],
        "js/systems/dayCycle.js": ["getEventForDay(state.day, previousEventId, state)"],
        "js/data/versionData.js": [f'GAME_VERSION = "{VERSION}"', f"Out of Spoons {VERSION}"],
        "index.html": [f"js/main.js?v={CACHE}"],
    }
    for rel, toks in checks.items():
        txt = read(rel)
        for tok in toks:
            if tok not in txt:
                fail(f"{rel} nie zawiera {tok}")
    check_no_reset(read("js/systems/dayCycle.js"))
    print("OK: v0.12 dodane.")
    print("")
    print("Teraz:")
    print("1. Ctrl+C")
    print("2. py -m http.server 8000")
    print("3. http://localhost:8000/?v=120")
    print("4. Ctrl+F5")
    print("")
    print("Test:")
    print("- sprawdz badge: Out of Spoons v0.12")
    print("- przejdz kilka dni")
    print("- eventy nie powinny powtarzac sie dzien po dniu")
    print("- przy niskich spoons czesciej powinny wpadać eventy low-spoons/avoidance")

if __name__ == "__main__":
    main()
