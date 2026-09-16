import { BaseSchema } from "@adonisjs/lucid/schema";

import { dropCollection, withMongo } from "#database/helpers/mongo_transfer";
import env from "#start/env";

/**
 * Step 0 of the Postgres migration plan. `messages`, `signatures`, `stand_matches` and
 * `user_matches` were all moved to Postgres by earlier migrations, which also dropped the Mongo
 * collections. Yet the nightly "Copy Mongo to Staging" job, which restores whatever production
 * holds, still brings all four back to staging with their full historic document counts, so
 * production has them. Whether the production drops never ran or the collections were recreated
 * afterwards is not known; this migration simply drops them again wherever it runs, tolerating
 * collections that are already gone.
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async () => {
      if (env.get("API_ENV") === "test") {
        return;
      }
      await withMongo(async (mongo) => {
        for (const name of ["messages", "signatures", "stand_matches", "user_matches"]) {
          await dropCollection(mongo, name);
        }
      });
    });
  }

  override async down() {
    // The data lives in Postgres; there is nothing to restore in Mongo.
  }
}
