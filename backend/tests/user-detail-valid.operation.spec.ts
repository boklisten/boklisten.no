import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { UserDetailValidOperation } from "#services/legacy/collections/user-detail/operations/user-detail-valid.operation";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import type { UserDetail } from "#shared/user-detail";
import type { BlApiRequest } from "#types/bl-api-request";
import { mock } from "#tests/test-doubles";

test.group("UserDetailValidOperation", (group) => {
  const userDetailValidOperation = new UserDetailValidOperation();

  let testUserDetail: UserDetail;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "get").callsFake((id) => {
      if (id !== testUserDetail.id) {
        return Promise.reject(new BlError(`userDetail "${id}" not found`));
      }

      return Promise.resolve(testUserDetail);
    });

    testUserDetail = {
      orders: [],
      customerItems: [],
      id: "userDetail1",
      name: "Freddy Mercury",
      email: "freddy@blapi.co",
      phone: "12345678",
      address: "Star road 1",
      postCode: "0123",
      postCity: "LONDON",
      dob: new Date(1946, 9, 5),
      emailConfirmed: true,
      blid: "",
      branchMembership: "branch1",
    };
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if userDetail is not found", async ({ assert }) => {
    testUserDetail = mock<UserDetail>({
      id: "userDetail1",
    });

    const blApiRequest = {
      documentId: "notFoundUserDetail",
    };
    await assert.rejects(() =>
      // @ts-expect-error fixme: auto ignored
      userDetailValidOperation.run(blApiRequest, null, null),
    );
  });

  test("should send response with {valid: true}", async ({ assert }) => {
    const blApiRequest = {
      documentId: "userDetail1",
    };
    const expected = new BlapiResponse([{ valid: true }]);

    const response = await userDetailValidOperation.run(
      blApiRequest,
      // @ts-expect-error fixme: auto ignored
      null,
      null,
    );
    assert.deepEqual(response, expected);
  });

  test("should resolve with valid false if name is not defined", async ({ assert }) => {
    testUserDetail.name = "";
    const blApiRequest: BlApiRequest = {
      documentId: "userDetail1",
    };

    const response = await userDetailValidOperation.run(
      blApiRequest,
      // @ts-expect-error fixme: auto ignored
      null,
      null,
    );
    assert.deepEqual(response, new BlapiResponse([{ valid: false, invalidFields: ["name"] }]));
  });

  test("should resolve with valid false if address and postCode is not defined", async ({
    assert,
  }) => {
    testUserDetail.address = "";

    // @ts-expect-error fixme: auto ignored
    testUserDetail.postCode = null;
    const blApiRequest: BlApiRequest = {
      documentId: "userDetail1",
    };
    const expected = new BlapiResponse([{ valid: false, invalidFields: ["address", "postCode"] }]);

    const response = await userDetailValidOperation.run(
      blApiRequest,
      // @ts-expect-error fixme: auto ignored
      null,
      null,
    );
    assert.deepEqual(response, expected);
  });

  test("should resolve with valid false if postCity and phone is not defined", async ({
    assert,
  }) => {
    testUserDetail.postCity = "";

    // @ts-expect-error fixme: auto ignored
    testUserDetail.phone = undefined;
    const blApiRequest: BlApiRequest = {
      documentId: "userDetail1",
    };
    const expected = new BlapiResponse([{ valid: false, invalidFields: ["postCity", "phone"] }]);

    const response = await userDetailValidOperation.run(
      blApiRequest,
      // @ts-expect-error fixme: auto ignored
      null,
      null,
    );
    assert.deepEqual(response, expected);
  });

  test("should resolve with valid false with guardian fields if user is underage and guardian is missing", async ({
    assert,
  }) => {
    const now = new Date();
    testUserDetail.dob = new Date(now.getFullYear() - 16, now.getMonth(), now.getDate());
    const blApiRequest: BlApiRequest = {
      documentId: "userDetail1",
    };
    const expected = new BlapiResponse([
      { valid: false, invalidFields: ["guardian.name", "guardian.email", "guardian.phone"] },
    ]);

    const response = await userDetailValidOperation.run(
      blApiRequest,
      // @ts-expect-error fixme: auto ignored
      null,
      null,
    );
    assert.deepEqual(response, expected);
  });

  test("should resolve with valid true if user is underage and guardian is filled in", async ({
    assert,
  }) => {
    const now = new Date();
    testUserDetail.dob = new Date(now.getFullYear() - 16, now.getMonth(), now.getDate());
    testUserDetail.guardian = {
      name: "Guardian Mercury",
      email: "guardian@blapi.co",
      phone: "87654321",
    };
    const blApiRequest: BlApiRequest = {
      documentId: "userDetail1",
    };
    const expected = new BlapiResponse([{ valid: true }]);

    const response = await userDetailValidOperation.run(
      blApiRequest,
      // @ts-expect-error fixme: auto ignored
      null,
      null,
    );
    assert.deepEqual(response, expected);
  });

  test("should resolve with valid false if dob is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testUserDetail.dob = undefined;
    const blApiRequest: BlApiRequest = {
      documentId: "userDetail1",
    };
    const expected = new BlapiResponse([{ valid: false, invalidFields: ["dob"] }]);

    const response = await userDetailValidOperation.run(
      blApiRequest,
      // @ts-expect-error fixme: auto ignored
      null,
      null,
    );
    assert.deepEqual(response, expected);
  });
});
