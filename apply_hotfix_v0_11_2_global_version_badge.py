# apply_hotfix_v0_11_2_global_version_badge.py
#
# Adds a small global visible version badge to every screen.
#
# Goal:
# The user should always see whether the browser loaded the freshest code.
#
# Adds:
# - js/data/versionData.js
# - js/ui/versionBadge.js
#
# Patches:
# - js/ui/uiManager.js to append the badge after every screen render
# - css/style.css to style the badge as small subtle digits
# - js/ui/screens/gameScreen.js to remove stale "UI v0.8.2" debug marker if present
# - index.html cache-bust to ?v=112
#
# Run:
#   cd C:\OutOfSpoons
#   py .\apply_hotfix_v0_11_2_global_version_badge.py

from pathlib import Path
import re
import sys

ROOT = Path.cwd()

VERSION = "v0.11.2"

FORBIDDEN_ACTIVE_TOKENS = [
    "morningMessage",
    "npc-message",
    "pisze:",
    "{name} pisze"
]

def fail(message):
    print(f"BLAD: {message}")
    sys.exit(1)

def require(rel):
    path = ROOT / rel
    if not path.exists():
        fail(f"nie znaleziono {rel}. Uruchom skrypt z folderu C:\\OutOfSpoons.")
    return path

def read(rel):
    return require(rel).read_text(encoding="utf-8")

def write(rel, text):
    guard(rel, text)
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"OK -> {rel}")

def guard(rel, text):
    for token in FORBIDDEN_ACTIVE_TOKENS:
        if token in text:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

def sanity_check():
    required = [
        Path("js/ui/uiManager.js"),
        Path("js/ui/screens/gameScreen.js"),
        Path("css/style.css"),
        Path("index.html"),
        Path("js/ui/screens/weeklySummaryScreen.js"),
    ]

    for rel in required:
        require(rel)

    manager = read(Path("js/ui/uiManager.js"))
    for token in ["export function initUI", "export function showScreen"]:
        if token not in manager:
            fail(f"uiManager.js nie zawiera {token}")

    game = read(Path("js/ui/screens/gameScreen.js"))
    for token in ["renderPersistentSpoonsNote", "renderMorningEvents", "renderPreviousEveningSummary"]:
        if token not in game:
            fail(f"gameScreen.js nie wyglada na aktualna wersje v0.10+, brak: {token}")

# ---------------------------------------------------------------------------
# 1. versionData.js
# ---------------------------------------------------------------------------

version_data = f'''// versionData.js
//
// Global visible build version.
// Update GAME_VERSION with every hotfix and every new feature.

export const GAME_VERSION = "{VERSION}";
export const GAME_VERSION_LABEL = "Out of Spoons {VERSION}";
'''

write(Path("js/data/versionData.js"), version_data)

# ---------------------------------------------------------------------------
# 2. versionBadge.js
# ---------------------------------------------------------------------------

version_badge = r'''// versionBadge.js
//
// Small visible version marker appended globally by uiManager.js.
// This helps verify that the browser loaded the freshest code.

import { GAME_VERSION_LABEL } from "../data/versionData.js";

export function appendVersionBadge(container) {
  if (!container) {
    return;
  }

  const existingBadge = container.querySelector(".version-badge");
  if (existingBadge) {
    existingBadge.remove();
  }

  const badge = document.createElement("p");
  badge.className = "version-badge";
  badge.textContent = GAME_VERSION_LABEL;

  container.appendChild(badge);
}
'''

write(Path("js/ui/versionBadge.js"), version_badge)

# ---------------------------------------------------------------------------
# 3. Patch uiManager.js to append badge after every render
# ---------------------------------------------------------------------------

manager_path = require(Path("js/ui/uiManager.js"))
manager = manager_path.read_text(encoding="utf-8")

if "appendVersionBadge" not in manager:
    imports = list(re.finditer(r'^import .+;\s*$', manager, flags=re.MULTILINE))
    if not imports:
        fail("nie znaleziono importow w uiManager.js.")

    insert_at = imports[-1].end()
    manager = (
        manager[:insert_at]
        + '\nimport { appendVersionBadge } from "./versionBadge.js";'
        + manager[insert_at:]
    )

if "appendVersionBadge(appContainer);" not in manager:
    # Add after the actual render call in showScreen.
    target = "  render(appContainer, data);\n"
    if target not in manager:
        # Some older versions used renderFn.
        target = "  renderFn(appContainer, data);\n"

    if target not in manager:
        fail("nie znaleziono wywolania render(...) w showScreen.")

    manager = manager.replace(
        target,
        target + "  appendVersionBadge(appContainer);\n",
        1
    )

write(Path("js/ui/uiManager.js"), manager)

# ---------------------------------------------------------------------------
# 4. Remove stale debug marker from gameScreen.js if present
# ---------------------------------------------------------------------------

game_path = require(Path("js/ui/screens/gameScreen.js"))
game = game_path.read_text(encoding="utf-8")

# Remove the explicit UI v0.8.2 marker block from v0.8.2.
game = re.sub(
    r'\n\s*const marker = document\.createElement\("p"\);\n\s*marker\.className = "debug-version-marker";\n\s*marker\.textContent = "UI v0\.8\.2";\n\s*wrapper\.appendChild\(marker\);\n',
    "\n",
    game,
    count=1
)

write(Path("js/ui/screens/gameScreen.js"), game)

# ---------------------------------------------------------------------------
# 5. CSS
# ---------------------------------------------------------------------------

style_path = require(Path("css/style.css"))
style = style_path.read_text(encoding="utf-8")

style = re.sub(
    r"/\* CLEAN v0\.11\.2 global version badge \*/[\s\S]*?/\* END CLEAN v0\.11\.2 global version badge \*/",
    "",
    style
)

style += r'''

/* CLEAN v0.11.2 global version badge */
.version-badge {
  color: var(--color-muted);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-align: right;
  opacity: 0.65;
  margin: var(--space-sm) 2px 0 0;
  user-select: none;
}
/* END CLEAN v0.11.2 global version badge */
'''

write(Path("css/style.css"), style)

# ---------------------------------------------------------------------------
# 6. Cache bust
# ---------------------------------------------------------------------------

index_path = require(Path("index.html"))
index = index_path.read_text(encoding="utf-8")
index, count = re.subn(
    r'src=(["\'])(?:\.\/)?js\/main\.js(?:\?v=[^"\']+)?\1',
    'src="./js/main.js?v=112"',
    index,
    count=1
)

if count != 1:
    fail("nie znaleziono script src dla js/main.js w index.html.")

write(Path("index.html"), index)

# ---------------------------------------------------------------------------
# 7. Verification
# ---------------------------------------------------------------------------

print("")
print("Weryfikacja:")

checks = {
    "js/data/versionData.js": [
        f'GAME_VERSION = "{VERSION}"',
        f"Out of Spoons {VERSION}"
    ],
    "js/ui/versionBadge.js": [
        "appendVersionBadge",
        "version-badge"
    ],
    "js/ui/uiManager.js": [
        "appendVersionBadge",
        "appendVersionBadge(appContainer);",
        "export function initUI",
        "export function showScreen"
    ],
    "css/style.css": [
        "/* CLEAN v0.11.2 global version badge */",
        ".version-badge"
    ],
    "index.html": [
        "js/main.js?v=112"
    ]
}

for rel, tokens in checks.items():
    content = (ROOT / rel).read_text(encoding="utf-8")
    for token in tokens:
        if token not in content:
            fail(f"{rel} nie zawiera: {token}")

game_check = (ROOT / "js/ui/screens/gameScreen.js").read_text(encoding="utf-8")
if "UI v0.8.2" in game_check:
    fail("gameScreen.js nadal zawiera stary marker UI v0.8.2.")

for rel in [
    "js/data/versionData.js",
    "js/ui/versionBadge.js",
    "js/ui/uiManager.js",
    "js/ui/screens/gameScreen.js"
]:
    content = (ROOT / rel).read_text(encoding="utf-8")
    for token in FORBIDDEN_ACTIVE_TOKENS:
        if token in content:
            fail(f"{rel} zawiera zabroniony token regresji: {token}")

print(f"OK: globalny znacznik wersji {VERSION} dodany.")
print("OK: znacznik pojawi sie na kazdym ekranie.")
print("")
print("Teraz:")
print("1. Ctrl+C zatrzymaj serwer")
print("2. py -m http.server 8000")
print("3. otworz http://localhost:8000/?v=112")
print("4. Ctrl+F5")
print("")
print("Test:")
print("- na dole/prawej stronie kazdego ekranu powinno byc male: Out of Spoons v0.11.2")


if __name__ == "__main__":
    sanity_check()
