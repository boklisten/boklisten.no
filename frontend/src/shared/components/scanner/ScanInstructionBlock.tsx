import { useReducedMotion } from "@mantine/hooks";
import type { CSSProperties, ReactNode } from "react";

import ScanCodeIllustration from "@/shared/components/scanner/ScanCodeIllustration";
import { describeScanCodeLocation } from "@/shared/utils/scanCodes";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

export interface ScanInstructionEntry {
  text: string;
  illustrate: ScanCodeType;
}

export interface ScanInstruction extends ScanInstructionEntry {
  /**
   * Entries the instruction may switch to (a type picker). Laid out as further slides beside this
   * one, so the block keeps the tallest height, nothing below it jumps on a switch, and the switch
   * slides like a gallery.
   */
  alternatives?: ScanInstructionEntry[];
}

/**
 * The caption under the camera, inside the scanner's dark housing (ScannerPanel paints it), so it
 * reads as part of the scanner rather than of the page. Carries its own contrast: white on dark
 * in either colour scheme. The video above it stays clear.
 */
const stripStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "10px 2px 2px",
  color: "#FFFFFF",
};

/**
 * Slides keep this order whatever is shown, so a switch always slides the same way: the reverse of
 * the picker's option order, so the content moves in the direction the picker's indicator moves
 * (choosing the option to the left pushes the content left).
 */
const SLIDE_ORDER: ScanCodeType[] = ["isbn", "blid", "customerId"];

function Entry({
  entry,
  hidden,
  width,
}: {
  entry: ScanInstructionEntry;
  hidden: boolean;
  width: string;
}) {
  const hint = describeScanCodeLocation(entry.illustrate);
  return (
    <div
      aria-hidden={hidden}
      style={{ width, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
    >
      <ScanCodeIllustration type={entry.illustrate} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{entry.text}</span>
        {hint !== null && (
          <span style={{ fontSize: 13, lineHeight: 1.3, color: "rgba(255, 255, 255, 0.75)" }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ScanInstructionBlock({
  instruction,
  children,
}: {
  instruction: ScanInstruction;
  /** A control that belongs with the instruction (a type picker), shown in the strip under it. */
  children?: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  // The instruction and its alternatives sit side by side on a track as wide as their number, and
  // the track slides to the shown one like the picker's own indicator does. Being in flow, the
  // tallest slide sets the height, so nothing below moves.
  const slides = [instruction, ...(instruction.alternatives ?? [])].toSorted(
    (a, b) => SLIDE_ORDER.indexOf(a.illustrate) - SLIDE_ORDER.indexOf(b.illustrate),
  );
  const shown = slides.indexOf(instruction);

  return (
    <div style={stripStyle} role="status">
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            width: `${slides.length * 100}%`,
            transform: `translateX(-${(shown * 100) / slides.length}%)`,
            transition: reducedMotion ? undefined : "transform 200ms ease",
          }}
        >
          {slides.map((entry, index) => (
            <Entry
              key={entry.illustrate}
              entry={entry}
              hidden={index !== shown}
              width={`${100 / slides.length}%`}
            />
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
