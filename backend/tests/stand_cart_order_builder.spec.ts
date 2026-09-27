import { test } from "@japa/runner";
import { DateTime } from "luxon";

import type Order from "#models/order";
import type OrderItem from "#models/order_item";
import type { StandCartLineContext } from "#services/stand_cart/stand_cart_line_resolver";
import { planCheckout } from "#services/stand_cart/stand_cart_order_builder";
import type { CheckoutLine } from "#services/stand_cart/stand_cart_order_builder";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import type { StandCartLine, StandCartOption } from "#shared/stand_cart";
import { mock } from "#tests/test-doubles";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SEMESTER_END = "2026-12-20T00:00:00.000Z";
const YEAR_END = "2027-07-01T00:00:00.000Z";

const ITEM = mock<Item>({ id: "item1", title: "Sinus 1T", price: 500 });

const orderedItem = mock<OrderItem>({
  type: "rent",
  itemId: ITEM.id,
  amount: 0,
  unitPrice: 0,
  handout: false,
  delivered: false,
  periodTo: DateTime.fromISO(SEMESTER_END),
  periodType: "semester",
});
const order = mock<Order>({ id: "order1", branchId: "branch-order", orderItems: [orderedItem] });

const customerItem = mock<CustomerItem>({
  id: "ci1",
  item: ITEM.id,
  blid: "12345678",
  type: "rent",
  handoutInfo: { handoutById: "branch-handout" },
});

function checkoutLine(
  context: StandCartLineContext,
  option: StandCartOption,
  line: Partial<StandCartLine> = {},
): CheckoutLine {
  const source =
    context.kind === "order"
      ? ({ kind: "order", orderId: context.order.id, itemId: context.orderItem.itemId } as const)
      : context.kind === "customerItem"
        ? ({ kind: "customerItem", customerItemId: context.customerItem.id } as const)
        : ({ kind: "item", itemId: context.item.id, blid: "12345678" } as const);
  return {
    line: mock<StandCartLine>({
      key: "k",
      source,
      itemId: context.item.id,
      title: context.item.title,
      // A held book always carries its blid on the line, as the resolver builds it
      blid: context.kind === "customerItem" ? (context.customerItem.blid ?? null) : null,
      ...line,
    }),
    context,
    option,
  };
}

const orderContext: StandCartLineContext = {
  kind: "order",
  order,
  orderItem: orderedItem,
  item: ITEM,
};
const customerItemContext: StandCartLineContext = {
  kind: "customerItem",
  customerItem,
  item: ITEM,
  handoutBranch: mock<Branch>({ id: "branch-handout" }),
};
const itemContext: StandCartLineContext = { kind: "item", item: ITEM };

function optionWith(
  partial: Partial<StandCartOption> & { type: StandCartOption["type"] },
): StandCartOption {
  return { price: 0, available: true, monitored: false, ...partial };
}

test.group("planCheckout", () => {
  test("hands out an ordered book as a rent order item moved from the original order", ({
    assert,
  }) => {
    const plan = planCheckout(
      [
        checkoutLine(
          orderContext,
          optionWith({ type: "rent", to: YEAR_END, periodType: "year", price: 0 }),
          { blid: "12345678" },
        ),
      ],
      NOW,
    );
    assert.deepEqual(plan, [
      {
        type: "rent",
        itemId: ITEM.id,
        blid: "12345678",
        amount: 0,
        unitPrice: 0,
        handout: true,
        delivered: false,
        movedFromOrderId: "order1",
        periodFrom: DateTime.fromJSDate(NOW),
        periodTo: DateTime.fromISO(YEAR_END),
        numberOfPeriods: 1,
        periodType: "year",
      },
    ]);
  });

  test("a partly-payment handout records what is left to pay", ({ assert }) => {
    const plan = planCheckout(
      [
        checkoutLine(
          itemContext,
          optionWith({
            type: "partly-payment",
            to: SEMESTER_END,
            periodType: "semester",
            price: 150,
            payLater: 250,
          }),
          { blid: "12345678" },
        ),
      ],
      NOW,
    );
    const [orderItem] = plan;
    assert.equal(orderItem?.amount, 150);
    assert.equal(orderItem?.amountLeftToPay, 250);
    assert.isNull(orderItem?.movedFromOrderId);
  });

  test("cancelling an ordered book refunds the price it was given", ({ assert }) => {
    const plan = planCheckout(
      [checkoutLine(orderContext, optionWith({ type: "cancel", price: -250 }))],
      NOW,
    );
    assert.deepEqual(plan, [
      {
        type: "cancel",
        itemId: ITEM.id,
        amount: -250,
        unitPrice: -250,
        handout: false,
        delivered: true,
        movedFromOrderId: "order1",
      },
    ]);
  });

  test("buying an ordered book carries the blid when one was scanned", ({ assert }) => {
    const plan = planCheckout(
      [checkoutLine(orderContext, optionWith({ type: "buy", price: 500 }), { blid: "12345678" })],
      NOW,
    );
    assert.deepEqual(plan, [
      {
        type: "buy",
        itemId: ITEM.id,
        blid: "12345678",
        amount: 500,
        unitPrice: 500,
        handout: true,
        delivered: false,
        movedFromOrderId: "order1",
      },
    ]);
  });

  test("returns, buybacks, cancels, extends and buyouts point at the customer item", ({
    assert,
  }) => {
    const plan = planCheckout(
      [
        checkoutLine(customerItemContext, optionWith({ type: "return" })),
        checkoutLine(customerItemContext, optionWith({ type: "buyback" })),
        checkoutLine(customerItemContext, optionWith({ type: "cancel", price: -200 })),
        checkoutLine(
          customerItemContext,
          optionWith({ type: "extend", to: YEAR_END, periodType: "semester", price: 100 }),
        ),
        checkoutLine(customerItemContext, optionWith({ type: "buyout", price: 250 })),
      ],
      NOW,
    );
    assert.deepEqual(plan, [
      {
        type: "return",
        itemId: ITEM.id,
        blid: "12345678",
        amount: 0,
        unitPrice: 0,
        handout: false,
        delivered: false,
        customerItemId: "ci1",
      },
      {
        type: "buyback",
        itemId: ITEM.id,
        blid: "12345678",
        amount: 0,
        unitPrice: 0,
        handout: false,
        delivered: false,
        customerItemId: "ci1",
      },
      {
        type: "cancel",
        itemId: ITEM.id,
        blid: "12345678",
        amount: -200,
        unitPrice: -200,
        handout: false,
        delivered: false,
        customerItemId: "ci1",
      },
      {
        type: "extend",
        itemId: ITEM.id,
        blid: "12345678",
        amount: 100,
        unitPrice: 100,
        handout: false,
        delivered: false,
        customerItemId: "ci1",
        periodFrom: DateTime.fromJSDate(NOW),
        periodTo: DateTime.fromISO(YEAR_END),
        numberOfPeriods: 1,
        periodType: "semester",
      },
      {
        type: "buyout",
        itemId: ITEM.id,
        blid: "12345678",
        amount: 250,
        unitPrice: 250,
        handout: false,
        delivered: false,
        customerItemId: "ci1",
      },
    ]);
  });

  test("a bought book without a sticker goes out with no blid on the order item", ({ assert }) => {
    const plan = planCheckout(
      [checkoutLine(orderContext, optionWith({ type: "buy", price: 500 }), { blid: null })],
      NOW,
    );
    assert.deepEqual(plan, [
      {
        type: "buy",
        itemId: ITEM.id,
        blid: null,
        amount: 500,
        unitPrice: 500,
        handout: true,
        delivered: false,
        movedFromOrderId: "order1",
      },
    ]);
  });

  test("a book sold to the stand without a sticker is a sell item with no blid", ({ assert }) => {
    const plan = planCheckout(
      [checkoutLine(itemContext, optionWith({ type: "sell", price: -160 }), { blid: null })],
      NOW,
    );
    assert.deepEqual(plan, [
      {
        type: "sell",
        itemId: ITEM.id,
        blid: null,
        amount: -160,
        unitPrice: -160,
        handout: false,
        delivered: false,
        movedFromOrderId: null,
      },
    ]);
  });

  test("selling a book to the stand is a negative sell item with the blid", ({ assert }) => {
    const plan = planCheckout(
      [checkoutLine(itemContext, optionWith({ type: "sell", price: -160 }), { blid: "12345678" })],
      NOW,
    );
    assert.deepEqual(plan, [
      {
        type: "sell",
        itemId: ITEM.id,
        blid: "12345678",
        amount: -160,
        unitPrice: -160,
        handout: false,
        delivered: false,
        movedFromOrderId: null,
      },
    ]);
  });
});
