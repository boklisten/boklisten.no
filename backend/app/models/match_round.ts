import { hasMany } from "@adonisjs/lucid/orm";
import type { HasMany } from "@adonisjs/lucid/types/relations";

import { MatchRoundSchema } from "#database/schema";
import Match from "#models/match";

export default class MatchRound extends MatchRoundSchema {
  declare branches: string[];
  declare userMatchLocations: string[];
  declare excludedCustomerIds: string[];

  @hasMany(() => Match, { foreignKey: "roundId" })
  declare matches: HasMany<typeof Match>;
}
