import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import Signature from "#models/signature";
import { assertSignedForCheckout } from "#services/signature_helper";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const REFUSED = /signere låneavtalen/;

function adult() {
  return createUser({
    id: CUSTOMER_ID,
    name: "Test Testersen",
    dob: DateTime.fromISO("1990-01-01"),
  });
}

function underage() {
  return createUser({
    id: CUSTOMER_ID,
    name: "Ung Elev",
    dob: DateTime.now().startOf("day").minus({ years: 16 }),
  });
}

function createSignature(signingName: string, signedByGuardian: boolean) {
  return Signature.create({
    customerDetailsId: CUSTOMER_ID,
    signingName,
    signedByGuardian,
    image: Buffer.from("webp"),
  });
}

test.group("assertSignedForCheckout", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lets a cart without books to borrow through without any signature", async () => {
    const customer = await adult();
    await assertSignedForCheckout(customer, [
      { type: "buy" },
      { type: "extend" },
      { type: "buyout" },
    ]);
  });

  test("refuses a rent cart when the customer has never signed", async ({ assert }) => {
    const customer = await adult();
    await assert.rejects(
      () => assertSignedForCheckout(customer, [{ type: "buy" }, { type: "rent" }]),
      BadRequestException,
      REFUSED,
    );
  });

  test("lets a rent cart through once the customer has a valid signature", async () => {
    const customer = await adult();
    await createSignature(customer.name, false);
    await assertSignedForCheckout(customer, [{ type: "rent" }]);
  });

  test("refuses when the only signature is a guardian's but the customer is now an adult", async ({
    assert,
  }) => {
    const customer = await adult();
    await createSignature("Foresatt Foresattsen", true);
    await assert.rejects(
      () => assertSignedForCheckout(customer, [{ type: "partly-payment" }]),
      BadRequestException,
      REFUSED,
    );
  });

  test("an underage customer needs a guardian's signature, not their own", async ({ assert }) => {
    const customer = await underage();
    await createSignature("Ung Elev", false);
    await assert.rejects(
      () => assertSignedForCheckout(customer, [{ type: "rent" }]),
      BadRequestException,
      REFUSED,
    );

    await createSignature("Foresatt Foresattsen", true);
    await assertSignedForCheckout(customer, [{ type: "rent" }]);
  });
});
