import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * Backfills boolean flags that the shared types now declare non-optional (staging counts
 * per the 2026-09-01 survey):
 *
 * - orders.handoutByDelivery: missing on 85 573 of 183 991 — writers other than bl-admin
 *   never set it (still omitted on orders created today); the schema now defaults it to false.
 * - orders.orderItems[].handout: missing somewhere on 81 782 orders — same open tap, same fix.
 * - orders.orderItems[].delivered: missing on 4 orders from 2018 (schema default has covered
 *   every create since).
 * - invoices.toLossNote: missing on 4 125 of 7 734 — all created before the schema default
 *   arrived in 2022.
 *
 * Absent has always meant false for every one of these (readers only do truthy checks),
 * so the backfill changes no behavior — it makes the data match the declared types.
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

        const orders = mongo.collection("orders");
        const handoutByDelivery = await orders.updateMany(
          { handoutByDelivery: { $exists: false } },
          { $set: { handoutByDelivery: false } },
        );
        console.log(
          `order normalization: handoutByDelivery backfilled to false on ${handoutByDelivery.modifiedCount} orders`,
        );

        const handout = await orders.updateMany(
          { orderItems: { $elemMatch: { handout: { $exists: false } } } },
          { $set: { "orderItems.$[item].handout": false } },
          { arrayFilters: [{ "item.handout": { $exists: false } }] },
        );
        console.log(
          `order normalization: orderItems.handout backfilled to false on ${handout.modifiedCount} orders`,
        );

        const delivered = await orders.updateMany(
          { orderItems: { $elemMatch: { delivered: { $exists: false } } } },
          { $set: { "orderItems.$[item].delivered": false } },
          { arrayFilters: [{ "item.delivered": { $exists: false } }] },
        );
        console.log(
          `order normalization: orderItems.delivered backfilled to false on ${delivered.modifiedCount} orders`,
        );

        const toLossNote = await mongo
          .collection("invoices")
          .updateMany({ toLossNote: { $exists: false } }, { $set: { toLossNote: false } });
        console.log(
          `invoice normalization: toLossNote backfilled to false on ${toLossNote.modifiedCount} invoices`,
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
