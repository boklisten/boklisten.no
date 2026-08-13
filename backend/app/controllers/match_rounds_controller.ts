import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";

import MatchRound from "#models/match_round";
import { generateRound } from "#services/matches/generate_round";
import { MatchRepository } from "#services/matches/match_repository";
import { PermissionService } from "#services/permission_service";
import { BlError } from "#shared/bl-error";
import MatchRoundTransformer from "#transformers/match_round_transformer";
import {
  PLAN_PATCH_KEYS,
  matchRoundCreateValidator,
  matchRoundPatchValidator,
} from "#validators/matches";

function roundIdParameter(ctx: HttpContext): number {
  const roundId = Number(ctx.request.param("id"));
  if (!Number.isInteger(roundId)) {
    throw new BlError("Ugyldig runde-ID").code(701);
  }
  return roundId;
}

export default class MatchRoundsController {
  async index(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);

    const [rounds, counts] = await Promise.all([
      MatchRound.query().orderBy("id", "desc"),
      MatchRepository.roundCounts(),
    ]);

    return ctx.serialize(MatchRoundTransformer.transform(rounds, counts));
  }

  private async serializeRound(ctx: HttpContext, round: MatchRound) {
    const counts = await MatchRepository.roundCounts(round.id);
    return ctx.serialize(MatchRoundTransformer.transform(round, counts));
  }

  /**
   * Plans a round. No matches are made here — an admin fills in the dates, times and book selection
   * first, looks the plan over, and generates from it as a separate, deliberate step.
   */
  async store(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const plan = await ctx.request.validateUsing(matchRoundCreateValidator);

    const round = await MatchRound.create({
      ...plan,
      deadline: DateTime.fromISO(plan.deadline),
      meetingDate: DateTime.fromISO(plan.meetingDate),
      status: "draft",
    });

    return this.serializeRound(ctx, round);
  }

  async update(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const patch = await ctx.request.validateUsing(matchRoundPatchValidator);
    if (Object.keys(patch).length === 0) {
      throw new BlError("No changes supplied").code(701);
    }

    const round = await MatchRound.findOrFail(roundIdParameter(ctx));
    const generated = round.generatedAt !== null;

    if (generated && PLAN_PATCH_KEYS.some((key) => patch[key] !== undefined)) {
      throw new BlError("Planen kan ikke endres når overleveringene er laget").code(200);
    }
    if (!generated && patch.status === "active") {
      throw new BlError("Runden må genereres før den kan bli synlig for elevene").code(200);
    }

    const { deadline, meetingDate, ...rest } = patch;
    await round
      .merge({
        ...rest,
        ...(deadline !== undefined && { deadline: DateTime.fromISO(deadline) }),
        ...(meetingDate !== undefined && { meetingDate: DateTime.fromISO(meetingDate) }),
      })
      .save();

    return this.serializeRound(ctx, round);
  }

  async generate(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const round = await MatchRound.findOrFail(roundIdParameter(ctx));
    return await generateRound(round);
  }

  async destroyMatches(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const round = await MatchRound.findOrFail(roundIdParameter(ctx));
    await MatchRepository.deleteMatches(round.id);
  }

  async destroy(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    await (await MatchRound.findOrFail(roundIdParameter(ctx))).delete();
  }
}
