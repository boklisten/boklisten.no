import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import User from "#models/user";
import { CustomerItemHandler } from "#services/customer_items/customer_item_handler";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { PaymentHandler } from "#services/orders/payment_handler";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";
import { userDouble } from "#tests/user_fixtures";

test.group("OrderPlacedHandler", (group) => {
  let testOrder: Order;
  let testPayment: Payment;
  let paymentsConfirmed: boolean;
  let testAccessToken: AccessToken;
  let orderUpdate: boolean;
  let testUserDetail: User;

  const paymentHandler = new PaymentHandler();
  const orderItemMovedFromOrderHandler = new OrderItemMovedFromOrderHandler();
  const customerItemHandler = new CustomerItemHandler();
  const orderPlacedHandler = new OrderPlacedHandler(
    paymentHandler,
    customerItemHandler,
    orderItemMovedFromOrderHandler,
  );

  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    sandbox = createSandbox();

    sandbox.stub(orderItemMovedFromOrderHandler, "updateOrderItems").resolves(true);

    const customerItemsStub = {
      add: sandbox.stub().callsFake((customerItem) => {
        if (customerItem.item === "item1") {
          customerItem.id = "customerItem1";
          return Promise.resolve(customerItem);
        } else if (customerItem.item === "item2") {
          customerItem.id = "customerItem2";
          return Promise.resolve(customerItem);
        }
        return Promise.reject(new BlError("could not add doc"));
      }),
    };
    sandbox.stub(StorageService, "CustomerItems").value(customerItemsStub);

    sandbox
      .stub(User, "find")
      .callsFake((id: string) => Promise.resolve(id === testUserDetail.id ? testUserDetail : null));
    sandbox.stub(User, "findOrFail").callsFake((id: string) => {
      if (id !== testUserDetail.id) {
        return Promise.reject(new Error("user not found"));
      }
      return Promise.resolve(testUserDetail);
    });

    sandbox.stub(paymentHandler, "confirmPayments").callsFake(() => {
      if (!paymentsConfirmed) {
        return Promise.reject(new BlError("could not confirm payments"));
      }

      return Promise.resolve([testPayment]);
    });

    // 5) Stub BlStorage.Orders as a single object
    const ordersStub = {
      update: sandbox.stub().callsFake(() => {
        if (!orderUpdate) {
          return Promise.reject(new BlError("could not update order"));
        }
        return Promise.resolve(testOrder);
      }),
      get: sandbox.stub().callsFake(
        () =>
          // If you need custom logic, do it here. Otherwise:
          Promise.resolve(testOrder), // or whatever you need
      ),
    };
    sandbox.stub(StorageService, "Orders").value(ordersStub);

    sandbox.stub(OrderEmailHandler, "sendOrderReceipt").resolves();

    paymentsConfirmed = true;
    orderUpdate = true;

    testOrder = {
      id: "branch1",
      amount: 100,
      orderItems: [
        {
          handout: false,
          delivered: false,
          type: "rent",
          item: "item2",
          title: "Signatur 3: Tekstsammling",
          amount: 50,
          unitPrice: 100,
          info: {
            from: new Date(),
            to: new Date(),
            numberOfPeriods: 1,
            periodType: "semester",
          },
        },
      ],
      branch: "branch1",
      customer: "customer1",
      byCustomer: true,
      placed: true,
      payments: [],
      delivery: "delivery1",
      notification: { email: false },
    };

    testPayment = {
      id: "payment1",
      method: "vipps-checkout",
      order: "order1",
      amount: 200,
      customer: "customer1",
      branch: "branch1",
      confirmed: false,
      info: {
        paymentId: "vipps-checkout1",
      },
    };

    testAccessToken = {
      iss: "boklisten.co",
      aud: "boklisten.co",
      iat: 1,
      exp: 1,
      sub: "userDetail1",
      permission: "customer",
      details: "userDetail1",
      username: "user@name.com",
    };

    testUserDetail = userDouble({ id: "customer1" });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if order could not be updated with confirm true", async ({ assert }) => {
    orderUpdate = false;

    const err = await orderPlacedHandler.placeOrder(testOrder, testAccessToken.details).then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), "could not update order");
  });

  test("should reject if paymentHandler.confirmPayments rejects", async ({ assert }) => {
    paymentsConfirmed = false;

    const err = await orderPlacedHandler.placeOrder(testOrder, testAccessToken.details).then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), "could not confirm payments");
  });

  test("should reject if order.customer is not found", async ({ assert }) => {
    testOrder.customer = "notFoundUserDetails";

    const err = await orderPlacedHandler.placeOrder(testOrder, testAccessToken.details).then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), 'customer "notFoundUserDetails" not found');
  });

  test("should resolve when order was placed", async ({ assert }) =>
    assert.doesNotReject(() => orderPlacedHandler.placeOrder(testOrder, testAccessToken.details)));
});
