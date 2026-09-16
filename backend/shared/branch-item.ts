/**
 * A title a branch offers. Rows live in Postgres `branch_items`; the model in
 * `app/models/branch_item.ts` satisfies this shape, and pure pricing code reads it.
 */
export interface BranchItem {
  id: string;
  branchId: string;
  itemId: string;

  rent: boolean; // customers may rent this title online
  partlyPayment: boolean; // customers may partly pay for this title online
  buy: boolean; // customers may buy this title online

  rentAtBranch: boolean; // employees may hand it out as a loan at the branch
  partlyPaymentAtBranch: boolean; // employees may hand it out on partly payment at the branch
  buyAtBranch: boolean; // employees may sell it at the branch

  /** The subjects the title is listed under in the branch's catalog, e.g. "Kjemi 2". */
  categories: string[];
}
