import type { HttpContext } from "@adonisjs/core/http";

import { BringService } from "#services/bring/bring_service";

export default class PostalCodesController {
  async show(ctx: HttpContext) {
    return BringService.lookupPostalCode(ctx.request.param("postalCode"));
  }
}
