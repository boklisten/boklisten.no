import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * A single delivery from May 2021 stored info.estimatedDelivery as an ISO string instead of a
 * Date. The delivery schema now declares info as a typed subdocument with estimatedDelivery as
 * Date, and the shared DeliveryInfoBring type declares `Date | null` — convert the stray string
 * so the data matches.
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
          .collection("deliveries")
          .updateMany({ "info.estimatedDelivery": { $type: "string" } }, [
            { $set: { "info.estimatedDelivery": { $toDate: "$info.estimatedDelivery" } } },
          ]);
        console.log(
          `delivery normalization: info.estimatedDelivery converted from string to Date on ${result.modifiedCount} deliveries`,
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
