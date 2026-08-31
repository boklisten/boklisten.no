import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * A handful of bl-api-era payments (22 on staging) lack the `confirmed` flag entirely.
 * The schema now declares `confirmed` with default `false` and the shared Payment type
 * declares it non-optional, so the stragglers get their schema default. Code only ever
 * read the flag as truthy, so `missing` and `false` were already equivalent.
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async () => {
      if (env.get("API_ENV") === "test") return;

      const connection = await mongoose
        .createConnection(env.get("MONGODB_URI"), {
          dbName: env.get("API_ENV") === "production" ? "production" : "staging",
        })
        .asPromise();
      try {
        const mongo = connection.db;
        if (!mongo) throw new Error("mongoose connection has no db handle");

        const result = await mongo
          .collection("payments")
          .updateMany({ confirmed: { $exists: false } }, { $set: { confirmed: false } });
        console.log(
          `payment normalization: confirmed backfilled on ${result.modifiedCount} payments`,
        );
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    // Data normalization toward the declared schema; there is nothing sensible to revert to.
  }
}
