import { test } from "@japa/runner";

import { OrderHookBefore } from "#services/legacy/collections/order/hooks/order-hook-before";
import { BlError } from "#shared/bl-error";

test.group("OrderHookBefore", async () => {
  const orderHookBefore: OrderHookBefore = new OrderHookBefore();

  test("should reject if body is an array", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    const testRequest = [];

    return assert.rejects(
      // @ts-expect-error fixme: auto ignored
      () => orderHookBefore.validate(testRequest),
      BlError,
      /request is an array but should be a object/,
    );
  });

  test("should reject if body does not include the minimum required fields of order like amount and orderItems", async ({
    assert,
  }) => {
    const testRequest = {
      somethingRandom: ["hi", "hello there"],
    };

    const blError = await orderHookBefore.validate(testRequest).then(
      () => null,
      (caught: BlError) => caught,
    );
    assert.instanceOf(blError, BlError);
    assert.include(blError?.getMsg() ?? "", "the request body is not valid");
    assert.equal(blError?.getCode(), 701);
  });

  test("should resolve if the request have the minimum required fields of Order", async ({
    assert,
  }) => {
    const testRequest = {
      id: "order1",
      amount: 450,
      orderItems: [
        {
          type: "buy",
          amount: 300,
          item: "i1",
          title: "signatur",
          rentRate: 0,
          unitPrice: 300,
        },
        {
          type: "rent",
          amount: 150,
          item: "i2",
          customerItem: "ci2",
          title: "signatur",
          rentRate: 0,
          unitPrice: 300,
          rentInfo: {
            oneSemester: true,
            twoSemesters: false,
          },
        },
      ],
      delivery: "delivery1",
      branch: "b1",
      byCustomer: true,
      payments: ["payment1"],
      active: false,
      user: {
        id: "u1",
      },
      lastUpdated: new Date(),
      creationTime: new Date(),
    };

    assert.isTrue(await orderHookBefore.validate(testRequest));
  });
});
