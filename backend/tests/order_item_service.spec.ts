import { test } from "@japa/runner";

import { OrderItemService } from "#services/order_item_service";
import { Item } from "#shared/item";
import { mock } from "#tests/test-doubles";

const ITEM_ID = "6100000000000000000000a1";

test.group("OrderItemService.createBuyOrderItem", () => {
  test("rounds the price down to the nearest 10 kr", ({ assert }) => {
    const orderItem = OrderItemService.createBuyOrderItem(
      mock<Item>({
        id: ITEM_ID,
        title: "Kjemien stemmer",
        price: 829,
      }),
    );
    assert.equal(orderItem.amount, 820);
    assert.equal(orderItem.unitPrice, 820);
  });

  test("keeps prices that are already a multiple of 10 kr", ({ assert }) => {
    const orderItem = OrderItemService.createBuyOrderItem(
      mock<Item>({
        id: ITEM_ID,
        title: "Kjemien stemmer",
        price: 500,
      }),
    );
    assert.equal(orderItem.amount, 500);
    assert.equal(orderItem.unitPrice, 500);
  });
});
