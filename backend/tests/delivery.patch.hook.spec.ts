import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { DeliveryValidator } from "#services/legacy/collections/delivery/helpers/deliveryValidator/delivery-validator";
import { DeliveryPatchHook } from "#services/legacy/collections/delivery/hooks/delivery.patch.hook";
import { StorageService } from "#services/storage_service";
import { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import { Delivery } from "#shared/delivery/delivery";
import { Order } from "#shared/order/order";

chaiUse(chaiAsPromised);
should();

test.group("DeliveryPatchHook", (group) => {
  const deliveryValidator = new DeliveryValidator();
  const deliveryPatchHook = new DeliveryPatchHook(deliveryValidator);

  let testRequest: any;
  let testDelivery: Delivery;
  let testAccessToken: AccessToken;
  let testOrder: Order;
  let deliveryValidated = true;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 100,
      orderItems: [],
      branch: "branch1",
      customer: "customer1",
      byCustomer: true,
      delivery: "delivery1",
    };

    deliveryValidated = true;

    testAccessToken = {
      iss: "boklisten.no",
      aud: "boklisten.no",
      iat: 123,
      exp: 323,
      sub: "user1",
      username: "a@b.com",
      permission: "customer",
      details: "userDetails1",
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

    testRequest = {
      method: "bring",
      info: {
        from: "0560",
        to: "7070",
      },
      order: "order1",
      amount: 0,
    };

    sandbox = createSandbox();
    sandbox.stub(StorageService.Deliveries, "get").callsFake((id) => {
      if (id !== testDelivery.id) {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testDelivery);
    });

    sandbox.stub(StorageService.Orders, "get").callsFake((id) => {
      if (id !== testOrder.id) {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testOrder);
    });

    sandbox.stub(deliveryValidator, "validate").callsFake(() => {
      if (!deliveryValidated) {
        return Promise.reject(new BlError("could not validate delivery"));
      }
      return Promise.resolve(true);
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should resolve if all parameters are valid", async () => {
    return expect(deliveryPatchHook.before(testRequest, testAccessToken, "delivery1")).to.be
      .fulfilled;
  });

  test("should reject if id is undefined", async () => {
    return expect(
      deliveryPatchHook.before(testRequest, testAccessToken, undefined),
    ).to.be.rejectedWith(BlError, /id is undefined/);
  });

  test("should reject if body is empty or undefined", async () => {
    return expect(deliveryPatchHook.before(null, testAccessToken, "delivery1")).to.be.rejectedWith(
      BlError,
      /body is undefined/,
    );
  });

  test("should reject if accessToken is empty or undefined", async () => {
    return expect(deliveryPatchHook.before(testRequest, undefined, "delivery1")).to.be.rejectedWith(
      BlError,
      /accessToken is undefined/,
    );
  });

  test("should reject if delivery is not found", async () => {
    return expect(
      deliveryPatchHook.before(testRequest, testAccessToken, "deliveryNotFound"),
    ).to.be.rejectedWith(BlError, /delivery "deliveryNotFound" not found/);
  });

  test("should reject if deliveryValidator fails", async () => {
    deliveryValidated = false;

    return expect(
      deliveryPatchHook.before(testRequest, testAccessToken, "delivery1"),
    ).to.be.rejectedWith(BlError, /patched delivery could not be validated/);
  });
});
