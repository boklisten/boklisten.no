import type { HttpContext } from "@adonisjs/core/http";

import {
  getMatchById,
  getMatchesForCustomer as readMatchesForCustomer,
} from "#services/matches/read_matches";
import { notify } from "#services/matches/notify_round";
import { recordTransfer } from "#services/matches/record_transfer";
import { sendMatchToStand } from "#services/matches/send_to_stand";
import { BlError } from "#shared/bl-error";
import { matchNotifyValidator, matchTransferValidator } from "#validators/matches";

export default class MatchesController {
  async notify(ctx: HttpContext) {
    const { detailsId } = ctx.authUser;
    const matchNotifyConfiguration = await ctx.request.validateUsing(matchNotifyValidator);
    return notify(matchNotifyConfiguration, detailsId);
  }

  async me(ctx: HttpContext) {
    return ctx.serialize(await readMatchesForCustomer(ctx.authUser.detailsId));
  }

  /** Employee-facing: the matches of a given customer, used by the customer search stand view. */
  async forCustomer(ctx: HttpContext) {
    return ctx.serialize(await readMatchesForCustomer(ctx.request.param("detailsId")));
  }

  async show(ctx: HttpContext) {
    const matchId = Number(ctx.request.param("matchId"));
    if (!Number.isInteger(matchId)) {
      throw new BlError("Ugyldig overlevering-ID").code(701);
    }
    return ctx.serialize(await getMatchById(matchId));
  }

  async sendToStand(ctx: HttpContext) {
    const matchId = Number(ctx.request.param("matchId"));
    if (!Number.isInteger(matchId)) {
      throw new BlError("Ugyldig overlevering-ID").code(701);
    }
    await sendMatchToStand(matchId);
    return { sentToStand: true };
  }

  async transferItem(ctx: HttpContext) {
    const { detailsId } = ctx.authUser;
    const transferData = await ctx.request.validateUsing(matchTransferValidator);
    return recordTransfer(detailsId, transferData);
  }
}
