import { BaseTransformer } from "@adonisjs/core/transformers";

import MatchRound from "#models/match_round";
import type { RoundCounts } from "#services/matches/match_repository";
import type { MatchRoundDto } from "#shared/match/match-round-dto";

const NOTHING_GENERATED: RoundCounts = { matches: 0, handovers: 0, locked: 0 };

export default class MatchRoundTransformer extends BaseTransformer<MatchRound> {
  private counts: Map<number, RoundCounts>;

  constructor(resource: MatchRound, counts: Map<number, RoundCounts>) {
    super(resource);
    this.counts = counts;
  }

  toObject(): MatchRoundDto {
    const { matches, handovers, locked } = this.counts.get(this.resource.id) ?? NOTHING_GENERATED;

    return {
      ...this.pick(this.resource, [
        "name",
        "status",
        "standLocation",
        "branches",
        "userMeetingFrom",
        "userMeetingTo",
        "standFrom",
        "standTo",
        "includeCustomerItemsFromOtherBranches",
        "userMatchLocations",
      ]),
      id: String(this.resource.id),
      // NOT NULL date columns holding real dates, so `toISODate` cannot fail here.
      deadline: this.resource.deadline.toISODate()!,
      meetingDate: this.resource.meetingDate.toISODate()!,
      generatedAt: this.resource.generatedAt?.toISO() ?? null,
      matchCount: matches,
      handoverCount: handovers,
      lockedCount: locked,
    };
  }
}
