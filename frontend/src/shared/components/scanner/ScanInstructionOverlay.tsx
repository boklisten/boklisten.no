import type { CSSProperties } from "react";

import ScanCodeIllustration from "@/shared/components/scanner/ScanCodeIllustration";
import { describeScanCodeLocation } from "@/shared/utils/scanCodes";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

export interface ScanInstruction {
  text: string;
  illustrate?: ScanCodeType | undefined;
}

/**
 * The overlay floats on live video, so it carries its own contrast rather than following the
 * Mantine theme — the camera output behind it is arbitrary in either light or dark mode.
 */
const scrimStyle: CSSProperties = {
  position: "absolute",
  insetInline: 0,
  bottom: 0,
  // Below the scanner's own controls (which sit at z-index 2) and click-through, so the torch
  // button stays usable.
  zIndex: 1,
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  gap: 12,
  // Right padding clears the torch button anchored at right: 8.
  padding: "10px 52px 10px 12px",
  background: "rgba(9, 11, 16, 0.82)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  color: "#FFFFFF",
  textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)",
};

export default function ScanInstructionOverlay({ instruction }: { instruction: ScanInstruction }) {
  const hint =
    instruction.illustrate === undefined ? null : describeScanCodeLocation(instruction.illustrate);

  return (
    <div style={scrimStyle} role="status">
      {instruction.illustrate !== undefined && (
        <ScanCodeIllustration type={instruction.illustrate} />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{instruction.text}</span>
        {hint !== null && (
          <span style={{ fontSize: 13, lineHeight: 1.3, color: "rgba(255, 255, 255, 0.75)" }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
