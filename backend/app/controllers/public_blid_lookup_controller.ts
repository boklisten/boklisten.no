import type { HttpContext } from "@adonisjs/core/http";

import { PublicBlidLookupService } from "#services/public_blid_lookup_service";
import type { PublicBlidLookupResponse } from "#shared/public_blid_lookup";
import { publicBlidMissLimiter } from "#start/limiter";

export default class PublicBlidLookupController {
  async show(ctx: HttpContext): Promise<PublicBlidLookupResponse> {
    const user = ctx.auth.getUserOrFail();
    const opensAt = PublicBlidLookupService.opensAt(user.createdAt.toJSDate());
    if (opensAt !== null) {
      return { status: "notOpenYet", opensAt: opensAt.toISOString() };
    }
    return PublicBlidLookupService.guardedLookup(
      { detailsId: user.id, blid: ctx.request.param("blid") },
      publicBlidMissLimiter,
    );
  }
}
