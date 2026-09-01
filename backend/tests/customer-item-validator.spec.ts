import { test } from "@japa/runner";

import { CustomerItemValidator } from "#services/legacy/collections/customer-item/validators/customer-item-validator";
import { BlError } from "#shared/bl-error";

test.group("CustomerItemValidator", async () => {
  const customerItemValidator = new CustomerItemValidator();
  test("should reject if sent customerItem is undefined", async ({ assert }) =>
    assert.rejects(
      // @ts-expect-error fixme: auto ignored
      () => customerItemValidator.validate(undefined),
      BlError,
      /customerItem is undefined/,
    ));
});
