import { belongsTo } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import { MatchParticipantSchema } from "#database/schema";
import Match from "#models/match";

export default class MatchParticipant extends MatchParticipantSchema {
  @belongsTo(() => Match, { foreignKey: "matchId" })
  declare match: BelongsTo<typeof Match>;

  get isStand(): boolean {
    return this.userDetailId === null;
  }
}
