import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * CustomerItems created before `type` existed (Aug 2018 - Jan 2019, 3 503 on staging) lack the
 * field. Partly-payment first appears Jan 10 2019 — right when `type` started being written —
 * and none of the type-less documents carry the partly-payment markers (amountLeftToPay,
 * totalAmount), so they are all rentals. The schema now declares `type` required, and the
 * shared CustomerItem type declares it non-optional.
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

        // { type: null } matches documents missing the field and explicit nulls alike
        const result = await mongo
          .collection("customeritems")
          .updateMany({ type: null }, { $set: { type: "rent" } });
        console.log(
          `customerItem normalization: type backfilled to "rent" on ${result.modifiedCount} customerItems`,
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
