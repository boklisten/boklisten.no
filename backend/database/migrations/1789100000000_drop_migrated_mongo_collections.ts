import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Step 0 of the MongoDB → Postgres migration. `messages`, `signatures`, `stand_matches` and
 * `user_matches` were all moved to Postgres by earlier migrations, which also dropped the Mongo
 * collections. Yet the nightly "Copy Mongo to Staging" job, which restores whatever production
 * holds, still brings all four back to staging with their full historic document counts, so
 * production has them. Whether the production drops never ran or the collections were recreated
 * afterwards is not known; this migration simply drops them again wherever it runs, tolerating
 * collections that are already gone.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // The data lives in Postgres; there is nothing to restore in Mongo.
  }
}
