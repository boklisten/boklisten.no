import { test } from "@japa/runner";
import vine from "@vinejs/vine";

import { phoneField } from "#validators/common/fields";

const validator = vine.create(vine.object({ phone: phoneField.clone() }));

test.group("phoneField", () => {
  test("stores a Norwegian mobile number as its eight digits", async ({ assert }) => {
    assert.deepEqual(await validator.validate({ phone: "91234567" }), { phone: "91234567" });
    assert.deepEqual(await validator.validate({ phone: " +47 912 34 567 " }), {
      phone: "91234567",
    });
    assert.deepEqual(await validator.validate({ phone: "004741234567" }), { phone: "41234567" });
  });

  test("rejects numbers that are not Norwegian mobiles", async ({ assert }) => {
    for (const phone of ["12345678", "9123456", "+46701234567", "abc"]) {
      await assert.rejects(() => validator.validate({ phone }));
    }
  });
});
