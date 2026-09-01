import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { DeliveryHandler } from "#services/legacy/collections/delivery/helpers/deliveryHandler/delivery-handler";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";

let testOrder: Order;
let testDelivery: Delivery;
let canUpdateOrder = true;

const deliveryHandler = new DeliveryHandler();
let sandbox: sinon.SinonSandbox;

test.group("DeliveryHandler", (group) => {
  group.each.setup(() => {
    testOrder = {
      payments: [],
      handoutByDelivery: false,
      id: "order1",
      amount: 100,
      orderItems: [],
      branch: "branch1",
      customer: "customer1",
      byCustomer: true,
      placed: false,
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
        facilityAddress: {
          address: "Martin Lingesvei 25",
          postalCode: "1364",
          postalCity: "FORNEBU",
        },
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

  test("should reject if OrderStorage.update rejects", async ({ assert }) => {
    testDelivery.method = "branch";
    canUpdateOrder = false;

    return assert.rejects(
      () => deliveryHandler.updateOrderBasedOnMethod(testDelivery, testOrder),
      BlError,
      /could not update/,
    );
  });
});
