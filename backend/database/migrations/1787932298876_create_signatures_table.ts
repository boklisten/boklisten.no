import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * Moves signatures from MongoDB to Postgres and inverts the relationship: the signature row now
 * stores the customer it belongs to, instead of user details keeping an array of signature ids.
 * The newest signature per customer is the only one any consumer reads, but the full history is
 * kept because a signature is a signed legal agreement.
 *
 * The backfill runs here (inside Railway's private network on deploy) rather than from a local
 * machine, so no database ever needs public access. Mongo signature documents carry no customer
 * reference, so the customer is resolved through the `signatures` arrays on user details; signature
 * documents no user detail references cannot be attributed to anyone and are skipped. `created_at`
 * is set to the original Mongo `creationTime`, since signing time and row creation are the same
 * moment for every row written after this migration.
 *
 * After the transfer, the Mongo `signatures` collection is dropped, along with the long-dead
 * `stand_matches` and `user_matches` collections (already migrated to Postgres).
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("signatures", (table) => {
      table.increments("id");
      table.string("customer_details_id", 24).notNullable();
      table.string("signing_name").notNullable();
      table.boolean("signed_by_guardian").notNullable();
      table.binary("image").notNullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["customer_details_id", "created_at"]);
    });

    this.defer(async (database) => {
      if (env.get("API_ENV") === "test") return;

      const connection = await mongoose
        .createConnection(env.get("MONGODB_URI"), {
          dbName: env.get("API_ENV") === "production" ? "production" : "staging",
        })
        .asPromise();
      try {
        const mongo = connection.db;
        if (!mongo) throw new Error("mongoose connection has no db handle");

        const customerBySignatureId = new Map<string, string>();
        const userDetailsCursor = mongo
          .collection("userdetails")
          .find({ "signatures.0": { $exists: true } }, { projection: { signatures: 1 } });
        for await (const userDetail of userDetailsCursor) {
          for (const signatureId of userDetail["signatures"] ?? []) {
            customerBySignatureId.set(String(signatureId), String(userDetail._id));
          }
        }

        let migrated = 0;
        let unattributed = 0;
        let batch: Record<string, unknown>[] = [];
        const signaturesCursor = mongo.collection("signatures").find();
        for await (const signature of signaturesCursor) {
          const customerDetailsId = customerBySignatureId.get(String(signature._id));
          if (!customerDetailsId) {
            unattributed++;
            continue;
          }
          const image = signature["image"];
          batch.push({
            customer_details_id: customerDetailsId,
            signing_name: signature["signingName"] ?? "",
            signed_by_guardian: signature["signedByGuardian"] ?? false,
            image: Buffer.isBuffer(image) ? image : Buffer.from(image.buffer),
            created_at: signature["creationTime"] ?? new Date(),
            updated_at: signature["lastUpdated"] ?? signature["creationTime"] ?? new Date(),
          });
          if (batch.length >= 200) {
            await database.table("signatures").multiInsert(batch);
            migrated += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          await database.table("signatures").multiInsert(batch);
          migrated += batch.length;
        }
        console.log(
          `signatures backfill: migrated ${migrated}, skipped ${unattributed} unattributed`,
        );

        for (const obsoleteCollection of ["signatures", "stand_matches", "user_matches"]) {
          await mongo.dropCollection(obsoleteCollection).catch((error: unknown) => {
            // NamespaceNotFound: already gone, nothing to drop.
            const alreadyGone =
              typeof error === "object" &&
              error !== null &&
              "codeName" in error &&
              error.codeName === "NamespaceNotFound";
            if (!alreadyGone) throw error;
          });
        }
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    this.schema.dropTable("signatures");
  }
}
