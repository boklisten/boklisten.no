import { BaseTransformer } from "@adonisjs/core/transformers";

import type MatchRound from "#models/match_round";
import type { RoundCounts } from "#services/matches/match_repository";
import type { MatchRoundDto } from "#shared/match/match-round-dto";

const NOTHING_GENERATED: RoundCounts = { matches: 0, handovers: 0 };

export default class MatchRoundTransformer extends BaseTransformer<MatchRound> {
  private readonly counts: Map<number, RoundCounts>;

  constructor(resource: MatchRound, counts: Map<number, RoundCounts>) {
    super(resource);
    this.counts = counts;
  }

  toObject(): MatchRoundDto {
    const { matches, handovers } = this.counts.get(this.resource.id) ?? NOTHING_GENERATED;

    return {
      ...this.pick(this.resource, [
        "name",
        "status",
        "standLocation",
        "branchId",
        "userMeetingFrom",
        "userMeetingTo",
        "standFrom",
        "standTo",
        "userMatchLocations",
      ]),
      // Preloaded by the controller, which is the only caller.
      standBranchIds: this.resource.standBranches.map((branch) => branch.id),
      standCustomerIds: this.resource.standCustomers.map((customer) => customer.id),
      id: String(this.resource.id),
      // NOT NULL date columns holding real dates, so `toISODate` cannot fail here.
      deadline: this.resource.deadline.toISODate()!,
      meetingDate: this.resource.meetingDate.toISODate()!,
      generatedAt: this.resource.generatedAt?.toISO() ?? null,
      matchCount: matches,
      handoverCount: handovers,
    };
  }
}
