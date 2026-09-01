import type { HttpContext } from "@adonisjs/core/http";

import { BringService } from "#services/bring/bring_service";

export default class PostalController {
  async lookupPostalCode(ctx: HttpContext) {
    return await BringService.lookupPostalCode(ctx.request.param("postalCode"));
  }
}
