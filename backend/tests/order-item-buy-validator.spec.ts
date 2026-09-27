import { test } from "@japa/runner";

import type OrderItem from "#models/order_item";
import { OrderItemBuyValidator } from "#services/orders/validation/order_item_buy_validator";
import { PriceService } from "#services/price_service";
import { BlError } from "#shared/bl-error";
import type { Item } from "#shared/item";
import { mock } from "#tests/test-doubles";

test.group("OrderItemBuyValidator", (group) => {
  const priceService = new PriceService();
  const orderItemPriceValidator = new OrderItemBuyValidator(priceService);

  let testOrderItem: OrderItem;
  let testItem: Item;

  group.each.setup(() => {
    testOrderItem = mock<OrderItem>({
      handout: false,
      delivered: false,
      itemId: "item1",
      amount: 600,
      unitPrice: 600,
      type: "buy",
      movedFromOrderId: null,
    });

    testItem = {
      id: "item1",
      title: "Signatur 3",
      price: 600,

      buyback: false,
      active: true,
      isbn: 0,
      subject: "",
      year: 0,
      weight: null,
      distributor: "",
      discount: 0,
      publisher: "",
      priceHistory: {},
    };
  });

  test("should resolve when a valid order is passed", async ({ assert }) =>
    assert.doesNotReject(() => orderItemPriceValidator.validate(testOrderItem, testItem)));

  test("should reject when item.price is 200 and orderItem.amount is 100", async ({ assert }) => {
    testOrderItem.amount = 100;
    testItem.price = 200;

    return assert.rejects(
      () => orderItemPriceValidator.validate(testOrderItem, testItem),
      BlError,
      /orderItem.amount "100" is not equal to item.price "200" = "200"/,
    );
  });

  test("should reject if item.price is 134 and orderItem.amount is 400", async ({ assert }) => {
    testOrderItem.amount = 400;
    testItem.price = 134;

    return assert.rejects(
      () => orderItemPriceValidator.validate(testOrderItem, testItem),
      BlError,
      /orderItem.amount "400" is not equal to item.price "134" = "134"/,
    );
  });
});
