import { test } from "@japa/runner";
import vine from "@vinejs/vine";

import { userFieldsSchema } from "#validators/users";

const { name, address } = userFieldsSchema.getProperties();
const validator = vine.create(vine.object({ name, address }));

test.group("user fields validator", () => {
  test("cleans the name and address", async ({ assert }) => {
    assert.deepEqual(await validator.validate({ name: "kari  nordmann", address: "testveien 1" }), {
      name: "Kari Nordmann",
      address: "Testveien 1",
    });
  });

  test("refuses separators alone, which would clean to an empty string", async ({ assert }) => {
    await assert.rejects(() => validator.validate({ name: " - ", address: "Testveien 1" }));
    await assert.rejects(() => validator.validate({ name: "Kari", address: "--" }));
  });
});
