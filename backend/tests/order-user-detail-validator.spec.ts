import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderUserDetailValidator } from "#services/legacy/collections/order/helpers/order-validator/order-user-detail-validator/order-user-detail-validator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

test.group("OrderUserDetailValidator", (group) => {
  const orderUserDetailValidator = new OrderUserDetailValidator();
  let testOrder: Order;
  let testUserDetail: UserDetail;

  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    testOrder = mock<Order>({
      id: "order1",
      customer: "userDetail1",
    });

    testUserDetail = mock<UserDetail>({
      id: "userDetail1",
      emailConfirmed: true,
    });
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "get").callsFake((id) => {
      if (id !== testUserDetail.id) {
        return Promise.reject(new BlError("could not get userDetail"));
      }

      return Promise.resolve(testUserDetail);
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if userDetail is not found", async ({ assert }) => {
    testOrder.customer = "notFound";

    const err = await orderUserDetailValidator.validate(testOrder).then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), "could not get userDetail");
  });

  test("should resolve if userDetail is valid", async ({ assert }) =>
    assert.doesNotReject(() => orderUserDetailValidator.validate(testOrder)));
});
