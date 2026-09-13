import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";

import BadRequestException from "#exceptions/bad_request_exception";
import Signature from "#models/signature";
import { assertSignedForCheckout } from "#services/signature_helper";
import type { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const REFUSED = /signere låneavtalen/;

const ADULT = mock<UserDetail>({
  id: CUSTOMER_ID,
  name: "Test Testersen",
  dob: new Date(1990, 0, 1),
});

function underage(): UserDetail {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 16);
  return mock<UserDetail>({ id: CUSTOMER_ID, name: "Ung Elev", dob });
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
    await assertSignedForCheckout(ADULT, [{ type: "buy" }, { type: "extend" }, { type: "buyout" }]);
  });

  test("refuses a rent cart when the customer has never signed", async ({ assert }) => {
    await assert.rejects(
      () => assertSignedForCheckout(ADULT, [{ type: "buy" }, { type: "rent" }]),
      BadRequestException,
      REFUSED,
    );
  });

  test("lets a rent cart through once the customer has a valid signature", async () => {
    await createSignature(ADULT.name, false);
    await assertSignedForCheckout(ADULT, [{ type: "rent" }]);
  });

  test("refuses when the only signature is a guardian's but the customer is now an adult", async ({
    assert,
  }) => {
    await createSignature("Foresatt Foresattsen", true);
    await assert.rejects(
      () => assertSignedForCheckout(ADULT, [{ type: "partly-payment" }]),
      BadRequestException,
      REFUSED,
    );
  });

  test("an underage customer needs a guardian's signature, not their own", async ({ assert }) => {
    await createSignature("Ung Elev", false);
    await assert.rejects(
      () => assertSignedForCheckout(underage(), [{ type: "rent" }]),
      BadRequestException,
      REFUSED,
    );

    await createSignature("Foresatt Foresattsen", true);
    await assertSignedForCheckout(underage(), [{ type: "rent" }]);
  });
});
