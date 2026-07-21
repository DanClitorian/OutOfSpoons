// versionBadge.js
//
// Small visible version marker appended globally by uiManager.js.
// This helps verify that the browser loaded the freshest code.

// v0.48: Visual Identity Redesign. Cache-bust (?v=480) na imporcie
// versionData.js (zmienil sie numer wersji) - bez tego przegladarka
// moglaby dalej pokazywac stary badge z cache.
import { GAME_VERSION_LABEL } from "../data/versionData.js?v=530";

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
