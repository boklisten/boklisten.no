import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Signature from "#models/signature";
import { findSignatureException } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import { mock } from "#tests/test-doubles";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const adultDob = new Date(new Date().getFullYear() - 30, 0, 1);
const childDob = new Date(new Date().getFullYear() - 10, 0, 1);

function userDetailWith(overrides: Partial<UserDetail>): UserDetail {
  return mock<UserDetail>({
    id: CUSTOMER_ID,
    name: "Test Kunde",
    dob: adultDob,
    ...overrides,
  });
}

function createSignature(overrides: Partial<Parameters<typeof Signature.create>[0]> = {}) {
  return Signature.create({
    customerDetailsId: CUSTOMER_ID,
    signingName: "Test Kunde",
    signedByGuardian: false,
    image: Buffer.from("webp"),
    ...overrides,
  });
}

function openOrderWith(type: OrderItemType): Order {
  return mock<Order>({
    id: "order1",
    placed: true,
    customer: CUSTOMER_ID,
    orderItems: [{ type, item: "item1", title: "Bok", amount: 100, unitPrice: 100 }],
  });
}

test.group("findSignatureException", (group) => {
  let sandbox: sinon.SinonSandbox;
  let orders: Order[];

  group.each.setup(() => testUtils.db().truncate());

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "update").callsFake((id, data) =>
      Promise.resolve(
        mock<UserDetail>({
          ...userDetailWith({}),
          tasks: {
            signAgreement: (data as Record<string, unknown>)["tasks.signAgreement"] === true,
          },
        }),
      ),
    );
    orders = [];
    sandbox.stub(StorageService.Orders, "getByQuery").callsFake(() => Promise.resolve(orders));
    sandbox.stub(StorageService.CustomerItems, "getByQuery").callsFake(() => Promise.resolve([]));
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("an unsigned customer with an open rent order has never signed", async ({ assert }) => {
    orders = [openOrderWith("rent")];

    const reason = await findSignatureException(userDetailWith({}));

    assert.equal(reason, "Aldri signert");
  });

  test("a requested signature task counts as never signed", async ({ assert }) => {
    const reason = await findSignatureException(userDetailWith({ tasks: { signAgreement: true } }));

    assert.equal(reason, "Aldri signert");
  });

  test("an unsigned customer with an open partly-payment order has never signed", async ({
    assert,
  }) => {
    orders = [openOrderWith("partly-payment")];

    const reason = await findSignatureException(userDetailWith({}));

    assert.equal(reason, "Aldri signert");
  });

  test("an unsigned customer with only a buy order needs no signature", async ({ assert }) => {
    orders = [openOrderWith("buy")];

    const reason = await findSignatureException(userDetailWith({}));

    assert.isNull(reason);
  });

  test("an expired signature with an open rent order is reported as expired", async ({
    assert,
  }) => {
    orders = [openOrderWith("rent")];
    await createSignature({ createdAt: DateTime.local(2000, 1, 1) });

    const reason = await findSignatureException(userDetailWith({}));

    assert.equal(reason, "Signaturen er utløpt");
  });

  test("an underage customer who signed without a guardian is reported as such", async ({
    assert,
  }) => {
    orders = [openOrderWith("rent")];
    await createSignature();

    const reason = await findSignatureException(userDetailWith({ dob: childDob }));

    assert.equal(reason, "Signert uten foresatt, kunden er under 18");
  });

  test("an adult with a guardian signature is reported as outgrown", async ({ assert }) => {
    orders = [openOrderWith("rent")];
    await createSignature({ signedByGuardian: true });

    const reason = await findSignatureException(userDetailWith({}));

    assert.equal(reason, "Signert av foresatt, kunden har fylt 18");
  });

  test("a customer with a valid signature has no exception", async ({ assert }) => {
    orders = [openOrderWith("rent")];
    await createSignature();

    const reason = await findSignatureException(userDetailWith({}));

    assert.isNull(reason);
  });
});
