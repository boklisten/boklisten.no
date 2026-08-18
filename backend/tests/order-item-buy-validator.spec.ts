import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";

import { OrderItemBuyValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-buy-validator/order-item-buy-validator";
import { PriceService } from "#services/legacy/price.service";
import { BlError } from "#shared/bl-error";
import { Item } from "#shared/item";
import { Order } from "#shared/order/order";

chaiUse(chaiAsPromised);
should();

test.group("OrderItemBuyValidator", (group) => {
  const priceService = new PriceService();
  const orderItemPriceValidator = new OrderItemBuyValidator(priceService);

  let testOrder: Order;
  let testItem: Item;

  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 600,
      customer: "",
      orderItems: [
        {
          item: "item1",
          title: "Spinn",
          amount: 600,
          unitPrice: 600,
          type: "buy",
          info: {
            from: new Date(),
            to: new Date(),
            numberOfPeriods: 1,
            periodType: "semester",
          },
        },
      ],
      delivery: "delivery1",
      branch: "branch1",
      byCustomer: true,
      payments: ["payment1"],
    };

    testItem = {
      id: "item1",
      title: "Signatur 3",
      price: 600,

      buyback: false,
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
    };
  });

  group.each.setup(() => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].type = "buy";
  });

  test("should resolve when a valid order is passed", async () => {
    return expect(
      orderItemPriceValidator.validate(
        // @ts-expect-error fixme: auto ignored
        testOrder.orderItems[0],
        testItem,
      ),
    ).to.eventually.be.fulfilled;
  });

  test("should reject when item.price is 200 and orderItem.amount is 100", async () => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].amount = 100;
    testItem.price = 200;

    return expect(
      orderItemPriceValidator.validate(
        // @ts-expect-error fixme: auto ignored
        testOrder.orderItems[0],
        testItem,
      ),
    ).to.be.rejectedWith(
      BlError,
      /orderItem.amount "100" is not equal to item.price "200" = "200"/,
    );
  });

  test("should reject if item.price is 134 and orderItem.amount is 400", async () => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].amount = 400;
    testItem.price = 134;

    return expect(
      orderItemPriceValidator.validate(
        // @ts-expect-error fixme: auto ignored
        testOrder.orderItems[0],
        testItem,
      ),
    ).to.be.rejectedWith(
      BlError,
      /orderItem.amount "400" is not equal to item.price "134" = "134"/,
    );
  });

  test("should resolve if a valid order is sent", async () => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].type = "buy";

    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].amount = 400;

    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].item = "theItem";
    testOrder.amount = 400;
    testItem.price = 400;
    testItem.id = "theItem";

    return expect(
      orderItemPriceValidator.validate(
        // @ts-expect-error fixme: auto ignored
        testOrder.orderItems[0],
        testItem,
      ),
    ).to.be.fulfilled;
  });

  test("should resolve if a valid order is placed", async () => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].amount = 600;

    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].item = "theItem1";

    testOrder.amount = 600;
    testItem.id = "theItem1";
    testItem.price = 600;

    return expect(
      orderItemPriceValidator.validate(
        // @ts-expect-error fixme: auto ignored
        testOrder.orderItems[0],
        testItem,
      ),
    ).to.be.fulfilled;
  });
});
