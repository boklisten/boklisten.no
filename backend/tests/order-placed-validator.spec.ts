import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { OrderPlacedValidator } from "#services/legacy/collections/order/helpers/order-validator/order-placed-validator/order-placed-validator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Delivery } from "#shared/delivery/delivery";
import { Order } from "#shared/order/order";
import { Payment } from "#shared/payment/payment";

chaiUse(chaiAsPromised);
should();

test.group("OrderPlacedValidator", (group) => {
  let testOrder: Order;

  const orderPlacedValidator = new OrderPlacedValidator();
  let testPayment: Payment;
  let testDelivery: Delivery;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 450,
      orderItems: [
        {
          type: "buy",
          amount: 300,
          item: "i1",
          title: "Signatur 3",
          unitPrice: 300,
        },
        {
          type: "rent",
          amount: 150,
          item: "i2",
          title: "Signatur 4",
          unitPrice: 300,
        },
      ],
      customer: "customer1",
      delivery: "delivery1",
      branch: "b1",
      byCustomer: true,
      payments: ["payment1"],
    };

    testOrder.placed = true;

    testPayment = {
      id: "payment1",
      method: "card",
      order: "order1",
      info: {},
      amount: 450,
      confirmed: true,
      customer: "customer1",
      branch: "branch1",
    };

    testDelivery = {
      id: "delivery1",
      method: "branch",
      info: {
        branch: "branch1",
      },
      order: "order1",
      amount: 0,
    };

    sandbox = createSandbox();
    sandbox.stub(StorageService.Payments, "getMany").callsFake((ids: string[]) => {
      return new Promise((resolve, reject) => {
        if (ids[0] !== "payment1") {
          return reject(new BlError("not found").code(702));
        }
        resolve([testPayment]);
      });
    });

    sandbox.stub(StorageService.Deliveries, "get").callsFake((id) => {
      return new Promise((resolve, reject) => {
        if (id !== "delivery1") {
          return reject(new BlError("not found").code(702));
        }

        resolve(testDelivery);
      });
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should resolve with true", async () => {
    testOrder.placed = false;

    return expect(orderPlacedValidator.validate(testOrder)).to.eventually.be.true;
  });

  test("should resolve with true if there are no payments attached", async () => {
    testOrder.payments = [];

    return expect(orderPlacedValidator.validate(testOrder)).to.be.fulfilled;
  });

  test("should reject with error if delivery is not found", async () => {
    testOrder.delivery = "notFoundDelivery";

    orderPlacedValidator
      .validate(testOrder)
      // @ts-expect-error fixme: auto ignored bad test enums
      .should.be.rejectedWith(BlError, /delivery "notFoundDelivery" not found/);
  });

  test("should reject with error if payments is not found", async () => {
    testOrder.payments = ["notFound"];

    orderPlacedValidator
      .validate(testOrder)
      // @ts-expect-error fixme: auto ignored bad test enums
      .should.be.rejectedWith(BlError, /order.payments is not found/);
  });

  test("should reject with error if payment.confirmed is false", async () => {
    testPayment.confirmed = false;

    orderPlacedValidator
      .validate(testOrder)
      // @ts-expect-error fixme: auto ignored bad test enums
      .should.be.rejectedWith(BlError, /payment is not confirmed/);
  });

  test("should reject with error if total amount in payments is not equal to order.amount + delivery.amount", async () => {
    testOrder.amount = 450;
    testDelivery.amount = 40;
    testPayment.amount = 100;

    orderPlacedValidator
      .validate(testOrder)
      // @ts-expect-error fixme: auto ignored bad test enums
      .should.be.rejectedWith(
        BlError,
        /total amount of payments is not equal to total of order.amount \+ delivery.amount/,
      );
  });

  test("should reject with error if total amount in order.orderItems is not equal to order.amount", async () => {
    testOrder.payments = [];

    // @ts-expect-error fixme: auto ignored
    testOrder.delivery = null;
    testOrder.amount = 999;

    orderPlacedValidator
      .validate(testOrder)
      // @ts-expect-error fixme: auto ignored bad test enums
      .should.be.rejectedWith(
        BlError,
        /total of order.orderItems amount is not equal to order.amount/,
      );
  });

  test("should resolve if delivery and payments are valid according to order information", async () => {
    void orderPlacedValidator.validate(testOrder).then((resolved) => {
      return expect(resolved).to.be.true;
    });
  });
});
