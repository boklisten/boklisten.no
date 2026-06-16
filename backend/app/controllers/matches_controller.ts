import type { HttpContext } from "@adonisjs/core/http";

import { generateMatches } from "#services/match_helpers/generate";
import { getMatches } from "#services/match_helpers/get_my_matches";
import { lock } from "#services/match_helpers/lock";
import { notify } from "#services/match_helpers/notify";
import { transfer } from "#services/match_helpers/transfer";
import { PermissionService } from "#services/permission_service";
import { USER_PERMISSION } from "#shared/user-permission";
import {
  matchGenerateValidator,
  matchLockValidator,
  matchNotifyValidator,
  matchTransferValidator,
} from "#validators/matches";

export default class MatchesController {
  async generate(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.ADMIN);
    const matchConfiguration = await ctx.request.validateUsing(matchGenerateValidator);
    return await generateMatches(matchConfiguration);
  }

  async notify(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.ADMIN);
    const matchNotifyConfiguration = await ctx.request.validateUsing(matchNotifyValidator);
    return await notify(matchNotifyConfiguration);
  }

  async lock(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.EMPLOYEE);
    const matchLockData = await ctx.request.validateUsing(matchLockValidator);
    return await lock(matchLockData);
  }

  async getMyMatches(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);

    return await getMatches(detailsId);
  }

  /** Employee-facing: the matches of a given customer, used by the rapid handout stand view. */
  async getMatchesForCustomer(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.EMPLOYEE);
    const customerId = ctx.request.param("customerId");
    return await getMatches(customerId);
  }

  async transferItem(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const transferData = await ctx.request.validateUsing(matchTransferValidator);
    return await transfer(detailsId, transferData);
  }
}
