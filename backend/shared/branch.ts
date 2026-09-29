import type { InheritedBranchField } from "#shared/branch-inheritance";
import type { BranchVisibility } from "#shared/branch-visibility";
import type { Period } from "#shared/period";

export const BRANCH_TYPES = ["vgs", "privatist"] as const;
/** Which set of payment periods applies: VGS branches rent books, privatist branches sell them in instalments. */
export type BranchType = (typeof BRANCH_TYPES)[number];

/** A deadline a VGS branch's books may be rented until. */
export interface RentPeriod {
  type: Period;
  /** `YYYY-MM-DD`. */
  date: string;
  /** How many periods of this type one book may be rented. */
  maxNumberOfPeriods: number;
  /** Fraction of the item price the rent costs. */
  percentage: number;
}

/** A deadline a rented book may be extended to. */
export interface ExtendPeriod {
  type: Period;
  /** `YYYY-MM-DD`. */
  date: string;
  /** How many periods of this type one book may be extended. */
  maxNumberOfPeriods: number;
  /** Price of the extension in whole NOK. */
  price: number;
  /** If set, the extension costs this fraction of the item price instead. */
  percentage: number | null;
}

/** A deadline a privatist branch's books are paid in instalments until. */
export interface PartlyPaymentPeriod {
  type: Period;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Fraction of the item price the customer pays to buy the book out. */
  percentageBuyout: number;
  /** Fraction of the item price the customer pays up front. */
  percentageUpFront: number;
}

/** The three period lists of a branch, as the API and the payment form address them. */
export interface BranchPeriods {
  rentPeriods: RentPeriod[];
  extendPeriods: ExtendPeriod[];
  partlyPaymentPeriods: PartlyPaymentPeriod[];
}

/**
 * A school, one of its year groups or classes, a privatist school or the web shop. Rows live in
 * `branches`, periods in `branch_periods`.
 */
export interface Branch extends BranchPeriods {
  id: string;
  /** The fully qualified name, e.g. "Ullern videregående skole VG1". */
  name: string;
  /** URL of the logo. */
  logo: string | null;
  type: BranchType | null;
  /** The branch this one belongs to in the tree, e.g. the school of a year group. */
  parentBranchId: string | null;
  /** The name relative to the parent, e.g. "VG1". */
  localName: string | null;
  /** What this branch's children represent, e.g. "klasse". */
  childLabel: string | null;
  /**
   * Who sees the branch; only `public` branches are orderable online. Inherited, like the four
   * flags and the two percentages below: each is the value in force, and `overrides` says which
   * the branch sets itself (see `shared/branch-inheritance.ts`).
   */
  visibility: BranchVisibility;
  /** The branch pays for the books instead of the customer. */
  paymentResponsible: boolean;
  /** The branch pays for postal delivery. */
  responsibleForDelivery: boolean;
  /** Fraction of the item price the customer pays to buy out a rented book. */
  buyoutPercentage: number;
  /** Fraction of the item price the branch pays when buying a book back. */
  sellPercentage: number;
  deliveryAtBranch: boolean;
  deliveryByMail: boolean;
  /** What the branch sets itself per inherited field; `null` where it inherits from its parent. */
  overrides: InheritedOverrides;
  /** Free text, e.g. "Oslo"; groups branches in the order flow's branch picker. */
  region: string;
  address: string | null;
}

/** The values in force of the inherited fields. */
export type InheritedValues = Pick<Branch, InheritedBranchField>;

/** A branch's own value per inherited field, `null` where it inherits. A root never holds `null`. */
export type InheritedOverrides = { [K in InheritedBranchField]: Branch[K] | null };
