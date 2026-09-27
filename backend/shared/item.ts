/** A title in the book catalogue (`items`). */
export interface Item {
  id: string;
  title: string;
  /** Current price in whole NOK. */
  price: number;
  isbn: number;
  subject: string;
  /** Year of publication. */
  year: number;
  /** Kilograms; null when unknown. */
  weight: number | null;
  distributor: string;
  /** Fraction between 0 and 1. */
  discount: number;
  publisher: string;
  /** Inactive titles are hidden from customers. */
  active: boolean;
  /** Whether the stand buys used copies of this title. */
  buyback: boolean;
  /** The price each calendar year, keyed by the year. */
  priceHistory: Record<string, number>;
}
