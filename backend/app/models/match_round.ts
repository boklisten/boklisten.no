import { belongsTo, column, hasMany, manyToMany } from "@adonisjs/lucid/orm";
import type { BelongsTo, HasMany, ManyToMany } from "@adonisjs/lucid/types/relations";

import { MatchRoundSchema } from "#database/schema";
import Branch from "#models/branch";
import Match from "#models/match";
import User from "#models/user";

/** Postgres returns a `time` as `HH:MM:SS`; the round's times are on the minute, so `HH:MM`. */
const slotTime = { consume: (value: string) => value.slice(0, 5) };

export default class MatchRound extends MatchRoundSchema {
  declare userMatchLocations: string[];

  @column(slotTime)
  declare userMeetingFrom: string;
  @column(slotTime)
  declare userMeetingTo: string;
  @column(slotTime)
  declare standFrom: string;
  @column(slotTime)
  declare standTo: string;

  /** The branch the round was created on. The round covers it and every descendant. */
  @belongsTo(() => Branch)
  declare branch: BelongsTo<typeof Branch>;

  /** Descendants whose books (handed out or ordered there, subtree included) all go via the stand. */
  @manyToMany(() => Branch, {
    pivotTable: "match_round_stand_branches",
    pivotForeignKey: "round_id",
    pivotRelatedForeignKey: "branch_id",
  })
  declare standBranches: ManyToMany<typeof Branch>;

  /** Students who get no student matches: all their books go via the stand. */
  @manyToMany(() => User, {
    pivotTable: "match_round_stand_customers",
    pivotForeignKey: "round_id",
    pivotRelatedForeignKey: "customer_id",
  })
  declare standCustomers: ManyToMany<typeof User>;

  @hasMany(() => Match, { foreignKey: "roundId" })
  declare matches: HasMany<typeof Match>;
}
