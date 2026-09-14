import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { StorageService } from "#services/storage_service";
import { UserDetailService } from "#services/user_detail_service";
import type { UserDetail } from "#shared/user-detail";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

function makeUserDetail(overrides: Partial<UserDetail> = {}): UserDetail {
  return {
    id: CUSTOMER_ID,
    name: "Test Testersen",
    email: "test@example.com",
    phone: "12345678",
    address: "Testveien 1",
    postCode: "0123",
    postCity: "OSLO",
    dob: new Date(1990, 0, 1),
    emailConfirmed: false,
    blid: "u#test",
    orders: [],
    customerItems: [],
    // The storage layer adds this flag to every document; validity depends on it.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- not part of the shared type
    ...({ active: true } as Partial<UserDetail>),
    ...overrides,
  };
}

function underageDob(): Date {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 16);
  return dob;
}

test.group("UserDetailService.updateAsEmployee", (group) => {
  let sandbox: sinon.SinonSandbox;
  let stored: UserDetail;
  let updateStub: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    stored = makeUserDetail();
    updateStub = sandbox.stub().callsFake((id: string, data: Record<string, unknown>) => {
      const { "tasks.confirmDetails": confirmDetails, ...rest } = data;
      stored = { ...stored, ...rest };
      if (confirmDetails !== undefined) {
        stored = { ...stored, tasks: { ...stored.tasks, confirmDetails: Boolean(confirmDetails) } };
      }
      return Promise.resolve(stored);
    });
    sandbox.stub(StorageService, "UserDetails").value({ update: updateStub });
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("clears the confirm-details task when the saved details are complete", async ({
    assert,
  }) => {
    stored = makeUserDetail({ tasks: { confirmDetails: true } });

    const result = await UserDetailService.updateAsEmployee(CUSTOMER_ID, { name: "Ny Navnesen" });

    assert.equal(result.name, "Ny Navnesen");
    assert.isFalse(result.tasks?.confirmDetails);
  });

  test("sets the confirm-details task when the customer becomes underage without guardian info", async ({
    assert,
  }) => {
    const result = await UserDetailService.updateAsEmployee(CUSTOMER_ID, {
      dob: underageDob(),
      guardian: { name: "", email: "", phone: "" },
    });

    assert.isTrue(result.tasks?.confirmDetails);
  });

  test("clears the task for an underage customer once guardian info is complete", async ({
    assert,
  }) => {
    stored = makeUserDetail({ dob: underageDob(), tasks: { confirmDetails: true } });

    const result = await UserDetailService.updateAsEmployee(CUSTOMER_ID, {
      guardian: { name: "Foresatt Foresattsen", email: "foresatt@example.com", phone: "87654321" },
    });

    assert.isFalse(result.tasks?.confirmDetails);
  });

  test("writes the task flag against the id that was updated", async ({ assert }) => {
    await UserDetailService.updateAsEmployee(CUSTOMER_ID, { dob: underageDob() });

    assert.isTrue(updateStub.alwaysCalledWith(CUSTOMER_ID));
    assert.isTrue(
      updateStub.lastCall.calledWithExactly(CUSTOMER_ID, { "tasks.confirmDetails": true }),
    );
  });
});
