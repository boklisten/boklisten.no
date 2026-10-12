import type { HttpContext } from "@adonisjs/core/http";

import { customerIdInScope } from "#controllers/helpers/scope";
import NotFoundException from "#exceptions/not_found_exception";
import Match from "#models/match";
import MatchRound from "#models/match_round";
import { BranchScope } from "#services/branch_scope";
import {
  getMatchById,
  getMatchesForCustomer as readMatchesForCustomer,
} from "#services/matches/read_matches";
import { notify } from "#services/matches/notify_round";
import { recordTransfer } from "#services/matches/record_transfer";
import { sendMatchToStand } from "#services/matches/send_to_stand";
import { BlError } from "#shared/bl-error";
import { matchNotifyValidator, matchTransferValidator } from "#validators/matches";

/**
 * Whether the caller may reach the match: through its round's branch, which must be in their
 * scope. An unknown match is "in scope" so the service answers it the way it always has.
 */
async function matchInScope(ctx: HttpContext, matchId: number): Promise<boolean> {
  const match = await Match.query().where("id", matchId).preload("round").first();
  return match === null || BranchScope.placeInScope(ctx.auth.getUserOrFail(), match.round.branchId);
}

function matchIdParameter(ctx: HttpContext): number {
  const matchId = Number(ctx.request.param("matchId"));
  if (!Number.isInteger(matchId)) {
    throw new BlError("Ugyldig overlevering-ID").code(701);
  }
  return matchId;
}

export default class MatchesController {
  async notify(ctx: HttpContext) {
    const { id: userId } = ctx.auth.getUserOrFail();
    const matchNotifyConfiguration = await ctx.request.validateUsing(matchNotifyValidator);
    const round = await MatchRound.find(matchNotifyConfiguration.roundId);
    if (round !== null) {
      await BranchScope.assertSelectable(ctx.auth.getUserOrFail(), round.branchId);
    }
    return notify(matchNotifyConfiguration, userId);
  }

  async me(ctx: HttpContext) {
    return ctx.serialize(await readMatchesForCustomer(ctx.auth.getUserOrFail().id));
  }

  /** Employee-facing: the matches of a given customer, used by the customer search stand view. */
  async forCustomer(ctx: HttpContext) {
    return ctx.serialize(await readMatchesForCustomer(await customerIdInScope(ctx)));
  }

  /** The match, or null for an unknown one; a match outside the caller's scope is unknown too. */
  async show(ctx: HttpContext) {
    const matchId = matchIdParameter(ctx);
    if (!(await matchInScope(ctx, matchId))) {
      return ctx.serialize(null);
    }
    return ctx.serialize(await getMatchById(matchId));
  }

  async sendToStand(ctx: HttpContext) {
    const matchId = matchIdParameter(ctx);
    if (!(await matchInScope(ctx, matchId))) {
      throw new NotFoundException("Fant ikke overleveringen");
    }
    await sendMatchToStand(matchId);
    return { sentToStand: true };
  }

  async transferItem(ctx: HttpContext) {
    const { id: userId } = ctx.auth.getUserOrFail();
    const transferData = await ctx.request.validateUsing(matchTransferValidator);
    return recordTransfer(userId, transferData);
  }
}
