import type { MouseEvent } from "react";

/**
 * Smooth-scrolls to an in-page section. The anchor keeps its `href` so the
 * link still works without JavaScript and can be opened in a new tab.
 */
export function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.querySelector(`#${id}`);
  if (!target) {
    return;
  }
  event.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}
