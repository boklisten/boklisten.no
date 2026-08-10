import { belongsTo, hasMany } from "@adonisjs/lucid/orm";
import type { BelongsTo, HasMany } from "@adonisjs/lucid/types/relations";

import { MatchSchema } from "#database/schema";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";

export default class Match extends MatchSchema {
  @belongsTo(() => MatchRound, { foreignKey: "roundId" })
  declare round: BelongsTo<typeof MatchRound>;

  @hasMany(() => MatchParticipant, { foreignKey: "matchId" })
  declare participants: HasMany<typeof MatchParticipant>;

  @hasMany(() => MatchObligation, { foreignKey: "matchId" })
  declare obligations: HasMany<typeof MatchObligation>;
}
