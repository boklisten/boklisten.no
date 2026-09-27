import db from "@adonisjs/lucid/services/db";
import { beforeCreate, belongsTo } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import CustomerItem from "#models/customer_item";
import { assignObjectId } from "#models/helpers/object_id";
import Item from "#models/item";
import { UniqueItemSchema } from "#database/schema";

/**
 * The registry of blid stickers: which book (catalogue item) each unique ID sits on. One row per
 * sticker in circulation; the copies a customer holds are tracked by customer items carrying the
 * same blid.
 */
export default class UniqueItem extends UniqueItemSchema {
  static override selfAssignPrimaryKey = true;

  @belongsTo(() => Item)
  declare item: BelongsTo<typeof Item>;

  @beforeCreate()
  static assignId(uniqueItem: UniqueItem) {
    assignObjectId(uniqueItem);
  }

  /** The sticker with this exact blid (blids are case-sensitive), or null for a free sticker. */
  static async findByBlid(blid: string): Promise<UniqueItem | null> {
    return this.findBy("blid", blid);
  }

  /** The stickers among `blids` that are registered, each with its book loaded. */
  static async byBlidsWithItem(blids: Iterable<string>): Promise<UniqueItem[]> {
    const unique = [...new Set(blids)];
    if (unique.length === 0) {
      return [];
    }
    return this.query().whereIn("blid", unique).preload("item");
  }

  /** Which of the candidate blids are already taken by a sticker. */
  static async takenBlids(candidates: Iterable<string>): Promise<Set<string>> {
    const unique = [...new Set(candidates)];
    if (unique.length === 0) {
      return new Set();
    }
    const rows = await this.query().select("blid").whereIn("blid", unique);
    return new Set(rows.map((row) => row.blid));
  }

  /**
   * Every sticker whose blid contains the text, ignoring case, with the customer actively holding
   * it, in no particular order. Ranking happens in code (`rankBlidMatches`).
   *
   * @param text Alphanumeric text (the validator guarantees no LIKE metacharacters).
   */
  static async matching(
    text: string,
  ): Promise<{ blid: string; itemId: string; holderId: string | null }[]> {
    return db
      .from("unique_items")
      .whereILike("blid", `%${text}%`)
      .select(
        "blid",
        "item_id as itemId",
        CustomerItem.whereActive(db.from("customer_items"))
          .whereColumn("customer_items.blid", "unique_items.blid")
          .select("customer_id")
          .as("holderId"),
      );
  }
}
