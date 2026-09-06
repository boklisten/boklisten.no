import { useEffect } from "react";

import { openSearch } from "@/features/search/openSearch";

/** Two Shift presses closer than this, with nothing else in between, count as one shortcut. */
const DOUBLE_SHIFT_WINDOW_MS = 400;

/**
 * ⌘K / Ctrl+K and Shift Shift open the search from anywhere in the admin, also while a text field
 * has focus. A physical barcode scanner presses Shift before every uppercase character, but a
 * character always follows, and any other key resets the double-Shift timer, so scans never open
 * the search.
 */
export default function useSearchShortcuts() {
  useEffect(() => {
    let lastShiftAt = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        lastShiftAt = 0;
        openSearch();
        return;
      }
      if (event.key === "Shift" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const now = Date.now();
        if (now - lastShiftAt < DOUBLE_SHIFT_WINDOW_MS) {
          lastShiftAt = 0;
          openSearch();
        } else {
          lastShiftAt = now;
        }
        return;
      }
      lastShiftAt = 0;
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
