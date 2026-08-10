import type { HttpContext } from "@adonisjs/core/http";

import MatchRound from "#models/match_round";
import { PermissionService } from "#services/permission_service";
import { BlError } from "#shared/bl-error";
import MatchRoundTransformer from "#transformers/match_round_transformer";
import { matchRoundPatchValidator } from "#validators/matches";

export default class MatchRoundsController {
  async index(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return ctx.serialize(
      MatchRoundTransformer.transform(await MatchRound.query().orderBy("id", "desc")),
    );
  }

  async update(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { name, status } = await ctx.request.validateUsing(matchRoundPatchValidator);
    if (name === undefined && status === undefined) {
      throw new BlError("No changes supplied").code(701);
    }

    const roundId = Number(ctx.request.param("id"));
    if (!Number.isInteger(roundId)) {
      throw new BlError("Ugyldig runde-ID").code(701);
    }
    const round = await MatchRound.findOrFail(roundId);
    await round
      .merge({ ...(name !== undefined && { name }), ...(status !== undefined && { status }) })
      .save();

    return ctx.serialize(MatchRoundTransformer.transform(round));
  }

  async destroy(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const roundId = Number(ctx.request.param("id"));
    if (!Number.isInteger(roundId)) {
      throw new BlError("Ugyldig runde-ID").code(701);
    }
    await (await MatchRound.findOrFail(roundId)).delete();
  }
}
