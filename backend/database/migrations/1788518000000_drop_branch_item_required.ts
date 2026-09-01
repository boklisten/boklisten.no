import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * `branchItem.required` was never used: no reader or writer exists in this repo, bl-admin, or
 * bl-cron, and exactly one document (staging, 2026-08-31) carried the field. The schema and the
 * shared BranchItem type no longer declare it; this removes the stray value from the data.
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

        const result = await mongo
          .collection("branchitems")
          .updateMany({ required: { $exists: true } }, { $unset: { required: "" } });
        console.log(
          `branchItem normalization: dropped unused "required" field from ${result.modifiedCount} branchItems`,
        );
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    // Removal of a dead field; there is nothing sensible to revert to.
  }
}
