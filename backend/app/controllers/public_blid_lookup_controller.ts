import type { HttpContext } from "@adonisjs/core/http";

import { PublicBlidLookupService } from "#services/public_blid_lookup_service";
import type { PublicBlidLookupResponse } from "#shared/public_blid_lookup";
import { publicBlidMissLimiter } from "#start/limiter";

export default class PublicBlidLookupController {
  async show(ctx: HttpContext): Promise<PublicBlidLookupResponse> {
    const user = ctx.auth.getUserOrFail();
    // Vipps ties the account to one verified person, so the daily cap cannot be multiplied with
    // throwaway accounts and every lookup has someone accountable behind it.
    if (user.vippsUserId === null) {
      return { status: "vippsRequired" };
    }
    return PublicBlidLookupService.guardedLookup(
      { userId: user.id, blid: ctx.request.param("blid") },
      publicBlidMissLimiter,
    );
  }
}
