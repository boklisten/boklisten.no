import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import Signature from "#models/signature";
import type User from "#models/user";
import { findSignatureException } from "#services/signature_helper";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const adultDob = DateTime.now().minus({ years: 30 }).startOf("year");
const childDob = DateTime.now().minus({ years: 10 }).startOf("year");

function userWith(overrides: { dob?: DateTime; taskSignAgreement?: boolean } = {}): Promise<User> {
  return createUser({
    id: CUSTOMER_ID,
    name: "Test Kunde",
    dob: adultDob,
    ...overrides,
  });
}

function createSignature(overrides: Partial<Parameters<typeof Signature.create>[0]> = {}) {
  return Signature.create({
    customerId: CUSTOMER_ID,
    signingName: "Test Kunde",
    signedByGuardian: false,
    image: Buffer.from("webp"),
    ...overrides,
  });
}

function openOrderWith(type: OrderItemType) {
  return createOrder({
    branchId: "branch1",
    customerId: CUSTOMER_ID,
    byCustomer: true,
    orderItems: [{ type, itemId: "item1" }],
  });
}

test.group("findSignatureException", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  group.each.setup(async () => {
    await createBranch({ id: "branch1" });
    await createItem({ id: "item1" });
  });

  test("an unsigned customer with an open rent order has never signed", async ({ assert }) => {
    const user = await userWith();
    await openOrderWith("rent");

    const reason = await findSignatureException(user);

    assert.equal(reason, "Aldri signert");
  });

  test("a requested signature task counts as never signed", async ({ assert }) => {
    const reason = await findSignatureException(await userWith({ taskSignAgreement: true }));

    assert.equal(reason, "Aldri signert");
  });

  test("an unsigned customer with an open partly-payment order has never signed", async ({
    assert,
  }) => {
    const user = await userWith();
    await openOrderWith("partly-payment");

    const reason = await findSignatureException(user);

    assert.equal(reason, "Aldri signert");
  });

  test("an unsigned customer with only a buy order needs no signature", async ({ assert }) => {
    const user = await userWith();
    await openOrderWith("buy");

    const reason = await findSignatureException(user);

    assert.isNull(reason);
  });

  test("an expired signature with an open rent order is reported as expired", async ({
    assert,
  }) => {
    const user = await userWith();
    await openOrderWith("rent");
    await createSignature({ createdAt: DateTime.local(2000, 1, 1) });

    const reason = await findSignatureException(user);

    assert.equal(reason, "Signaturen er utløpt");
  });

  test("an underage customer who signed without a guardian is reported as such", async ({
    assert,
  }) => {
    const user = await userWith({ dob: childDob });
    await openOrderWith("rent");
    await createSignature();

    const reason = await findSignatureException(user);

    assert.equal(reason, "Signert uten foresatt, kunden er under 18");
  });

  test("an adult with a guardian signature is reported as outgrown", async ({ assert }) => {
    const user = await userWith();
    await openOrderWith("rent");
    await createSignature({ signedByGuardian: true });

    const reason = await findSignatureException(user);

    assert.equal(reason, "Signert av foresatt, kunden har fylt 18");
  });

  test("a customer with a valid signature has no exception", async ({ assert }) => {
    const user = await userWith();
    await openOrderWith("rent");
    await createSignature();

    const reason = await findSignatureException(user);

    assert.isNull(reason);
  });
});
