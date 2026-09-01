import type { BlDocument } from "#shared/bl-document";

export interface BranchItem extends BlDocument {
  branch: string;
  item: string;

  rent?: boolean; // possible to rent this item in webstore
  sell?: boolean; // possible to sell this item in webstore
  buy?: boolean; // possible to buy this item in webstore
  partlyPayment?: boolean; // possible to partly pay this item in webstore
  live?: boolean; // is this item live in webstore

  rentAtBranch?: boolean; // is it possible to rent item in bladmin
  sellAtBranch?: boolean; // is it possible to sell item in bladmin
  buyAtBranch?: boolean; // is it possible to buy item in bladmin
  partlyPaymentAtBranch?: boolean; // is it possible to partly pay item in bladmin
  liveAtBranch?: boolean; // is this item live at branch

  active?: boolean;
  categories?: string[];
}
