# apply_clean_v0_10_previous_evening_summary.py
#
# Clean v0.10 updater for Out of Spoons.
#
# Adds previous evening summary to the morning screen WITHOUT overwriting
# the current v0.8.2 gameScreen structure.
#
# It preserves:
# - persistent spoons note
# - morning global events
# - partner kindness morning events
# - relationship bars
# - relationship mood
# - evening flow
# - no morningMessage
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_clean_v0_10_previous_evening_summary.py

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
    path = require(rel)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

# ---------------------------------------------------------------------------
# 1. Patch gameScreen.js in place
# ---------------------------------------------------------------------------

game_path = require(Path("js/ui/screens/gameScreen.js"))
game = game_path.read_text(encoding="utf-8")

# Safety checks: we want the real current gameScreen, not an older generated one.
required_current_tokens = [
    "renderPersistentSpoonsNote",
    "renderMorningEvents",
    "UI v0.8.2",
    "Spoons nie odnawiają się automatycznie"
]

missing = [token for token in required_current_tokens if token not in game]
if missing:
    print("BLAD: gameScreen.js nie wyglada na aktualna wersje v0.8.2.")
    print("Brakuje tokenow:")
    for token in missing:
        print(f"  - {token}")
    print("")
    print("Nie uruchamiam patcha, bo moglbym nadpisac/zepsuc aktualny flow.")
    sys.exit(1)

# Remove older clean v0.10 helper block if this script is re-run.
game = re.sub(
    r"\n// CLEAN v0\.10 previous evening summary helpers START[\s\S]*?// CLEAN v0\.10 previous evening summary helpers END\n",
    "\n",
    game
)

# Remove an existing call block if re-run.
game = re.sub(
    r'\n\s*const previousEveningSummary = renderPreviousEveningSummary\(state\);\n\s*if \(previousEveningSummary\) \{\n\s*wrapper\.appendChild\(previousEveningSummary\);\n\s*\}\n',
    "\n",
    game
)

# Insert call after persistent spoons note, before morning events.
anchor = "  wrapper.appendChild(renderPersistentSpoonsNote());"
if anchor not in game:
    print("BLAD: nie znaleziono miejsca po renderPersistentSpoonsNote().")
    sys.exit(1)

insert_call = '''  wrapper.appendChild(renderPersistentSpoonsNote());

  const previousEveningSummary = renderPreviousEveningSummary(state);
  if (previousEveningSummary) {
    wrapper.appendChild(previousEveningSummary);
  }'''

game = game.replace(anchor, insert_call, 1)

# Add helper functions before renderMorningEvents so order stays readable.
helper_anchor = "\nfunction renderMorningEvents(state) {"
if helper_anchor not in game:
    print("BLAD: nie znaleziono funkcji renderMorningEvents(state).")
    sys.exit(1)

helpers = r'''
// CLEAN v0.10 previous evening summary helpers START
function renderPreviousEveningSummary(state) {
  const recovery = state.lastEveningRecovery;

  if (!recovery || recovery.day !== state.day - 1) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "previous-evening-summary";

  const heading = document.createElement("p");
  heading.className = "previous-evening-heading";
  heading.textContent = "Wczoraj wieczorem";
  section.appendChild(heading);

  const label = document.createElement("p");
  label.className = "previous-evening-label";
  label.textContent = replacePartnerPlaceholder(recovery.label, state);
  section.appendChild(label);

  const description = document.createElement("p");
  description.className = "previous-evening-description";
  description.textContent = replacePartnerPlaceholder(recovery.description, state);
  section.appendChild(description);

  const effects = document.createElement("p");
  effects.className = "previous-evening-effects";
  effects.textContent = formatPreviousEveningEffects(recovery.effects);
  section.appendChild(effects);

  return section;
}

function formatPreviousEveningEffects(effects) {
  if (!effects) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  const parts = [];

  if (effects.spoonsChange !== 0) {
    parts.push(`Spoons ${formatSignedForPreviousEvening(effects.spoonsChange)}`);
  }

  if (effects.trustChange !== 0) {
    parts.push(`Zaufanie ${formatSignedForPreviousEvening(effects.trustChange)}`);
  }

  if (effects.frustrationChange !== 0) {
    parts.push(`Frustracja ${formatSignedForPreviousEvening(effects.frustrationChange)}`);
  }

  if (parts.length === 0) {
    return "Bez wyraźnych efektów mechanicznych.";
  }

  return parts.join(" · ");
}

function replacePartnerPlaceholder(text, state) {
  if (!text) {
    return "";
  }

  const partnerName = state.partner ? state.partner.name : "partner";
  return text.replace(/\{partnerName\}/g, partnerName);
}

function formatSignedForPreviousEvening(value) {
  return value > 0 ? `+${value}` : `${value}`;
}
// CLEAN v0.10 previous evening summary helpers END
'''

game = game.replace(helper_anchor, helpers + helper_anchor, 1)

game_path.write_text(game, encoding="utf-8", newline="\n")
print("OK -> js/ui/screens/gameScreen.js")

# ---------------------------------------------------------------------------
# 2. Patch CSS in place
# ---------------------------------------------------------------------------

style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

# Do not bring back old message CSS. Remove if present.
style = re.sub(r"\n?\.npc-message\s*\{[^}]*\}\s*", "\n", style, flags=re.MULTILINE)
style = re.sub(r"\n?\.partner-card\s+\.npc-message\s*\{[^}]*\}\s*", "\n", style, flags=re.MULTILINE)

# Replace idempotently.
style = re.sub(
    r"/\* CLEAN v0\.10 previous evening summary \*/[\s\S]*?/\* END CLEAN v0\.10 previous evening summary \*/",
    "",
    style
)

style += r'''

/* CLEAN v0.10 previous evening summary */
.previous-evening-summary {
  background-color: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 4px;
  padding: var(--space-md);
  margin: var(--space-md) 0;
}

.previous-evening-heading {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 var(--space-sm) 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.previous-evening-label {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--color-ink);
  margin: 0 0 2px 0;
}

.previous-evening-description {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-style: italic;
  margin: 0 0 var(--space-sm) 0;
}

.previous-evening-effects {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-family: var(--font-display);
  font-weight: 600;
  margin: 0;
}
/* END CLEAN v0.10 previous evening summary */
'''

style_path.write_text(style, encoding="utf-8", newline="\n")
print("OK -> css/style.css")

# ---------------------------------------------------------------------------
# 3. Cache bust index.html only
# ---------------------------------------------------------------------------

index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=100"',
    index
)
index_path.write_text(index, encoding="utf-8", newline="\n")
print("OK -> index.html")

# ---------------------------------------------------------------------------
# 4. Verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

game_check = game_path.read_text(encoding="utf-8")
style_check = style_path.read_text(encoding="utf-8")

required_game = [
    "renderPreviousEveningSummary",
    "previous-evening-summary",
    "recovery.day !== state.day - 1",
    "renderPersistentSpoonsNote",
    "renderMorningEvents",
    "Spoons nie odnawiają się automatycznie",
    "UI v0.8.2"
]

for token in required_game:
    if token not in game_check:
        print(f"BLAD: gameScreen.js nie zawiera {token}")
        sys.exit(1)

required_style = [
    ".previous-evening-summary",
    ".previous-evening-heading",
    ".previous-evening-label",
    ".previous-evening-description",
    ".previous-evening-effects"
]

for token in required_style:
    if token not in style_check:
        print(f"BLAD: style.css nie zawiera {token}")
        sys.exit(1)

if "morningMessage" in game_check or "pisze:" in game_check:
    print("BLAD: gameScreen.js zawiera stary tekst morningMessage/pisze.")
    sys.exit(1)

print("OK: dodano podsumowanie poprzedniego wieczoru.")
print("OK: zachowano persistent spoons note.")
print("OK: zachowano sekcje porannych wydarzen.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=100")
print("4. Ctrl+F5")
print("")
print("Test:")
print("- przejdz przez Wieczor")
print("- wybierz opcje")
print("- na kolejnym poranku powinna pojawic sie sekcja: Wczoraj wieczorem")
