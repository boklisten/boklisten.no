import { createSpotlight } from "@mantine/spotlight";

type SpotlightHandle = ReturnType<typeof createSpotlight>[1];

/**
 * Opens a spotlight in a way that also brings up the keyboard on touch devices. iOS Safari only
 * shows the keyboard when focus() runs synchronously inside the tap's call stack, but the
 * Spotlight input mounts async after the modal opens. Focus a throwaway input during the tap and
 * let Mantine's focus trap take over — iOS keeps the keyboard up when focus moves between text
 * inputs. Touch devices only: with the decoy focused at open time, Mantine's focus trap would try
 * to return focus to it (removed by then) on close instead of the triggering button.
 */
export function openSpotlight(spotlight: SpotlightHandle) {
  if (!window.matchMedia("(pointer: coarse)").matches) {
    spotlight.open();
    return;
  }
  const decoy = document.createElement("input");
  decoy.setAttribute("type", "text");
  decoy.style.position = "fixed";
  decoy.style.top = "0";
  decoy.style.left = "0";
  decoy.style.height = "1px";
  decoy.style.width = "1px";
  decoy.style.opacity = "0";
  // Anything below 16px makes iOS zoom the page when the decoy gains focus.
  decoy.style.fontSize = "16px";
  document.body.append(decoy);
  const remove = () => decoy.remove();
  decoy.addEventListener("blur", remove, { once: true });
  decoy.focus({ preventScroll: true });
  spotlight.open();
  // Fallback in case nothing ever steals focus from the decoy (e.g. the spotlight failed to open).
  setTimeout(remove, 2000);
}

export const [globalSearchStore, globalSearchSpotlight] = createSpotlight();

let override: (() => void) | null = null;

/**
 * Lets a page put its own search in front of the global one while it is mounted, so the shortcuts
 * and the page's own buttons all open the same thing. Returns the cleanup that hands control back.
 */
export function registerSearchOverride(open: () => void) {
  override = open;
  return () => {
    if (override === open) {
      override = null;
    }
  };
}

/** The one way to open search from anywhere in the admin: keyboard shortcut or page button. */
export function openSearch() {
  if (override) {
    override();
    return;
  }
  openSpotlight(globalSearchSpotlight);
}
