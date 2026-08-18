import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { DeliveryHandler } from "#services/legacy/collections/delivery/helpers/deliveryHandler/delivery-handler";
import { DeliveryValidator } from "#services/legacy/collections/delivery/helpers/deliveryValidator/delivery-validator";
import { DeliveryPostHook } from "#services/legacy/collections/delivery/hooks/delivery.post.hook";
import { StorageService } from "#services/storage_service";
import { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import { Delivery } from "#shared/delivery/delivery";
import { Item } from "#shared/item";
import { Order } from "#shared/order/order";

chaiUse(chaiAsPromised);
should();

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

    sandbox.stub(deliveryHandler, "updateOrderBasedOnMethod").callsFake(() => {
      return Promise.reject(new BlError("order could not be updated"));
    });

    sandbox.stub(StorageService.Deliveries, "get").callsFake((id) => {
      return new Promise((resolve, reject) => {
        if (id === "delivery1") {
          return resolve(testDelivery);
        }
        return reject(new BlError("not found").code(702));
      });
    });

    sandbox.stub(StorageService.Orders, "get").callsFake((id) => {
      return new Promise((resolve, reject) => {
        if (id === "order1") {
          return resolve(testOrder);
        }
        return reject(new BlError("not found").code(702));
      });
    });

    sandbox.stub(StorageService.Items, "getMany").callsFake((ids: string[]) => {
      return new Promise((resolve, reject) => {
        if (ids[0] === "item1") {
          return resolve([testItem]);
        }
        return reject(new BlError("not found").code(702));
      });
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if deliveryIds is empty or undefined", async () => {
    deliveryPostHook.after([]).catch((blError) => {
      return expect(blError.getMsg()).to.contain("deliveries is empty or undefined");
    });
  });

  test("should reject if delivery.order is not found", async () => {
    testDelivery.order = "notFoundOrder";

    deliveryPostHook.after([testDelivery], testAccessToken).catch((blError: BlError) => {
      expect(blError.getCode()).to.be.eql(702);

      return expect(blError.getMsg()).to.contain(`not found`);
    });
  });
  test("should reject if deliveryValidator.validate rejects", async () => {
    deliveryValidated = false;

    return expect(deliveryPostHook.after([testDelivery], testAccessToken)).to.be.rejectedWith(
      BlError,
      /delivery could not be validated/,
    );
  });

  test("should reject if DeliveryHandler.updateOrderBasedOnMethod rejects", async () => {
    return expect(deliveryPostHook.after([testDelivery], testAccessToken)).to.be.rejectedWith(
      BlError,
      /order could not be updated/,
    );
  });
});
