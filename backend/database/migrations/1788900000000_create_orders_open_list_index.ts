import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * The order manager lists placed orders newest first and stops once it has a page of open ones.
 * The orders collection only had indexes on `_id` and `branch`, so that walk scanned the whole
 * collection. Production runs without autoIndex, so the index the schema declares is created here.
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async () => {
      if (env.get("API_ENV") === "test") {
        return;
      }

      const connection = await mongoose
        .createConnection(env.get("MONGODB_URI"), {
          dbName: env.get("API_ENV") === "production" ? "production" : "staging",
        })
        .asPromise();
      try {
        const mongo = connection.db;
        if (!mongo) {
          throw new Error("mongoose connection has no db handle");
        }
        const name = await mongo
          .collection("orders")
          .createIndex({ placed: 1, creationTime: -1 }, { name: "placed_1_creationTime_-1" });
        console.log(`orders index ensured: ${name}`);
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    // The index only speeds reads; dropping it on rollback would slow the legacy list for nothing.
  }
}
