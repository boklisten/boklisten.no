import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { OrderConfirmOperation } from "#services/legacy/collections/order/operations/confirm/order-confirm.operation";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";

test.group("OrderConfirmOperation", (group) => {
  const orderPlacedHandler = new OrderPlacedHandler();

  let orderGetStub: sinon.SinonStub;

  const orderConfirmOperation = new OrderConfirmOperation(orderPlacedHandler);
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    orderGetStub = sandbox.stub(StorageService.Orders, "get");
    sandbox.stub(orderPlacedHandler, "placeOrder");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if order is not found", async ({ assert }) => {
    orderGetStub.rejects(new BlError("not found").code(702));

    return assert.rejects(
      () =>
        orderConfirmOperation.run({
          documentId: "order1",
          user: { id: "user1", permission: "customer", details: "" },
        }),
      BlError,
      /order "order1" not found/,
    );
  });
});
