import { belongsTo } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import { BranchSubjectBookSchema } from "#database/schema";
import BranchSubject from "#models/branch_subject";
import Item from "#models/item";
import type { BookListing } from "#shared/book-listing";

export default class BranchSubjectBook extends BranchSubjectBookSchema {
  @belongsTo(() => BranchSubject, { foreignKey: "branchSubjectId" })
  declare subject: BelongsTo<typeof BranchSubject>;

  @belongsTo(() => Item)
  declare item: BelongsTo<typeof Item>;

  /**
   * How the branch offers a title: the union of the options of every subject it is listed under,
   * or `null` when the branch does not list it.
   */
  static async listingAt(branchId: string, itemId: string): Promise<BookListing | null> {
    const books = await this.query()
      .where("itemId", itemId)
      .whereHas("subject", (subject) => subject.where("branchId", branchId));
    if (books.length === 0) {
      return null;
    }
    return {
      rent: books.some((book) => book.rent),
      partlyPayment: books.some((book) => book.partlyPayment),
      buy: books.some((book) => book.buy),
      rentAtBranch: books.some((book) => book.rentAtBranch),
      partlyPaymentAtBranch: books.some((book) => book.partlyPaymentAtBranch),
      buyAtBranch: books.some((book) => book.buyAtBranch),
    };
  }
}
