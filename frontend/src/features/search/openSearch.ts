import { createSpotlight } from "@mantine/spotlight";

type SpotlightHandle = ReturnType<typeof createSpotlight>[1];

/** Which keyboard a phone shows for the search: numeric where a phone number is the usual query. */
export type SearchKeyboard = "text" | "numeric";

let requestedKeyboard: SearchKeyboard = "text";

/** What the latest open asked for. The search field reads it when it mounts, once per open. */
export const requestedSearchKeyboard = () => requestedKeyboard;

/**
 * A hidden input that carries a keyboard layout. iOS picks the layout only when focus lands on an
 * input, so moving focus through one of these is how the search gets its layout while the
 * keyboard stays up. Anything below 16px would make iOS zoom the page when it gains focus.
 */
export function createKeyboardDecoy(keyboard: SearchKeyboard): HTMLInputElement {
  const decoy = document.createElement("input");
  decoy.type = "text";
  decoy.inputMode = keyboard;
  decoy.tabIndex = -1;
  decoy.setAttribute("aria-hidden", "true");
  Object.assign(decoy.style, {
    position: "fixed",
    top: "0",
    left: "0",
    height: "1px",
    width: "1px",
    opacity: "0",
    fontSize: "16px",
  });
  return decoy;
}

/**
 * Opens a spotlight in a way that also brings up the keyboard on touch devices. iOS Safari only
 * shows the keyboard when focus() runs synchronously inside the tap's call stack, but the
 * Spotlight input mounts async after the modal opens. Focus a throwaway input during the tap and
 * let Mantine's focus trap take over — iOS keeps the keyboard up when focus moves between text
 * inputs. Touch devices only: with the decoy focused at open time, Mantine's focus trap would try
 * to return focus to it (removed by then) on close instead of the triggering button.
 */
export function openSpotlight(spotlight: SpotlightHandle, options?: { keyboard?: SearchKeyboard }) {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  // Desktops have every key, so only a touch device gets a keyboard other than text.
  requestedKeyboard = touch ? (options?.keyboard ?? "text") : "text";
  if (!touch) {
    spotlight.open();
    return;
  }
  const decoy = createKeyboardDecoy(requestedKeyboard);
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
export function openSearch(options?: { keyboard?: SearchKeyboard }) {
  if (override) {
    override();
    return;
  }
  openSpotlight(globalSearchSpotlight, options);
}
