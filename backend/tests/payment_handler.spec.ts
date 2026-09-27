import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import type Order from "#models/order";
import { PaymentHandler } from "#services/orders/payment_handler";
import { OrderPayments } from "#services/payments/order_payments";
import { StorageService } from "#services/storage_service";
import type { Payment } from "#shared/payment/payment";
import { mock } from "#tests/test-doubles";

test.group("PaymentHandler.confirmPayments", (group) => {
  let sandbox: sinon.SinonSandbox;
  let update: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    update = sandbox.stub(StorageService.Payments, "update").resolves(mock<Payment>({}));
  });
  group.each.teardown(() => sandbox.restore());

  test("confirms a refund the administrator makes by bank transfer", async ({ assert }) => {
    sandbox
      .stub(OrderPayments, "of")
      .withArgs("o1")
      .resolves([
        mock<Payment>({ id: "p1", method: "bank-transfer", amount: -250, confirmed: false }),
      ]);
    const order = mock<Order>({ id: "o1", amount: -250, byCustomer: false });

    await new PaymentHandler().confirmPayments(order);

    assert.deepEqual(update.firstCall.args, ["p1", { confirmed: true }]);
  });
});
