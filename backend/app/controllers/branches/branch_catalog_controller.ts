import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import BranchSubject from "#models/branch_subject";
import { CartService } from "#services/cart_service";
import type { CartItem } from "#shared/cart_item";

/** The books a branch offers for ordering, grouped by subject and priced per option. */
export default class BranchCatalogController {
  async show(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const [branch, subjects] = await Promise.all([
      Branch.find(branchId),
      BranchSubject.query()
        .where("branchId", branchId)
        .preload("books", (books) => books.preload("item")),
    ]);
    if (branch === null || branch.visibility !== "public") {
      // Only public branches are orderable online; the page shows its "no subjects yet" notice.
      return {};
    }

    const subjectsMap = new Map<string, CartItem[]>();

    for (const subject of subjects) {
      const cartItems: CartItem[] = [];
      for (const book of subject.books) {
        const options = CartService.getOptions(book, branch, book.item);
        if (options.length === 0) {
          continue;
        }
        cartItems.push({
          id: book.item.id,
          title: book.item.title,
          isbn: book.item.isbn,
          branchId,
          subject: subject.name,
          options,
          selectedOptionIndex: 0,
        });
      }
      if (cartItems.length > 0) {
        subjectsMap.set(subject.name, cartItems);
      }
    }
    return Object.fromEntries(subjectsMap);
  }
}
