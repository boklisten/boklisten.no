import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { DeliveryHandler } from "#services/legacy/collections/delivery/helpers/deliveryHandler/delivery-handler";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Delivery } from "#shared/delivery/delivery";
import { Order } from "#shared/order/order";

chaiUse(chaiAsPromised);
should();

let testOrder: Order;
let testDelivery: Delivery;
let canUpdateOrder = true;

const deliveryHandler = new DeliveryHandler();
let sandbox: sinon.SinonSandbox;

test.group("DeliveryHandler", (group) => {
  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 100,
      orderItems: [],
      branch: "branch1",
      customer: "customer1",
      byCustomer: true,
    };

    testDelivery = {
      id: "delivery1",
      method: "bring",
      amount: 100,
      order: "order1",
      info: {
        amount: 100,
        estimatedDelivery: new Date(),
        taxAmount: 0,
        from: "0450",
        to: "0560",
      },
    };
    sandbox = createSandbox();
    sandbox.stub(StorageService.Orders, "update").callsFake(() => {
      if (!canUpdateOrder) {
        return Promise.reject(new BlError("could not update"));
      }
      return Promise.resolve(testOrder);
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if OrderStorage.update rejects", async () => {
    testDelivery.method = "branch";
    canUpdateOrder = false;

    return expect(
      deliveryHandler.updateOrderBasedOnMethod(testDelivery, testOrder),
    ).to.be.rejectedWith(BlError, /could not update/);
  });
});
