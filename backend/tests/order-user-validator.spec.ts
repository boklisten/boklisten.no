import { test } from "@japa/runner";
import { stub } from "sinon";

import type Order from "#models/order";
import User from "#models/user";
import { OrderUserValidator } from "#services/orders/validation/order_user_validator";
import { BlError } from "#shared/bl-error";
import { mock } from "#tests/test-doubles";
import { userDouble } from "#tests/user_fixtures";

test.group("OrderUserValidator", (group) => {
  const orderUserValidator = new OrderUserValidator();
  const customer = userDouble({ id: "user1" });
  let testOrder: Order;

  group.each.setup(() => {
    testOrder = mock<Order>({
      id: "order1",
      customerId: "user1",
    });
    stub(User, "find").callsFake((id) => Promise.resolve(id === customer.id ? customer : null));
  });

  test("should reject if the user is not found", async ({ assert }) => {
    testOrder.customerId = "notFound";

    const err = await orderUserValidator.validate(testOrder).then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.getMsg(), "user not found");
  });

  test("should resolve if the user is valid", async ({ assert }) =>
    assert.doesNotReject(() => orderUserValidator.validate(testOrder)));
});
