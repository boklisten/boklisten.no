import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * Normalizes legacy bl-api-era Mongo data that current queries stumble over:
 *
 * - `customeritems.cancel` and `.buyback` are missing on 2018-era documents, so equality
 *   filters like `{ cancel: false }` (ACTIVE_CUSTOMER_ITEM_MATCH, the public blid lookup,
 *   reminders, reports) silently skip them. They get their schema default `false`.
 * - `customeritems.returnInfo.time` was written as an ISO string until 2018; the schema
 *   declares a Date.
 * - `orders.orderItems.info.to`/`.from` hold date strings for every order placed through a
 *   JSON request body, because `info` was a Mixed field with no casting — mixed with real
 *   BSON dates from backend-constructed orders, which breaks sorting and range filters and
 *   forces `$convert` in every aggregation. The schema now casts new writes to Date
 *   (order.schema.ts), and this migration converts the backlog.
 *
 * Unparseable strings (none observed on staging) are left as they are rather than failing
 * the deploy; leftovers are counted and logged.
 */
const convertedInfoField = (field: "to" | "from") => ({
  $cond: [
    { $eq: [{ $type: `$$orderItem.info.${field}` }, "string"] },
    {
      [field]: {
        $convert: {
          input: `$$orderItem.info.${field}`,
          to: "date",
          onError: `$$orderItem.info.${field}`,
        },
      },
    },
    {},
  ],
});

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
        const customerItems = mongo.collection("customeritems");
        const orders = mongo.collection("orders");

        const cancelResult = await customerItems.updateMany(
          { cancel: { $exists: false } },
          { $set: { cancel: false } },
        );
        const buybackResult = await customerItems.updateMany(
          { buyback: { $exists: false } },
          { $set: { buyback: false } },
        );

        const returnTimeResult = await customerItems.updateMany(
          { "returnInfo.time": { $type: "string" } },
          [
            {
              $set: {
                "returnInfo.time": {
                  $convert: { input: "$returnInfo.time", to: "date", onError: "$returnInfo.time" },
                },
              },
            },
          ],
        );

        const orderResult = await orders.updateMany(
          {
            $or: [
              { "orderItems.info.to": { $type: "string" } },
              { "orderItems.info.from": { $type: "string" } },
            ],
          },
          [
            {
              $set: {
                orderItems: {
                  $map: {
                    input: "$orderItems",
                    as: "orderItem",
                    in: {
                      $mergeObjects: [
                        "$$orderItem",
                        {
                          $cond: [
                            { $eq: [{ $type: "$$orderItem.info" }, "object"] },
                            {
                              info: {
                                $mergeObjects: [
                                  "$$orderItem.info",
                                  convertedInfoField("to"),
                                  convertedInfoField("from"),
                                ],
                              },
                            },
                            {},
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        );

        const leftoverOrderStrings = await orders.countDocuments({
          $or: [
            { "orderItems.info.to": { $type: "string" } },
            { "orderItems.info.from": { $type: "string" } },
          ],
        });
        console.log(
          `legacy normalization: cancel backfilled on ${cancelResult.modifiedCount}, ` +
            `buyback on ${buybackResult.modifiedCount}, returnInfo.time converted on ` +
            `${returnTimeResult.modifiedCount} customer items; orderItems.info dates ` +
            `converted on ${orderResult.modifiedCount} orders ` +
            `(${leftoverOrderStrings} orders still hold unparseable strings)`,
        );
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    // Data normalization toward the declared schemas; there is nothing sensible to revert to.
  }
}
