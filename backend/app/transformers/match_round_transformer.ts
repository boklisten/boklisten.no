import { BaseTransformer } from "@adonisjs/core/transformers";

import MatchRound from "#models/match_round";

export default class MatchRoundTransformer extends BaseTransformer<MatchRound> {
  toObject() {
    return {
      id: this.resource.id.toString(),
      ...this.pick(this.resource, ["name", "standLocation", "status", "generatedAt"]),
    };
  }
}
