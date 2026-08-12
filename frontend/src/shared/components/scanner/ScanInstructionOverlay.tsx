import type { CSSProperties } from "react";

import type { ScanCodeType } from "@/shared/utils/scanCodes";

export type ScanInstruction = {
  text: string;
  illustrate?: ScanCodeType | undefined;
};

/**
 * Alternating bar/space run widths, in abstract modules.
 *
 * Not a decodable barcode on purpose — it illustrates the *shape* to hunt for. Widths are fixed
 * rather than generated so the drawing is identical on the server and the client.
 */
const BAR_RUNS = [
  1, 1, 1, 3, 2, 1, 2, 2, 1, 1, 3, 1, 2, 1, 1, 2, 2, 3, 1, 1, 2, 1, 1, 1, 3, 2, 1, 1, 2, 2, 1, 3, 2,
  1, 1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 1, 3, 1, 2, 2, 1, 1, 1, 3, 1, 2, 2, 1, 1, 2, 3, 1, 1, 1, 2,
];

/** Guard bars sit at both edges and the centre, and hang below the digits — an EAN-13 tell. */
const GUARD_RUNS = new Set([0, 2, 30, 32, 60, 62]);

const LABEL_WIDTH = 112;
const QUIET_ZONE = 8;
const BARS_TOP = 8;
const BARS_BOTTOM = 42;
const GUARD_BOTTOM = 49;

function BarcodeIllustration({ type }: { type: ScanCodeType }) {
  const totalModules = BAR_RUNS.reduce((sum, run) => sum + run, 0);
  const scale = (LABEL_WIDTH - QUIET_ZONE * 2) / totalModules;

  let cursor = QUIET_ZONE;
  const bars = BAR_RUNS.map((run, index) => {
    const x = cursor;
    cursor += run * scale;
    if (index % 2 !== 0) {
      return null;
    }
    const isGuard = GUARD_RUNS.has(index);
    return (
      <rect
        key={index}
        x={x}
        y={BARS_TOP}
        width={run * scale}
        height={(isGuard ? GUARD_BOTTOM : BARS_BOTTOM) - BARS_TOP}
        fill={"#111318"}
      />
    );
  });

  return (
    <svg
      aria-hidden={"true"}
      focusable={"false"}
      viewBox={`0 0 ${LABEL_WIDTH} 60`}
      width={64}
      height={34}
      style={{ flexShrink: 0, display: "block" }}
    >
      <rect x={0} y={0} width={LABEL_WIDTH} height={60} rx={4} fill={"#F7F7F4"} />
      {bars}
      <text
        x={LABEL_WIDTH / 2}
        y={57}
        textAnchor={"middle"}
        fontSize={7}
        fontFamily={"ui-monospace, SFMono-Regular, Menlo, monospace"}
        letterSpacing={0.4}
        fill={"#111318"}
      >
        {type === "isbn" ? "9 788203 208119" : "12345678"}
      </text>
    </svg>
  );
}

function locateHint(type: ScanCodeType): string | null {
  switch (type) {
    case "isbn": {
      return "Strekkoden med 13 siffer, vanligvis på baksiden av boka";
    }
    case "blid": {
      return "Klistremerket med bokas unike ID";
    }
    case "unknown": {
      return null;
    }
  }
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
  const hint = instruction.illustrate === undefined ? null : locateHint(instruction.illustrate);

  return (
    <div style={scrimStyle} role={"status"}>
      {instruction.illustrate !== undefined && instruction.illustrate !== "unknown" && (
        <BarcodeIllustration type={instruction.illustrate} />
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
