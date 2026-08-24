import { test } from "@japa/runner";

import { ItemValidator } from "#services/legacy/collections/order/helpers/order-validator/item-validator/item-validator";
import { BlError } from "#shared/bl-error";
import { Item } from "#shared/item";
import { OrderItem } from "#shared/order/order-item/order-item";

test.group("ItemValidator", (group) => {
  let testItem: Item;
  let testOrderItem: OrderItem;
  const itemValidator: ItemValidator = new ItemValidator();

  group.each.setup(() => {
    testItem = {
      id: "i1",
      buyback: false,
      title: "Signatur 2",
      info: {
        isbn: 0,
        subject: "",
        year: 0,
        price: {},
        weight: "",
        distributor: "",
        discount: 0,
        publisher: "",
      },
      price: 100,
      creationTime: new Date(),
      lastUpdated: new Date(),
      active: true,
    };

    testOrderItem = {
      item: "i1",
      title: "signatur 3",
      unitPrice: 100,
      amount: 100,
      type: "rent",
    };
  });

  test("should return true when using valid orderItem and valid item", async ({ assert }) => {
    // oxlint-disable-next-line no-unused-expressions
    assert.isTrue(itemValidator.validateItemInOrder(testItem, testOrderItem));
  });

  test("should throw BlError when orderItem.item is not the same as item.id", async ({
    assert,
  }) => {
    testItem.id = "notarealId";
    testOrderItem.item = "i4";

    assert.throws(() => {
      itemValidator.validateItemInOrder(testItem, testOrderItem);
    }, BlError);
  });

  test("should throw error when item.actve is false", async ({ assert }) => {
    testItem.active = false;

    assert.throws(
      () => {
        itemValidator.validateItemInOrder(testItem, testOrderItem);
      },
      BlError,
      /item.active is false/,
    );
  });
});
