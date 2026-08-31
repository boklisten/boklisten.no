import { test } from "@japa/runner";
import mongoose from "mongoose";

import { OrderSchema } from "#models/mongoose/order.schema";

// orderItems.info used to be a Mixed field, so date strings from JSON request bodies were
// stored verbatim while backend-constructed orders stored real dates. The typed subdocument
// must cast strings to Date on write, without dropping keys the declaration doesn't know.

function buildOrder(info: Record<string, unknown>) {
  const Model = mongoose.model(
    `OrderCastingProbe_${Math.random().toString(36).slice(2)}`,
    OrderSchema,
  );
  const order = new Model({
    amount: 100,
    orderItems: [
      {
        type: "rent",
        item: new mongoose.Types.ObjectId(),
        title: "Book",
        amount: 100,
        unitPrice: 100,
        info,
      },
    ],
    branch: new mongoose.Types.ObjectId(),
    customer: new mongoose.Types.ObjectId(),
    byCustomer: true,
  });
  // toObject exposes the subdocument as stored, including keys the schema does not declare.
  const stored: unknown = order.toObject().orderItems[0]?.info;
  if (stored == null) throw new Error("orderItem lost its info");
  return { order, info: stored };
}

function fieldOf(info: unknown, key: string): unknown {
  return typeof info === "object" && info !== null ? Reflect.get(info, key) : undefined;
}

test.group("OrderSchema orderItems.info casting", () => {
  test("casts string dates in info.from/info.to to Date", async ({ assert }) => {
    const { order, info } = buildOrder({
      from: "2026-08-30T10:00:00.000Z",
      to: "2027-07-01",
      numberOfPeriods: 1,
      periodType: "year",
    });
    assert.instanceOf(fieldOf(info, "from"), Date);
    const to = fieldOf(info, "to");
    assert.instanceOf(to, Date);
    assert.equal(to instanceof Date ? to.toISOString() : undefined, "2027-07-01T00:00:00.000Z");
    await assert.doesNotReject(() => order.validate());
  });

  test("keeps real dates and the other declared keys as they are", ({ assert }) => {
    const from = new Date("2026-08-30T10:00:00.000Z");
    const { info } = buildOrder({
      from,
      to: new Date("2027-07-01T00:00:00.000Z"),
      numberOfPeriods: 2,
      periodType: "semester",
      customerItem: "abc123",
      amountLeftToPay: 250,
      buybackAmount: 50,
    });
    assert.deepEqual(fieldOf(info, "from"), from);
    assert.equal(fieldOf(info, "numberOfPeriods"), 2);
    assert.equal(fieldOf(info, "periodType"), "semester");
    assert.equal(fieldOf(info, "customerItem"), "abc123");
    assert.equal(fieldOf(info, "amountLeftToPay"), 250);
    assert.equal(fieldOf(info, "buybackAmount"), 50);
  });

  test("rejects a periodType outside the semester/year enum", async ({ assert }) => {
    const { order } = buildOrder({ periodType: "day" });
    await assert.rejects(() => order.validate(), /periodType/);
  });

  test("preserves keys the schema does not declare", ({ assert }) => {
    const { info } = buildOrder({ to: "2027-07-01", someLegacyKey: "kept" });
    assert.equal(fieldOf(info, "someLegacyKey"), "kept");
    assert.instanceOf(fieldOf(info, "to"), Date);
  });
});
