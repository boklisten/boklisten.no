import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { DeliveryHandler } from "#services/legacy/collections/delivery/helpers/deliveryHandler/delivery-handler";
import { DeliveryValidator } from "#services/legacy/collections/delivery/helpers/deliveryValidator/delivery-validator";
import { DeliveryPostHook } from "#services/legacy/collections/delivery/hooks/delivery.post.hook";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";

test.group("DeliveryPostHook", (group) => {
  const deliveryValidator = new DeliveryValidator();
  const deliveryHandler = new DeliveryHandler();
  const deliveryPostHook = new DeliveryPostHook(deliveryValidator, deliveryHandler);

  let testDelivery: Delivery;
  let testOrder: Order;
  let testItem: Item;
  let testAccessToken: AccessToken;

  let deliveryValidated = true;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    deliveryValidated = true;

    testDelivery = {
      id: "delivery1",
      method: "bring",
      amount: 100,
      order: "order1",
      info: {
        branch: "branch1",
      },
    };

    testAccessToken = {
      iss: "boklisten.co",
      aud: "boklisten.co",
      iat: 1234,
      exp: 2345,
      sub: "user1",
      username: "a@b.com",
      permission: "customer",
      details: "details1",
    };

    testItem = {
      id: "item1",
      title: "signatur 3",
      price: 100,
      buyback: false,
      info: {
        isbn: 0,
        subject: "",
        year: 0,
        price: {},
        weight: "",
        distributor: "",
        discount: 0,
        publisher: "",
      },
    };

    testOrder = {
      id: "order1",
      customer: "customer1",
      amount: 100,
      byCustomer: true,
      placed: false,
      branch: "branch1",
      orderItems: [
        {
          item: "item1",
          title: "signatur 3",
          amount: 100,
          unitPrice: 100,
          type: "buy",
        },
      ],
      payments: [],
      delivery: "",
    };

    sandbox = createSandbox();
    sandbox.stub(deliveryValidator, "validate").callsFake(() => {
      if (!deliveryValidated) {
        return Promise.reject(new BlError("delivery could not be validated"));
      }
      return Promise.resolve(true);
    });

    sandbox
      .stub(deliveryHandler, "updateOrderBasedOnMethod")
      .callsFake(() => Promise.reject(new BlError("order could not be updated")));

    sandbox.stub(StorageService.Deliveries, "get").callsFake(
      (id) =>
        new Promise((resolve, reject) => {
          if (id === "delivery1") {
            resolve(testDelivery);
            return;
          }
          reject(new BlError("not found").code(702));
        }),
    );

    sandbox.stub(StorageService.Orders, "get").callsFake(
      (id) =>
        new Promise((resolve, reject) => {
          if (id === "order1") {
            resolve(testOrder);
            return;
          }
          reject(new BlError("not found").code(702));
        }),
    );

    sandbox.stub(StorageService.Items, "getMany").callsFake(
      (ids: string[]) =>
        new Promise((resolve, reject) => {
          if (ids[0] === "item1") {
            resolve([testItem]);
            return;
          }
          reject(new BlError("not found").code(702));
        }),
    );
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if deliveryIds is empty or undefined", async ({ assert }) =>
    assert.rejects(() => deliveryPostHook.after([]), BlError, /deliveries is empty or undefined/));

  test("should reject if delivery.order is not found", async ({ assert }) => {
    testDelivery.order = "notFoundOrder";

    const blError = await deliveryPostHook.after([testDelivery], testAccessToken).then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(blError, BlError);
    assert.equal(blError?.getCode(), 702);
    assert.include(blError?.getMsg() ?? "", "not found");
  });
  test("should reject if deliveryValidator.validate rejects", async ({ assert }) => {
    deliveryValidated = false;

    return assert.rejects(
      () => deliveryPostHook.after([testDelivery], testAccessToken),
      BlError,
      /delivery could not be validated/,
    );
  });

  test("should reject if DeliveryHandler.updateOrderBasedOnMethod rejects", async ({ assert }) =>
    assert.rejects(
      () => deliveryPostHook.after([testDelivery], testAccessToken),
      BlError,
      /order could not be updated/,
    ));
});
