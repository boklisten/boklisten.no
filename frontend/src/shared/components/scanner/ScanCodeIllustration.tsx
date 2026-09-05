import { QRCodeSVG } from "qrcode.react";

import type { ScanCodeType } from "@/shared/utils/scanCodes";

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

/** Every illustration is drawn at this height at scale 1, so they line up side by side. */
const BASE_HEIGHT = 34;

/**
 * The exact artwork the stand prints (rendered by the backend's unique-ID generator with an example
 * ID), so the employee sees the sticker itself rather than a generic barcode.
 */
function BlidLabelIllustration({ scale }: { scale: number }) {
  const width = 88 * scale;
  const height = BASE_HEIGHT * scale;
  return (
    <img
      src="/images/blid-label.png"
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      style={{
        flexShrink: 0,
        display: "block",
        width,
        height,
        objectFit: "contain",
        background: "#FFFFFF",
        borderRadius: 4 * scale,
        padding: 2 * scale,
      }}
    />
  );
}

// Same shape as a real details id (24 hex characters) so the code is as dense as the one the
// customer will hold up, but not an id anyone has.
const EXAMPLE_CUSTOMER_ID = "0123456789abcdef01234567";

/** The QR code the customer shows from «Vis kunde-ID», drawn by the same component. */
function CustomerIdIllustration({ scale }: { scale: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        flexShrink: 0,
        display: "block",
        background: "#FFFFFF",
        borderRadius: 4 * scale,
        padding: 3 * scale,
        lineHeight: 0,
      }}
    >
      <QRCodeSVG value={EXAMPLE_CUSTOMER_ID} size={BASE_HEIGHT * scale} level="L" />
    </div>
  );
}

function BarcodeIllustration({ scale }: { scale: number }) {
  const totalModules = BAR_RUNS.reduce((sum, run) => sum + run, 0);
  const moduleWidth = (LABEL_WIDTH - QUIET_ZONE * 2) / totalModules;

  let cursor = QUIET_ZONE;
  const bars = [];
  for (const [index, run] of BAR_RUNS.entries()) {
    const x = cursor;
    cursor += run * moduleWidth;
    if (index % 2 !== 0) {
      continue;
    }
    const isGuard = GUARD_RUNS.has(index);
    bars.push(
      <rect
        key={index}
        x={x}
        y={BARS_TOP}
        width={run * moduleWidth}
        height={(isGuard ? GUARD_BOTTOM : BARS_BOTTOM) - BARS_TOP}
        fill="#111318"
      />,
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${LABEL_WIDTH} 60`}
      width={64 * scale}
      height={BASE_HEIGHT * scale}
      style={{ flexShrink: 0, display: "block" }}
    >
      <rect x={0} y={0} width={LABEL_WIDTH} height={60} rx={4} fill="#F7F7F4" />
      {bars}
      <text
        x={LABEL_WIDTH / 2}
        y={57}
        textAnchor="middle"
        fontSize={7}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        letterSpacing={0.4}
        fill="#111318"
      >
        9 788203 208119
      </text>
    </svg>
  );
}

/**
 * What a code of the given type looks like in the wild, so the employee knows what to hunt for:
 * the printed unique-ID sticker, the customer's QR code, or the book's EAN-13 barcode. Scale 1
 * fits a one-line hint; larger scales suit an empty state.
 */
export default function ScanCodeIllustration({
  type,
  scale = 1,
}: {
  type: ScanCodeType;
  scale?: number;
}) {
  switch (type) {
    case "blid": {
      return <BlidLabelIllustration scale={scale} />;
    }
    case "customerId": {
      return <CustomerIdIllustration scale={scale} />;
    }
    case "isbn": {
      return <BarcodeIllustration scale={scale} />;
    }
    default: {
      return null;
    }
  }
}
