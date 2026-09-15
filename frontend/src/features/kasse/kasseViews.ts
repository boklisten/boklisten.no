import type {
  ScanInstruction,
  ScanInstructionEntry,
} from "@/shared/components/scanner/ScanInstructionBlock";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

/** What is open on the Kasse page right now; resolved from the URL. */
export type KasseView = "empty" | "kunde" | "blid" | "innsamling";

/**
 * The codes the Kasse scans. A customer ID and a sticker work in every view; the ISBN only with a
 * customer open, where a book without a sticker goes into the cart to be sold or bought.
 */
export type KasseScanType = Extract<ScanCodeType, "customerId" | "blid" | "isbn">;

/** The hero's one sentence in the empty view. */
export const KASSE_HERO_TEXT =
  "Skann kunde-ID for å åpne kunden, eller en bok for å se historikken.";

/** The picker's name for each code, in the camera. */
const SCAN_TYPE_LABELS: Record<KasseScanType, string> = {
  customerId: "Kunde-ID",
  blid: "Unik ID",
  isbn: "ISBN",
};

const SCAN_ENTRIES: Record<KasseScanType, ScanInstructionEntry> = {
  customerId: { text: "Kunde-ID", illustrate: "customerId" },
  blid: { text: "Bokas unike ID", illustrate: "blid" },
  isbn: { text: "Bokas ISBN", illustrate: "isbn" },
};

/** The segmented control in the camera: what the employee is about to scan, among the view's codes. */
export function scanTypePickerData(
  types: KasseScanType[],
): { value: KasseScanType; label: string }[] {
  return types.map((type) => ({ value: type, label: SCAN_TYPE_LABELS[type] }));
}

/**
 * What the camera shows for the selected type; the scanner still accepts every code of the view.
 * The other types ride along as alternatives, so the picker under it never moves when the
 * employee switches.
 */
export function scanInstructionFor(type: KasseScanType, types: KasseScanType[]): ScanInstruction {
  return {
    ...SCAN_ENTRIES[type],
    alternatives: types.filter((other) => other !== type).map((other) => SCAN_ENTRIES[other]),
  };
}

export interface KasseViewConfig {
  /** The scan button, named after the view's usual scan. */
  scanLabel: string;
  /** Every code the view's scanners let through, in the picker's order. */
  scanTypes: KasseScanType[];
  /** Preselected in the camera, so the usual scan in this view needs no extra tap. */
  defaultScanType: KasseScanType;
}

const CUSTOMER_AND_STICKER: KasseScanType[] = ["customerId", "blid"];

/**
 * A customer ID opens the customer in every view. A book does what the open view does: with
 * nothing or a history open it opens the book's history, with a customer open it goes into the
 * cart, with the Innsamling open it goes into the batch. A bare ISBN is a book without a sticker,
 * which only the cart has a use for. The camera preselects the code the view usually expects;
 * the others work without switching.
 */
export const KASSE_VIEW_CONFIG: Record<KasseView, KasseViewConfig> = {
  empty: {
    scanLabel: "Skann kunde-ID",
    scanTypes: CUSTOMER_AND_STICKER,
    defaultScanType: "customerId",
  },
  blid: { scanLabel: "Skann bok", scanTypes: CUSTOMER_AND_STICKER, defaultScanType: "blid" },
  kunde: {
    scanLabel: "Skann bøker",
    scanTypes: ["customerId", "blid", "isbn"],
    defaultScanType: "blid",
  },
  innsamling: {
    scanLabel: "Skann bøker",
    scanTypes: CUSTOMER_AND_STICKER,
    defaultScanType: "blid",
  },
};
