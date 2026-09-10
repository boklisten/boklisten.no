import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { PaymentHandler } from "#services/orders/payment_handler";
import { StorageService } from "#services/storage_service";
import type { Order } from "#shared/order/order";
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
      .stub(StorageService.Payments, "getMany")
      .resolves([
        mock<Payment>({ id: "p1", method: "bank-transfer", amount: -250, confirmed: false }),
      ]);
    const order = mock<Order>({ id: "o1", amount: -250, payments: ["p1"], byCustomer: false });

    await new PaymentHandler().confirmPayments(order);

    assert.deepEqual(update.firstCall.args, ["p1", { confirmed: true }]);
  });
});
