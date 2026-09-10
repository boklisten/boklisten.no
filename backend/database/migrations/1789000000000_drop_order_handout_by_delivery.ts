import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * Removes `orders.handoutByDelivery`. Whether the books of an order went by mail is now read off
 * the order's delivery document (method "bring"), which is how bl-admin has recorded postal
 * handouts since 2020 and what the stand cart copies.
 *
 * Staging survey, 2026-09-10: the flag was set on 652 orders, all employee handout orders from
 * 2018–2020. 437 of them also carry a Bring delivery and keep reading as postal; 169 point at a
 * delivery document that is gone and 45 never had one — those read as plain stand handouts from
 * now on, since nothing else about them is known.
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
          .collection("orders")
          .updateMany(
            { handoutByDelivery: { $exists: true } },
            { $unset: { handoutByDelivery: "" } },
          );
        console.log(
          `order normalization: handoutByDelivery removed from ${result.modifiedCount} orders`,
        );
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    // The flag carried no information the delivery document does not; there is nothing to restore.
  }
}
