import { BaseTransformer } from "@adonisjs/core/transformers";

import type Item from "#models/item";
import type { Item as ItemDto } from "#shared/item";

export default class ItemTransformer extends BaseTransformer<Item> {
  toObject(): ItemDto {
    return this.pick(this.resource, [
      "id",
      "title",
      "price",
      "isbn",
      "subject",
      "year",
      "weight",
      "distributor",
      "discount",
      "publisher",
      "active",
      "buyback",
      "priceHistory",
    ]);
  }
}
