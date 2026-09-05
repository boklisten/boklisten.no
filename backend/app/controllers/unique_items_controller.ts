import type { HttpContext } from "@adonisjs/core/http";

import { BlidRegistrationService } from "#services/blid_registration_service";
import { PermissionService } from "#services/permission_service";
import { uniqueItemsValidator } from "#validators/unique_item";

export default class UniqueItemsController {
  /**
   * Links one blid to a book, for the handout flow where an unlinked sticker turns up. A blid
   * already linked to that very book is fine; the handout carries on.
   */
  async add(ctx: HttpContext): Promise<{ feedback: string }> {
    PermissionService.employeeOrFail(ctx);
    const { blid, isbn } = await ctx.request.validateUsing(uniqueItemsValidator);

    const result = await BlidRegistrationService.register(isbn, [blid]);
    if (result.success) {
      return { feedback: "" };
    }
    const [conflict] = result.conflicts;
    return {
      feedback: conflict
        ? `Unik ID ${blid} er allerede koblet til «${conflict.linkedTo.title}».`
        : result.feedback,
    };
  }
}
