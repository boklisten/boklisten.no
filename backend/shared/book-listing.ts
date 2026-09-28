/**
 * How a branch offers a title it lists. Rows live in Postgres `branch_subject_books`, one per
 * (subject, title); the model in `app/models/branch_subject_book.ts` satisfies this shape, and a
 * title listed under several subjects is offered at the branch with the union of their options
 * (`BranchSubjectBook.listingAt`). Pure pricing code reads it.
 */
export interface BookListing {
  rent: boolean; // customers may rent this title online
  partlyPayment: boolean; // customers may partly pay for this title online
  buy: boolean; // customers may buy this title online

  rentAtBranch: boolean; // employees may hand it out as a loan at the branch
  partlyPaymentAtBranch: boolean; // employees may hand it out on partly payment at the branch
  buyAtBranch: boolean; // employees may sell it at the branch
}
