import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * The order manager lists placed orders newest first and stops once it has a page of open ones.
 * The orders collection only had indexes on `_id` and `branch`, so that walk scanned the whole
 * collection. Production runs without autoIndex, so the index the schema declares is created here.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // The index only speeds reads; dropping it on rollback would slow the legacy list for nothing.
  }
}
