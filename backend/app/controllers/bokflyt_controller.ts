import type { HttpContext } from "@adonisjs/core/http";

import { BokflytContactService } from "#services/bokflyt_contact_service";
import { bokflytContactValidator } from "#validators/bokflyt";

export default class BokflytController {
  async contact(ctx: HttpContext) {
    const request = await ctx.request.validateUsing(bokflytContactValidator);
    await BokflytContactService.send(request);
    return { received: true };
  }
}
