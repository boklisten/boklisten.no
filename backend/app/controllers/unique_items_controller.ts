import type { HttpContext } from "@adonisjs/core/http";

import { findItemByIsbn, findUniqueItemByBlid } from "#services/item_lookup";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { uniqueItemsValidator } from "#validators/unique_item";

export default class UniqueItemsController {
  async add(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { blid, isbn } = await ctx.request.validateUsing(uniqueItemsValidator);

    const alreadyConnected = await findUniqueItemByBlid(blid);
    if (alreadyConnected) {
      return {
        feedback: `Unik ID ${blid} er allerede koblet til «${alreadyConnected.title}».`,
      };
    }

    const item = await findItemByIsbn(isbn);
    if (!item) {
      return { feedback: `Fant ingen bok med ISBN ${isbn}.` };
    }

    await StorageService.UniqueItems.add({ blid, item: item.id, title: item.title });
    return { feedback: "" };
  }
}
