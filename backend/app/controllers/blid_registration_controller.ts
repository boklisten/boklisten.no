import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import { BlidRegistrationService } from "#services/blid_registration_service";
import BlidService from "#services/blid_service";
import { PermissionService } from "#services/permission_service";
import type { BlidRegistrationResponse, LinkedBook } from "#shared/blid_registration";
import { blidRegistrationValidator } from "#validators/blid_registration";

/** The Merking page: link unique IDs to a book by ISBN. */
export default class BlidRegistrationController {
  /** Which book a blid is already linked to, or null. */
  async lookupLink(ctx: HttpContext): Promise<LinkedBook | null> {
    PermissionService.employeeOrFail(ctx);
    const blid = ctx.request.param("blid");
    if (!BlidService.isValidBlid(blid)) {
      throw new BadRequestException("Ugyldig unik ID");
    }
    return BlidRegistrationService.lookupLink(blid);
  }

  async register(ctx: HttpContext): Promise<BlidRegistrationResponse> {
    PermissionService.employeeOrFail(ctx);
    const { isbn, blids } = await ctx.request.validateUsing(blidRegistrationValidator);
    return BlidRegistrationService.register(isbn, blids);
  }
}
