import { belongsTo } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import { BookHandoverSchema } from "#database/schema";
import MatchObligation from "#models/match_obligation";

export default class BookHandover extends BookHandoverSchema {
  @belongsTo(() => MatchObligation, { foreignKey: "dischargesSenderObligationId" })
  declare senderObligation: BelongsTo<typeof MatchObligation>;

  @belongsTo(() => MatchObligation, { foreignKey: "dischargesReceiverObligationId" })
  declare receiverObligation: BelongsTo<typeof MatchObligation>;
}
