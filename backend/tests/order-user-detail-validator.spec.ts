import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import type Order from "#models/order";
import User from "#models/user";
import { OrderUserDetailValidator } from "#services/orders/validation/order_user_detail_validator";
import { BlError } from "#shared/bl-error";
import { mock } from "#tests/test-doubles";
import { userDouble } from "#tests/user_fixtures";

test.group("OrderUserDetailValidator", (group) => {
  const orderUserDetailValidator = new OrderUserDetailValidator();
  const customer = userDouble({ id: "userDetail1" });
  let testOrder: Order;

  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    testOrder = mock<Order>({
      id: "order1",
      customerId: "userDetail1",
    });
    sandbox = createSandbox();
    sandbox
      .stub(User, "find")
      .callsFake((id) => Promise.resolve(id === customer.id ? customer : null));
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if userDetail is not found", async ({ assert }) => {
    testOrder.customerId = "notFound";

    const err = await orderUserDetailValidator.validate(testOrder).then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.getMsg(), "userDetail not found");
  });

  test("should resolve if userDetail is valid", async ({ assert }) =>
    assert.doesNotReject(() => orderUserDetailValidator.validate(testOrder)));
});
