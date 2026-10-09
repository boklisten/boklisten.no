import { test } from "@japa/runner";

import { assertLoginDetailsEditable } from "#services/user_service";
import { userDouble } from "#tests/user_fixtures";

const SAME = { phone: "90000000", email: "kari@example.com" };

test.group("assertLoginDetailsEditable", () => {
  test("an employee may change a customer's phone and email", ({ assert }) => {
    assert.doesNotThrow(() =>
      assertLoginDetailsEditable("employee", userDouble(), {
        phone: "41111111",
        email: "ny@example.com",
      }),
    );
  });

  test("an employee may not change a staff account's phone or email", ({ assert }) => {
    for (const permission of ["employee", "admin"] as const) {
      const staff = userDouble({ permission });
      assert.throws(() =>
        assertLoginDetailsEditable("employee", staff, { ...SAME, phone: "41111111" }),
      );
      assert.throws(() =>
        assertLoginDetailsEditable("employee", staff, { ...SAME, email: "ny@example.com" }),
      );
    }
  });

  test("an employee may save a staff account's other details unchanged", ({ assert }) => {
    const admin = userDouble({ permission: "admin", email: "Kari@Example.com" });
    assert.doesNotThrow(() => assertLoginDetailsEditable("employee", admin, SAME));
  });

  test("an admin may change anyone's phone and email", ({ assert }) => {
    assert.doesNotThrow(() =>
      assertLoginDetailsEditable("admin", userDouble({ permission: "admin" }), {
        phone: "41111111",
        email: "ny@example.com",
      }),
    );
  });
});
