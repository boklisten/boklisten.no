import type {
  ScanInstruction,
  ScanInstructionEntry,
} from "@/shared/components/scanner/ScanInstructionBlock";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

/** What is open on the Kasse page right now; resolved from the URL. */
export type KasseView = "empty" | "kunde" | "blid" | "innsamling";

/** The two codes the Kasse scans; every scanner on the page lets both through in every view. */
export type KasseScanType = "customerId" | "blid";
export const KASSE_ACCEPTS: ScanCodeType[] = ["customerId", "blid"];

/** The hero's one sentence in the empty view. */
export const KASSE_HERO_TEXT =
  "Skann kunde-ID for å åpne kunden, eller en bok for å se historikken.";

/** The segmented control in the camera: what the employee is about to scan. */
export const KASSE_SCAN_TYPES: { value: KasseScanType; label: string }[] = [
  { value: "customerId", label: "Kunde-ID" },
  { value: "blid", label: "Unik ID" },
];

const SCAN_ENTRIES: Record<KasseScanType, ScanInstructionEntry> = {
  customerId: { text: "Kunde-ID", illustrate: "customerId" },
  blid: { text: "Bokas unike ID", illustrate: "blid" },
};

/**
 * What the camera shows for the selected type; the scanner still accepts both. The other type
 * rides along as an alternative, so the picker under it never moves when the employee switches.
 */
export function scanInstructionFor(type: KasseScanType): ScanInstruction {
  const other: KasseScanType = type === "customerId" ? "blid" : "customerId";
  return { ...SCAN_ENTRIES[type], alternatives: [SCAN_ENTRIES[other]] };
}

export interface KasseViewConfig {
  /** The scan button, named after the view's usual scan. */
  scanLabel: string;
  /** Preselected in the camera, so the usual scan in this view needs no extra tap. */
  defaultScanType: KasseScanType;
}

/**
 * A customer ID opens the customer in every view. A book does what the open view does: with
 * nothing or a history open it opens the book's history, with a customer open it goes into the
 * cart, with the Innsamling open it goes into the batch. The camera preselects the code the view
 * usually expects; the other one works without switching.
 */
export const KASSE_VIEW_CONFIG: Record<KasseView, KasseViewConfig> = {
  empty: { scanLabel: "Skann kunde-ID", defaultScanType: "customerId" },
  blid: { scanLabel: "Skann bok", defaultScanType: "blid" },
  kunde: { scanLabel: "Skann bøker", defaultScanType: "blid" },
  innsamling: { scanLabel: "Skann bøker", defaultScanType: "blid" },
};
