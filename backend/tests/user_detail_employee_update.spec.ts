import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import User from "#models/user";
import { UserService } from "#services/user_service";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

function underageDob(): DateTime {
  return DateTime.now().startOf("day").minus({ years: 16 });
}

test.group("UserService.updateAsEmployee", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("clears the confirm-details task when the saved details are complete", async ({
    assert,
  }) => {
    const user = await createUser({ id: CUSTOMER_ID, taskConfirmDetails: true });

    const result = await UserService.updateAsEmployee(user, { name: "Ny Navnesen" });

    assert.equal(result.name, "Ny Navnesen");
    assert.isFalse(result.taskConfirmDetails);
    const stored = await User.findOrFail(CUSTOMER_ID);
    assert.equal(stored.name, "Ny Navnesen");
    assert.isFalse(stored.taskConfirmDetails);
  });

  test("sets the confirm-details task when the customer becomes underage without guardian info", async ({
    assert,
  }) => {
    const user = await createUser({ id: CUSTOMER_ID });

    const result = await UserService.updateAsEmployee(user, {
      dob: underageDob(),
      guardianName: null,
      guardianEmail: null,
      guardianPhone: null,
    });

    assert.isTrue(result.taskConfirmDetails);
    assert.isTrue((await User.findOrFail(CUSTOMER_ID)).taskConfirmDetails);
  });

  test("clears the task for an underage customer once guardian info is complete", async ({
    assert,
  }) => {
    const user = await createUser({
      id: CUSTOMER_ID,
      dob: underageDob(),
      taskConfirmDetails: true,
    });

    const result = await UserService.updateAsEmployee(user, {
      guardianName: "Foresatt Foresattsen",
      guardianEmail: "foresatt@example.com",
      guardianPhone: "87654321",
    });

    assert.isFalse(result.taskConfirmDetails);
    assert.isFalse((await User.findOrFail(CUSTOMER_ID)).taskConfirmDetails);
  });

  test("sets the task when a required field is emptied", async ({ assert }) => {
    const user = await createUser({ id: CUSTOMER_ID });

    const result = await UserService.updateAsEmployee(user, { address: "" });

    assert.isTrue(result.taskConfirmDetails);
  });
});
