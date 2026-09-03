import { useEffect, useRef } from "react";

import { showErrorNotification } from "@/shared/utils/notifications";
import { describeRejectedScan, determineScanCodeType } from "@/shared/utils/scanCodes";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

// Physical barcode scanners act as HID keyboards: they "type" the code as a rapid burst of
// keystrokes terminated by Enter. A gap longer than this means a human is typing, so the
// buffer starts over. Generous on purpose — some scanners add inter-character delays, and a
// human "typing a code into nothing" is caught by the format validation anyway.
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
 * left alone — a scanner used while a text field is focused just fills that field. A code of a
 * recognised but unaccepted type gets an explanatory notification; noise is ignored silently.
 */
export default function useWedgeScanner({
  accepts,
  onScan,
}: {
  accepts: ScanCodeType[];
  onScan: (code: string, type: ScanCodeType) => void;
}) {
  const onScanRef = useRef(onScan);
  const acceptsRef = useRef(accepts);
  useEffect(() => {
    onScanRef.current = onScan;
    acceptsRef.current = accepts;
  }, [onScan, accepts]);

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
        const type = determineScanCodeType(buffer);
        if (acceptsRef.current.includes(type)) {
          event.preventDefault();
          onScanRef.current(buffer, type);
        } else if (type !== "unknown") {
          event.preventDefault();
          showErrorNotification(describeRejectedScan(type, acceptsRef.current));
        }
        buffer = "";
        return;
      }
      if (/^[\dA-Za-z]$/.test(event.key)) {
        buffer += event.key;
      } else if (event.key.length === 1) {
        // A printable non-alphanumeric character cannot be part of a code. Multi-character
        // keys are left alone: scanners press Shift as its own keydown before every uppercase
        // letter, and wiping the buffer on it would swallow every mixed-case scan.
        buffer = "";
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
