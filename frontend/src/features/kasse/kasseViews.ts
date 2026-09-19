import { STAND_CART_SCAN_TYPES } from "@/features/stand-cart/standCartScan";
import type { KnownScanCodeType } from "@/shared/components/scanner/TypedScannerPanel";

/** What is open on the Kasse page right now; resolved from the URL. */
export type KasseView = "empty" | "kunde" | "blid" | "innsamling";

/** The hero's one sentence in the empty view. */
export const KASSE_HERO_TEXT =
  "Skann kunde-ID for å åpne kunden, eller en bok for å se historikken.";

interface KasseViewConfig {
  /** The scan button, named after the view's usual scan. */
  scanLabel: string;
  /** Every code the view's scanners let through, in the picker's order. */
  scanTypes: KnownScanCodeType[];
  /** Preselected in the camera, so the usual scan in this view needs no extra tap. */
  defaultScanType: KnownScanCodeType;
}

const CUSTOMER_AND_STICKER: KnownScanCodeType[] = ["customerId", "blid"];

/**
 * A customer ID opens the customer in every view. A book does what the open view does: with
 * nothing or a history open it opens the book's history, with a customer open it goes into the
 * cart, with the Innsamling open it goes into the batch. With a customer open the scanners take
 * whatever the cart takes, so a code the cart learns to read works here without another change.
 * The camera preselects the code the view usually expects; the others work without switching.
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
    scanTypes: ["customerId", ...STAND_CART_SCAN_TYPES],
    defaultScanType: "blid",
  },
  innsamling: {
    scanLabel: "Skann bøker",
    scanTypes: CUSTOMER_AND_STICKER,
    defaultScanType: "blid",
  },
};
