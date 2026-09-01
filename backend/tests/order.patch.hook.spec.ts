import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { OrderPatchHook } from "#services/legacy/collections/order/hooks/order.patch.hook";
import { StorageService } from "#services/storage_service";
import type { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

test.group("OrderPatchHook", (group) => {
  const orderValidator = new OrderValidator();
  const orderPlacedHandler = new OrderPlacedHandler();
  const orderPatchHook = new OrderPatchHook(orderValidator, orderPlacedHandler);

  let testAccessToken: AccessToken;
  let testRequestBody: any;
  let testOrder: Order;
  let orderUpdated = true;
  let orderValidated = true;
  let userDetailUpdated = true;
  let testUserDetail: UserDetail;
  let orderPlacedConfirmed: boolean;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testRequestBody = {
      placed: true,
    };

    orderUpdated = true;
    orderValidated = true;
    userDetailUpdated = true;
    orderPlacedConfirmed = true;

    testUserDetail = {
      customerItems: [],
      id: "userDetail1",
      name: "albert",
      email: "bill@b.com",
      phone: "1241234",
      address: "",
      postCode: "123",
      postCity: "oslo",
      dob: new Date(),
      emailConfirmed: false,
      orders: [],
      blid: "",
    };

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

    testAccessToken = {
      iss: "boklisten.no",
      aud: "boklisten.no",
      iat: 123,
      exp: 123,
      sub: "user1",
      username: "billy@bob.com",
      permission: "customer",
      details: "userDetail1",
    };

    sandbox = createSandbox();
    sandbox.stub(StorageService.Orders, "get").callsFake((id) => {
      if (id !== testOrder.id) {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testOrder);
    });

    sandbox.stub(orderPlacedHandler, "placeOrder").callsFake(() => {
      if (!orderPlacedConfirmed) {
        return Promise.reject(new BlError("could not place order"));
      }
      return Promise.resolve(mock<Order>({}));
    });

    sandbox.stub(StorageService.UserDetails, "update").callsFake((id, data) => {
      if (!userDetailUpdated) {
        return Promise.reject(new BlError("could not update"));
      }

      if (data.orders) {
        testUserDetail.orders = data.orders;
      }

      return Promise.resolve(mock<UserDetail>({}));
    });

    sandbox.stub(StorageService.UserDetails, "get").callsFake((id) => {
      if (id !== testUserDetail.id) {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testUserDetail);
    });

    sandbox.stub(StorageService.Orders, "update").callsFake(() => {
      if (!orderUpdated) {
        return Promise.reject(new BlError("could not update"));
      }
      return Promise.resolve(testOrder);
    });

    sandbox
      .stub(orderValidator, "validate")

      .callsFake(() => {
        if (!orderValidated) {
          return Promise.reject(new BlError("could not validate"));
        }
        return Promise.resolve(true);
      });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if body is empty or undefined", async ({ assert }) =>
    assert.rejects(
      () => orderPatchHook.before(undefined, testAccessToken, "order1"),
      BlError,
      /body not defined/,
    ));

  test("should reject if accessToken is empty or undefined", async ({ assert }) =>
    assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderPatchHook.before({ placed: true }, undefined, "order1"),
      BlError,
      /accessToken not defined/,
    ));

  test("should reject if id is not defined", async ({ assert }) =>
    assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderPatchHook.before(testRequestBody, testAccessToken, null),
      BlError,
      /id not defined/,
    ));

  test("should reject if accessToken is not defined", async ({ assert }) =>
    assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderPatchHook.after([testOrder]),
      BlError,
      /accessToken not defined/,
    ));

  test("should reject if OrderPlaced.placeOrder rejects", async ({ assert }) => {
    testOrder.placed = true;
    orderPlacedConfirmed = false;

    return assert.rejects(
      () => orderPatchHook.after([testOrder], testAccessToken),
      "order could not be placed",
    );
  });
});
