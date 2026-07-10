// versionBadge.js
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
