import type { HttpContext } from "@adonisjs/core/http";

import Branch from "#models/branch";
import BranchItem from "#models/branch_item";
import { CartService } from "#services/cart_service";
import type { CartItem } from "#shared/cart_item";

/** The books a branch offers for ordering, grouped by subject and priced per option. */
export default class BranchCatalogController {
  async show(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const [branch, branchItems] = await Promise.all([
      Branch.find(branchId),
      BranchItem.forBranch(branchId).preload("item"),
    ]);
    if (branch === null) {
      // An unknown branch has nothing to offer; the page shows its "no subjects yet" notice.
      return {};
    }

    const subjectsMap = new Map<string, CartItem[]>();

    for (const branchItem of branchItems) {
      const options = CartService.getOptions(branchItem, branch, branchItem.item);
      if (options.length === 0) {
        continue;
      }
      for (const category of branchItem.categories) {
        const cartItems = subjectsMap.get(category) ?? [];
        cartItems.push({
          id: branchItem.item.id,
          title: branchItem.item.title,
          branchId,
          subject: category,
          options,
          selectedOptionIndex: 0,
        });
        subjectsMap.set(category, cartItems);
      }
    }
    return Object.fromEntries(subjectsMap);
  }
}
