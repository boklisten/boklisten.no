import type { HttpContext } from "@adonisjs/core/http";

import {
  getMatchById,
  getMatchesForCustomer as readMatchesForCustomer,
  getMatchesForRound,
} from "#services/matches/read_matches";
import { notify } from "#services/matches/notify_round";
import { recordTransfer } from "#services/matches/record_transfer";
import { sendMatchToStand } from "#services/matches/send_to_stand";
import { PermissionService } from "#services/permission_service";
import { BlError } from "#shared/bl-error";
import { USER_PERMISSION } from "#shared/user-permission";
import { matchNotifyValidator, matchTransferValidator } from "#validators/matches";

export default class MatchesController {
  async notify(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.ADMIN);
    const matchNotifyConfiguration = await ctx.request.validateUsing(matchNotifyValidator);
    return await notify(matchNotifyConfiguration);
  }

  async getMyMatches(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    return ctx.serialize(await readMatchesForCustomer(detailsId));
  }

  /** Employee-facing: the matches of a given customer, used by the rapid handout stand view. */
  async getMatchesForCustomer(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.EMPLOYEE);
    return ctx.serialize(await readMatchesForCustomer(ctx.request.param("customerId")));
  }

  /** Every match in the newest round. */
  async getAllMatches(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.EMPLOYEE);
    return ctx.serialize(await getMatchesForRound());
  }

  async getMatchesForRound(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.EMPLOYEE);
    const roundId = Number(ctx.request.param("roundId"));
    if (!Number.isInteger(roundId)) {
      throw new BlError("Ugyldig runde-ID").code(701);
    }
    return ctx.serialize(await getMatchesForRound(roundId));
  }

  async getMatchById(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.EMPLOYEE);
    const matchId = Number(ctx.request.param("matchId"));
    if (!Number.isInteger(matchId)) {
      throw new BlError("Ugyldig overlevering-ID").code(701);
    }
    return ctx.serialize(await getMatchById(matchId));
  }

  async sendToStand(ctx: HttpContext) {
    PermissionService.authenticate(ctx, USER_PERMISSION.ADMIN);
    const matchId = Number(ctx.request.param("matchId"));
    if (!Number.isInteger(matchId)) {
      throw new BlError("Ugyldig overlevering-ID").code(701);
    }
    await sendMatchToStand(matchId);
    return { sentToStand: true };
  }

  async transferItem(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    const transferData = await ctx.request.validateUsing(matchTransferValidator);
    return await recordTransfer(detailsId, transferData);
  }
}
