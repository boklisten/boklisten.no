import { test } from "@japa/runner";

import { CustomerItemActive } from "#services/legacy/collections/customer-item/helpers/customer-item-active";
import { CustomerItem } from "#shared/customer-item/customer-item";

test.group("CustomerItemActive", async () => {
  const customerItemActive = new CustomerItemActive();

  test("should resolve false if customerItem.returned is set to true", async ({ assert }) => {
    const customerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      blid: "blid1",
      customer: "customer1",
      deadline: new Date(),
      handout: true,
      returned: true,
      buyout: false,
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isFalse(customerItemActive.isActive(customerItem));
  });

  test("should resolve false if customerItem.buyout is set to true", async ({ assert }) => {
    const customerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      blid: "blid1",
      customer: "customer1",
      deadline: new Date(),
      handout: true,
      returned: false,
      buyout: true,
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isFalse(customerItemActive.isActive(customerItem));
  });

  test("should resolve false if customerItem.cancel is set to true", async ({ assert }) => {
    const customerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      blid: "blid1",
      customer: "customer1",
      deadline: new Date(),
      handout: true,
      returned: false,
      buyout: false,
      cancel: true,
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isFalse(customerItemActive.isActive(customerItem));
  });

  test("should resolve false if customerItem.buyback is set to true", async ({ assert }) => {
    const customerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      blid: "blid1",
      customer: "customer1",
      deadline: new Date(),
      handout: true,
      returned: false,
      buyout: false,
      cancel: false,
      buyback: true,
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isFalse(customerItemActive.isActive(customerItem));
  });

  test("should resolve true if customerItem is active", async ({ assert }) => {
    const customerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      blid: "blid1",
      customer: "customer1",
      deadline: new Date(),
      handout: true,
      returned: false,
      buyout: false,
    };

    // oxlint-disable-next-line no-unused-expressions
    assert.isTrue(customerItemActive.isActive(customerItem));
  });
});
