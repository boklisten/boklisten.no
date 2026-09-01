import { useEffect, useRef } from "react";

import { isValidBlid } from "@/features/blid-search/validateBlid";
import { showErrorNotification } from "@/shared/utils/notifications";
import { determineScanCodeType } from "@/shared/utils/scanCodes";

// Physical barcode scanners act as HID keyboards: they "type" the code as a rapid burst of
// keystrokes terminated by Enter. A gap longer than this means a human is typing, so the
// buffer starts over. Generous on purpose — some scanners add inter-character delays, and a
// human "typing a blid into nothing" is caught by the format validation anyway.
const MAX_KEYSTROKE_GAP_MS = 250;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * Listens for a physical barcode scanner anywhere on the page. Keystrokes aimed at an input are
 * left alone — a scanner used while the manual-entry field is focused just fills that field.
 */
export default function useWedgeScanner(onScan: (blid: string) => void) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let buffer = "";
    let lastKeystroke = 0;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        buffer = "";
        return;
      }
      const now = performance.now();
      if (now - lastKeystroke > MAX_KEYSTROKE_GAP_MS) {
        buffer = "";
      }
      lastKeystroke = now;

      if (event.key === "Enter") {
        if (isValidBlid(buffer)) {
          event.preventDefault();
          onScanRef.current(buffer);
        } else if (determineScanCodeType(buffer) === "isbn") {
          event.preventDefault();
          showErrorNotification({
            title: "Feil strekkode",
            message: "Du skannet en ISBN. Skann bokas unike ID i stedet.",
          });
        }
        buffer = "";
        return;
      }
      if (/^[\dA-Za-z]$/.test(event.key)) {
        buffer += event.key;
      } else if (event.key.length === 1) {
        // A printable non-alphanumeric character cannot be part of a blid. Multi-character
        // keys are left alone: scanners press Shift as its own keydown before every uppercase
        // letter, and wiping the buffer on it would swallow every mixed-case scan.
        buffer = "";
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
