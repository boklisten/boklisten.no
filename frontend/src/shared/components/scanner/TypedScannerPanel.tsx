import { SegmentedControl } from "@mantine/core";
import { useState } from "react";

import ScannerPanel from "@/shared/components/scanner/ScannerPanel";
import type { ScannerPanelProps } from "@/shared/components/scanner/ScannerPanel";
import type {
  ScanInstruction,
  ScanInstructionEntry,
} from "@/shared/components/scanner/ScanInstructionBlock";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

/** A code the camera can be told to look for; "unknown" is never something to scan. */
export type KnownScanCodeType = Exclude<ScanCodeType, "unknown">;

/** The picker's name for each code. */
const SCAN_TYPE_LABELS: Record<KnownScanCodeType, string> = {
  customerId: "Kunde-ID",
  blid: "Unik ID",
  isbn: "ISBN",
};

const SCAN_ENTRIES: Record<KnownScanCodeType, ScanInstructionEntry> = {
  customerId: { text: "Kunde-ID", illustrate: "customerId" },
  blid: { text: "Bokas unike ID", illustrate: "blid" },
  isbn: { text: "Bokas ISBN", illustrate: "isbn" },
};

/**
 * What the camera shows for the selected type; the scanner still accepts every type given. The
 * other types ride along as alternatives, so the picker under it never moves on a switch.
 */
function scanInstructionFor(type: KnownScanCodeType, types: KnownScanCodeType[]): ScanInstruction {
  return {
    ...SCAN_ENTRIES[type],
    alternatives: types.filter((other) => other !== type).map((other) => SCAN_ENTRIES[other]),
  };
}

/**
 * A camera that reads several kinds of code, with a segmented control in the scanner's dark strip
 * saying which one the employee is about to scan. The picker only drives the instruction; the
 * camera reads every type whatever it says, so nobody has to switch before scanning. Mount it
 * afresh (a key, or a modal that unmounts) to start on the default type again.
 */
export default function TypedScannerPanel({
  types,
  defaultType,
  ...panelProps
}: Omit<ScannerPanelProps, "accepts" | "instruction" | "instructionAddon"> & {
  /** Every code the camera reads, in the picker's order. */
  types: KnownScanCodeType[];
  /** Selected when the camera opens. */
  defaultType: KnownScanCodeType;
}) {
  const [type, setType] = useState(defaultType);
  return (
    <ScannerPanel
      {...panelProps}
      accepts={types}
      instruction={scanInstructionFor(type, types)}
      // In the dark strip with the instruction it drives, within thumb's reach on a phone
      instructionAddon={
        types.length > 1 ? (
          <SegmentedControl
            fullWidth
            size="sm"
            value={type}
            onChange={(value) =>
              setType(types.find((candidate) => candidate === value) ?? defaultType)
            }
            data={types.map((candidate) => ({
              value: candidate,
              label: SCAN_TYPE_LABELS[candidate],
            }))}
            // On the scanner's dark ground; the separators between the unselected entries would
            // read as a stray white line, so the indicator alone marks the choice
            withItemsBorders={false}
            styles={{
              root: { background: "rgba(255, 255, 255, 0.1)" },
              indicator: { background: "rgba(255, 255, 255, 0.22)", boxShadow: "none" },
              label: { color: "#FFFFFF" },
            }}
          />
        ) : undefined
      }
    />
  );
}
