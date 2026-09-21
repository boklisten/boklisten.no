import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * Removes three legacy fields nothing has ever read (survey of staging, 2026-09-18):
 * - `customerItem.totalAmount`: the order line amount, copied at creation (152k docs).
 *   `amountLeftToPay` next to it is the one the invoice and stand-cart flows use.
 * - `customerItem.handoutInfo.handoutBy` and `returnInfo.returnedTo`: single-value enums that
 *   were "branch" on every document. `handoutById` / `returnedToId` carry the information.
 * - `delivery.info.taxAmount`: the VAT share of the Bring price, written at checkout (35k docs).
 * The schemas and shared types no longer declare them.
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async () => {
      if (env.get("API_ENV") === "test") {
        return;
      }

      const connection = await mongoose
        .createConnection(env.get("MONGODB_URI").release(), {
          dbName: env.get("API_ENV") === "production" ? "production" : "staging",
        })
        .asPromise();
      try {
        const mongo = connection.db;
        if (!mongo) {
          throw new Error("mongoose connection has no db handle");
        }

        const customerItems = mongo.collection("customeritems");
        for (const field of ["totalAmount", "handoutInfo.handoutBy", "returnInfo.returnedTo"]) {
          const result = await customerItems.updateMany(
            { [field]: { $exists: true } },
            { $unset: { [field]: "" } },
          );
          console.log(`customerItem cleanup: dropped "${field}" from ${result.modifiedCount} docs`);
        }

        const deliveries = await mongo
          .collection("deliveries")
          .updateMany(
            { "info.taxAmount": { $exists: true } },
            { $unset: { "info.taxAmount": "" } },
          );
        console.log(
          `delivery cleanup: dropped "info.taxAmount" from ${deliveries.modifiedCount} docs`,
        );
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    // Removal of dead fields; there is nothing sensible to revert to.
  }
}
