import { beforeCreate, belongsTo } from "@adonisjs/lucid/orm";
import type { ModelQueryBuilderContract } from "@adonisjs/lucid/types/model";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import Branch from "#models/branch";
import { assignObjectId } from "#models/helpers/object_id";
import Item from "#models/item";
import { BranchItemSchema } from "#database/schema";

/**
 * A title a branch offers: how customers may order it online (`rent`, `partlyPayment`, `buy`),
 * how employees may hand it out at the branch (the `*AtBranch` flags), and the subjects it is
 * listed under in the branch's catalog. One row per (branch, item); see `shared/branch-item.ts`.
 */
export default class BranchItem extends BranchItemSchema {
  static override selfAssignPrimaryKey = true;

  /** Subject names, e.g. "Kjemi 2"; a Postgres `text[]`. */
  declare categories: string[];

  @belongsTo(() => Branch)
  declare branch: BelongsTo<typeof Branch>;

  @belongsTo(() => Item)
  declare item: BelongsTo<typeof Item>;

  @beforeCreate()
  static assignId(branchItem: BranchItem) {
    assignObjectId(branchItem);
  }

  /**
   * Every entry of a branch, in no particular order. A query, so callers that need the titles
   * chain `.preload("item")` before awaiting it.
   */
  static forBranch(branchId: string): ModelQueryBuilderContract<typeof BranchItem> {
    return this.query().where("branchId", branchId);
  }

  /** The branch's entry for a title, if the branch offers it. */
  static async findPair(branchId: string, itemId: string): Promise<BranchItem | null> {
    return this.query().where("branchId", branchId).where("itemId", itemId).first();
  }
}
