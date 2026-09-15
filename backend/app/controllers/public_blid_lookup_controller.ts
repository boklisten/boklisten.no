import type { HttpContext } from "@adonisjs/core/http";

import { PublicBlidLookupService } from "#services/public_blid_lookup_service";
import { StorageService } from "#services/storage_service";
import type { PublicBlidLookupResponse } from "#shared/public_blid_lookup";
import { publicBlidMissLimiter } from "#start/limiter";

export default class PublicBlidLookupController {
  async show(ctx: HttpContext): Promise<PublicBlidLookupResponse> {
    const { detailsId } = ctx.authUser;
    const userDetail = await StorageService.UserDetails.get(detailsId);
    const opensAt = PublicBlidLookupService.opensAt(userDetail.creationTime);
    if (opensAt !== null) {
      return { status: "notOpenYet", opensAt: opensAt.toISOString() };
    }
    return PublicBlidLookupService.guardedLookup(
      { detailsId, blid: ctx.request.param("blid") },
      publicBlidMissLimiter,
    );
  }
}
