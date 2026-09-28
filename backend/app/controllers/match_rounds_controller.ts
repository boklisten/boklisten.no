import type { HttpContext } from "@adonisjs/core/http";
import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import MatchRound from "#models/match_round";
import { generateRound } from "#services/matches/generate_round";
import { getMatchesForRound } from "#services/matches/read_matches";
import { MatchRepository } from "#services/matches/match_repository";
import { roundPlanMetrics } from "#services/matches/round_plan_metrics";
import { assertStandRules } from "#services/matches/round_scope";
import { computeMatchStatistics } from "#services/matches/statistics";
import { BlError } from "#shared/bl-error";
import MatchRoundTransformer from "#transformers/match_round_transformer";
import {
  PLAN_PATCH_KEYS,
  matchRoundCreateValidator,
  matchRoundIndexValidator,
  matchRoundPatchValidator,
} from "#validators/matches";

function roundIdParameter(ctx: HttpContext): number {
  const roundId = Number(ctx.request.param("id"));
  if (!Number.isInteger(roundId)) {
    throw new BlError("Ugyldig runde-ID").code(701);
  }
  return roundId;
}

function withStandRules() {
  return MatchRound.query()
    .preload("standBranches", (branches) => branches.orderBy("name"))
    .preload("standCustomers", (customers) => customers.orderBy("name"));
}

export default class MatchRoundsController {
  async index(ctx: HttpContext) {
    const { branchId } = await ctx.request.validateUsing(matchRoundIndexValidator);
    const [rounds, counts] = await Promise.all([
      withStandRules().where("branchId", branchId).orderBy("id", "desc"),
      MatchRepository.roundCounts(),
    ]);

    return ctx.serialize(MatchRoundTransformer.transform(rounds, counts));
  }

  private async serializeRound(ctx: HttpContext, roundId: number) {
    const [round, counts] = await Promise.all([
      withStandRules().where("id", roundId).firstOrFail(),
      MatchRepository.roundCounts(roundId),
    ]);
    return ctx.serialize(MatchRoundTransformer.transform(round, counts));
  }

  /**
   * Plans a round. No matches are made here — an admin fills in the dates, times and book selection
   * first, looks the plan over, and generates from it as a separate, deliberate step.
   */
  async store(ctx: HttpContext) {
    const { standBranchIds, standCustomerIds, ...plan } =
      await ctx.request.validateUsing(matchRoundCreateValidator);
    await Branch.findOrFail(plan.branchId);
    await assertStandRules(plan.branchId, { standBranchIds, standCustomerIds });

    const round = await db.transaction(async (trx) => {
      const created = await MatchRound.create(
        {
          ...plan,
          deadline: DateTime.fromISO(plan.deadline),
          meetingDate: DateTime.fromISO(plan.meetingDate),
          status: "draft",
        },
        { client: trx },
      );
      await created.related("standBranches").attach(standBranchIds, trx);
      await created.related("standCustomers").attach(standCustomerIds, trx);
      return created;
    });

    return this.serializeRound(ctx, round.id);
  }

  async update(ctx: HttpContext) {
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

    const { deadline, meetingDate, standBranchIds, standCustomerIds, ...rest } = patch;
    await assertStandRules(round.branchId, { standBranchIds, standCustomerIds });
    await db.transaction(async (trx) => {
      round.useTransaction(trx);
      await round
        .merge({
          ...rest,
          ...(deadline !== undefined && { deadline: DateTime.fromISO(deadline) }),
          ...(meetingDate !== undefined && { meetingDate: DateTime.fromISO(meetingDate) }),
        })
        .save();
      if (standBranchIds !== undefined) {
        await round.related("standBranches").sync(standBranchIds, true, trx);
      }
      if (standCustomerIds !== undefined) {
        await round.related("standCustomers").sync(standCustomerIds, true, trx);
      }
    });

    return this.serializeRound(ctx, round.id);
  }

  async matches(ctx: HttpContext) {
    return ctx.serialize(await getMatchesForRound(roundIdParameter(ctx)));
  }

  async statistics(ctx: HttpContext) {
    return ctx.serialize(await computeMatchStatistics(roundIdParameter(ctx)));
  }

  async planMetrics(ctx: HttpContext) {
    const round = await MatchRound.findOrFail(roundIdParameter(ctx));
    return ctx.serialize(await roundPlanMetrics(round));
  }

  async generate(ctx: HttpContext) {
    const round = await MatchRound.findOrFail(roundIdParameter(ctx));
    return generateRound(round);
  }

  async destroyMatches(ctx: HttpContext) {
    const round = await MatchRound.findOrFail(roundIdParameter(ctx));
    await MatchRepository.deleteMatches(round.id);
  }

  async destroy(ctx: HttpContext) {
    await (await MatchRound.findOrFail(roundIdParameter(ctx))).delete();
  }
}
