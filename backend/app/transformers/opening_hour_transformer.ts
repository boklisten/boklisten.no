import { BaseTransformer } from "@adonisjs/core/transformers";
import type OpeningHour from "#models/opening_hour";

export default class OpeningHourTransformer extends BaseTransformer<OpeningHour> {
  toObject() {
    return this.pick(this.resource, ["id", "branchId", "from", "to"]);
  }
}
