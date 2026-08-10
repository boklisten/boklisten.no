import { belongsTo } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import { MatchObligationSchema } from "#database/schema";
import Match from "#models/match";
import MatchParticipant from "#models/match_participant";

export default class MatchObligation extends MatchObligationSchema {
  @belongsTo(() => Match, { foreignKey: "matchId" })
  declare match: BelongsTo<typeof Match>;

  @belongsTo(() => MatchParticipant, { foreignKey: "senderParticipantId" })
  declare sender: BelongsTo<typeof MatchParticipant>;

  @belongsTo(() => MatchParticipant, { foreignKey: "receiverParticipantId" })
  declare receiver: BelongsTo<typeof MatchParticipant>;
}
