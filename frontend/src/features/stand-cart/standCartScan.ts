import type { ScanCodeType } from "@/shared/utils/scanCodes";

/** A code that can put a book in the cart: a sticker, or the ISBN of a book without one. */
export type StandCartScanType = Extract<ScanCodeType, "blid" | "isbn">;

/**
 * Every code a cart reads, outside a link step. The one list every scanner that feeds a cart is
 * built from, so a new code is added here and nowhere else.
 */
export const STAND_CART_SCAN_TYPES: StandCartScanType[] = ["blid", "isbn"];
