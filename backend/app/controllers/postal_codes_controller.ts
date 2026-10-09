import type { HttpContext } from "@adonisjs/core/http";

import { BringService } from "#services/bring/bring_service";

export default class PostalCodesController {
  async show(ctx: HttpContext) {
    const cityOf = await BringService.postalCities();
    return cityOf(ctx.request.param("postalCode"));
  }
}
