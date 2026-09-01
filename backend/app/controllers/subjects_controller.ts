import type { HttpContext } from "@adonisjs/core/http";

import { CartService } from "#services/cart_service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import type { CartItem } from "#shared/cart_item";

export default class SubjectsController {
  async getBranchSubjects(ctx: HttpContext) {
    const branchId = ctx.request.param("branchId");
    const databaseQuery = new SEDbQuery();
    databaseQuery.objectIdFilters = [{ fieldName: "branch", value: branchId }];
    const branchItems = (await StorageService.BranchItems.getByQueryOrNull(databaseQuery)) ?? [];

    const subjectsMap = new Map<string, CartItem[]>();

    for (const branchItem of branchItems) {
      const [item, options] = await Promise.all([
        StorageService.Items.get(branchItem.item),
        CartService.getOptions(branchItem),
      ]);
      const selectedOption = options[0];
      if (!selectedOption) {
        continue;
      }
      for (const category of branchItem.categories) {
        const cartItems = subjectsMap.get(category) ?? [];
        subjectsMap.set(category, [
          ...cartItems,
          {
            id: item.id,
            title: item.title,
            branchId,
            subject: category,
            options,
            selectedOptionIndex: 0,
          },
        ]);
      }
    }
    return Object.fromEntries(subjectsMap);
  }
}
