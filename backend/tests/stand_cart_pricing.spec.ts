import { test } from "@japa/runner";

import {
  alreadyPaidFor,
  priceCustomerItemLine,
  priceItemLine,
  priceOrderLine,
} from "#services/stand_cart/stand_cart_pricing";
import type { Branch } from "#shared/branch";
import type { BranchItem } from "#shared/branch-item";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { findOption } from "#shared/stand_cart";
import type { StandCartOption } from "#shared/stand_cart";
import { mock } from "#tests/test-doubles";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SEMESTER_END = new Date("2026-12-20T00:00:00.000Z");
const YEAR_END = new Date("2027-07-01T00:00:00.000Z");
const PAST = new Date("2026-06-20T00:00:00.000Z");

const ITEM = mock<Item>({ id: "item1", title: "Sinus 1T", price: 500, buyback: false });

function branchWith(overrides: Partial<NonNullable<Branch["paymentInfo"]>> = {}): Branch {
  return mock<Branch>({
    id: "branch1",
    name: "Ullern VGS",
    paymentInfo: {
      responsible: true,
      rentPeriods: [
        { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 1 },
        { type: "year", date: YEAR_END, maxNumberOfPeriods: 1, percentage: 1 },
      ],
      extendPeriods: [],
      ...overrides,
    },
  });
}

function orderWith(orderItem: Partial<OrderItem>, payments: string[] = []): Order {
  return mock<Order>({
    id: "order1",
    branch: "branch1",
    customer: "customer1",
    payments,
    amount: orderItem.amount ?? 0,
    orderItems: [
      {
        type: "rent",
        item: ITEM.id,
        title: ITEM.title,
        amount: 0,
        unitPrice: 0,
        handout: false,
        delivered: false,
        info: { to: SEMESTER_END, periodType: "semester" },
        ...orderItem,
      },
    ],
  });
}

function options(line: { options: StandCartOption[] }, type: StandCartOption["type"]) {
  return line.options.filter((option) => option.type === type);
}

function orderLine(overrides: Partial<Parameters<typeof priceOrderLine>[0]> = {}) {
  const originalOrder = overrides.originalOrder ?? orderWith({});
  return priceOrderLine({
    branch: branchWith(),
    item: ITEM,
    branchItem: null,
    originalOrder,
    originalOrderItem: originalOrder.orderItems[0]!,
    blockedByMatch: false,
    scanned: true,
    now: NOW,
    ...overrides,
  });
}

test.group("priceOrderLine", () => {
  test("without a scanned copy offers only cancel", ({ assert }) => {
    const line = orderLine({ scanned: false });
    assert.deepEqual(
      line.options.map((option) => option.type),
      ["cancel"],
    );
    assert.equal(line.options[line.defaultOptionIndex]?.type, "cancel");
  });

  test("offers a rent option per future rent period and a cancel", ({ assert }) => {
    const line = orderLine();
    assert.deepEqual(
      options(line, "rent").map((option) => option.to),
      [SEMESTER_END.toISOString(), YEAR_END.toISOString()],
    );
    assert.lengthOf(options(line, "cancel"), 1);
  });

  test("defaults to the ordered action and period", ({ assert }) => {
    const line = orderLine({
      originalOrder: orderWith({ info: { to: YEAR_END, periodType: "year" } }),
    });
    const chosen = line.options[line.defaultOptionIndex];
    assert.equal(chosen?.type, "rent");
    assert.equal(chosen?.to, YEAR_END.toISOString());
  });

  test("falls back to the first option of the ordered type when the ordered period has passed", ({
    assert,
  }) => {
    const line = orderLine({
      originalOrder: orderWith({ info: { to: PAST, periodType: "semester" } }),
    });
    const chosen = line.options[line.defaultOptionIndex];
    assert.equal(chosen?.type, "rent");
    assert.equal(chosen?.to, SEMESTER_END.toISOString());
  });

  test("leaves out rent periods that have passed", ({ assert }) => {
    const line = orderLine({
      branch: branchWith({
        rentPeriods: [
          { type: "semester", date: PAST, maxNumberOfPeriods: 1, percentage: 1 },
          { type: "year", date: YEAR_END, maxNumberOfPeriods: 1, percentage: 1 },
        ],
      }),
    });
    assert.deepEqual(
      options(line, "rent").map((option) => option.to),
      [YEAR_END.toISOString()],
    );
  });

  test("prices rent as the branch percentage of the item price when the customer pays", ({
    assert,
  }) => {
    const line = orderLine({
      branch: branchWith({
        responsible: false,
        rentPeriods: [
          { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 0.5 },
        ],
      }),
    });
    assert.equal(options(line, "rent")[0]?.price, 250);
  });

  test("costs nothing on a branch that pays for its students", ({ assert }) => {
    const line = orderLine();
    assert.equal(options(line, "rent")[0]?.price, 0);
    assert.equal(options(line, "cancel")[0]?.price, 0);
  });

  test("subtracts what a prepaid order already paid, and refunds it on cancel", ({ assert }) => {
    const branch = branchWith({
      responsible: false,
      rentPeriods: [
        { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 0.5 },
      ],
    });
    const prepaid = orderWith({ amount: 250, unitPrice: 250 }, ["payment1"]);
    const line = orderLine({
      branch,
      originalOrder: prepaid,
      branchItem: mock<BranchItem>({ buyAtBranch: true }),
    });
    assert.equal(options(line, "rent")[0]?.price, 0);
    assert.equal(options(line, "buy")[0]?.price, 250);
    assert.equal(options(line, "cancel")[0]?.price, -250);
  });

  test("charges the full price when the original order was never paid", ({ assert }) => {
    const branch = branchWith({
      responsible: false,
      rentPeriods: [
        { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 0.5 },
      ],
    });
    const line = orderLine({ branch, originalOrder: orderWith({ amount: 250, unitPrice: 250 }) });
    assert.equal(options(line, "rent")[0]?.price, 250);
    assert.equal(options(line, "cancel")[0]?.price, 0);
  });

  test("offers partly-payment and buy only when the branch item allows them at the stand", ({
    assert,
  }) => {
    const branch = branchWith({
      responsible: false,
      partlyPaymentPeriods: [
        {
          type: "semester",
          date: SEMESTER_END,
          percentageBuyout: 0.5,
          percentageBuyoutUsed: 0.4,
          percentageUpFront: 0.3,
          percentageUpFrontUsed: 0.2,
        },
      ],
    });
    const closed = orderLine({ branch, branchItem: null });
    assert.lengthOf(options(closed, "partly-payment"), 0);
    assert.lengthOf(options(closed, "buy"), 0);

    const open = orderLine({
      branch,
      branchItem: mock<BranchItem>({ partlyPaymentAtBranch: true, buyAtBranch: true }),
    });
    assert.deepEqual(options(open, "partly-payment")[0], {
      type: "partly-payment",
      to: SEMESTER_END.toISOString(),
      periodType: "semester",
      price: 150,
      payLater: 250,
      available: true,
      monitored: false,
    });
    assert.equal(options(open, "buy")[0]?.price, 500);
  });

  test("always offers the ordered type even when the branch item does not allow it", ({
    assert,
  }) => {
    const branch = branchWith({
      responsible: false,
      partlyPaymentPeriods: [
        {
          type: "semester",
          date: SEMESTER_END,
          percentageBuyout: 0.5,
          percentageBuyoutUsed: 0.4,
          percentageUpFront: 0.3,
          percentageUpFrontUsed: 0.2,
        },
      ],
    });
    const line = orderLine({
      branch,
      originalOrder: orderWith({ type: "partly-payment", amount: 150, unitPrice: 150 }),
    });
    assert.lengthOf(options(line, "partly-payment"), 1);
    assert.equal(line.options[line.defaultOptionIndex]?.type, "partly-payment");
  });

  test("blocks cancel when a user match depends on the book", ({ assert }) => {
    const line = orderLine({ blockedByMatch: true });
    const cancel = options(line, "cancel")[0];
    assert.isFalse(cancel?.available);
    assert.equal(
      cancel?.reason,
      "Boka er en del av en overlevering med en annen elev og kan ikke avbestilles",
    );
  });
});

test.group("alreadyPaidFor", () => {
  test("is the order item's amount when the order has payments", ({ assert }) => {
    const order = orderWith({ amount: 200 }, ["payment1"]);
    assert.equal(alreadyPaidFor(order, order.orderItems[0]!), 200);
  });

  test("is zero when the order has no payments", ({ assert }) => {
    const order = orderWith({ amount: 200 });
    assert.equal(alreadyPaidFor(order, order.orderItems[0]!), 0);
  });
});

function customerItemWith(overrides: Partial<CustomerItem> = {}): CustomerItem {
  return mock<CustomerItem>({
    id: "ci1",
    item: ITEM.id,
    customer: "customer1",
    type: "rent",
    deadline: SEMESTER_END,
    handout: true,
    handoutInfo: {
      handoutBy: "branch",
      handoutById: "branch1",
      time: new Date("2026-08-20T10:00:00.000Z"),
    },
    creationTime: new Date("2026-08-20T10:00:00.000Z"),
    periodExtends: [],
    ...overrides,
  });
}

function customerItemLine(overrides: Partial<Parameters<typeof priceCustomerItemLine>[0]> = {}) {
  const handoutBranch = branchWith({
    responsible: false,
    extendPeriods: [{ type: "semester", date: YEAR_END, maxNumberOfPeriods: 1, price: 100 }],
    buyout: { percentage: 0.5 },
  });
  return priceCustomerItemLine({
    branch: handoutBranch,
    handoutBranch,
    item: ITEM,
    customerItem: customerItemWith(),
    paidAmount: 0,
    periodType: "semester",
    now: NOW,
    ...overrides,
  });
}

test.group("priceCustomerItemLine", () => {
  test("a rented book in time can be returned, cancelled, extended and bought out", ({
    assert,
  }) => {
    const line = customerItemLine();
    assert.deepEqual(
      line.options.map((option) => [option.type, option.price, option.monitored]),
      [
        ["return", 0, false],
        ["cancel", 0, true],
        ["extend", 100, false],
        ["buyout", 250, false],
      ],
    );
    assert.equal(options(line, "extend")[0]?.to, YEAR_END.toISOString());
    assert.equal(line.defaultOptionIndex, 0);
  });

  test("extend is left out when the customer could not have extended either", ({ assert }) => {
    const capped = customerItemLine({
      customerItem: customerItemWith({
        periodExtends: [{ from: PAST, to: SEMESTER_END, periodType: "semester", time: PAST }],
      }),
    });
    assert.lengthOf(options(capped, "extend"), 0);

    const late = customerItemLine({ customerItem: customerItemWith({ deadline: PAST }) });
    assert.lengthOf(options(late, "extend"), 0);

    const noPeriods = customerItemLine({
      handoutBranch: branchWith({
        responsible: false,
        extendPeriods: [],
        buyout: { percentage: 0.5 },
      }),
    });
    assert.lengthOf(options(noPeriods, "extend"), 0);
    assert.lengthOf(options(noPeriods, "buyout"), 1);
  });

  test("extend is left out when the cart branch has no period of that type to record it on", ({
    assert,
  }) => {
    const otherType = customerItemLine({
      branch: branchWith({
        extendPeriods: [{ type: "year", date: YEAR_END, maxNumberOfPeriods: 1, price: 100 }],
      }),
    });
    assert.lengthOf(options(otherType, "extend"), 0);

    const sameType = customerItemLine({
      branch: branchWith({
        extendPeriods: [{ type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, price: 0 }],
      }),
    });
    // Priced and dated from the handout branch; the cart branch only has to know the type
    assert.deepEqual(
      options(sameType, "extend").map((option) => [option.to, option.price]),
      [[YEAR_END.toISOString(), 100]],
    );
  });

  test("extend is left out for a period that ended before today, even inside the December grace", ({
    assert,
  }) => {
    const december = new Date("2026-12-15T10:00:00.000Z");
    const handoutBranch = branchWith({
      responsible: false,
      extendPeriods: [
        {
          type: "semester",
          date: new Date("2026-12-10T00:00:00.000Z"),
          maxNumberOfPeriods: 1,
          price: 100,
        },
        { type: "year", date: YEAR_END, maxNumberOfPeriods: 1, price: 200 },
      ],
      buyout: { percentage: 0.5 },
    });
    const line = customerItemLine({
      branch: handoutBranch,
      handoutBranch,
      customerItem: customerItemWith({ deadline: new Date("2026-12-01T00:00:00.000Z") }),
      now: december,
    });
    assert.deepEqual(
      options(line, "extend").map((option) => option.to),
      [YEAR_END.toISOString()],
    );
  });

  test("a partly-paid book is bought back instead of returned, and bought out for the rest", ({
    assert,
  }) => {
    const line = customerItemLine({
      customerItem: customerItemWith({ type: "partly-payment", amountLeftToPay: 320 }),
    });
    assert.lengthOf(options(line, "return"), 0);
    assert.equal(options(line, "buyback")[0]?.price, 0);
    assert.equal(options(line, "buyout")[0]?.price, 320);
  });

  test("refunds what the customer paid when cancelling a fresh handout", ({ assert }) => {
    const line = customerItemLine({
      paidAmount: 200,
      customerItem: customerItemWith({ creationTime: new Date("2026-09-01T10:00:00.000Z") }),
    });
    assert.equal(options(line, "cancel")[0]?.price, -200);
    assert.isFalse(options(line, "cancel")[0]?.monitored);
  });

  test("returning an overdue book is allowed but monitored", ({ assert }) => {
    const line = customerItemLine({ customerItem: customerItemWith({ deadline: PAST }) });
    const back = options(line, "return")[0];
    assert.isTrue(back?.available);
    assert.isTrue(back?.monitored);
    assert.equal(back?.reason, "Fristen for boka har gått ut");
  });

  test("cancelling more than two weeks after the handout is monitored", ({ assert }) => {
    const line = customerItemLine({
      customerItem: customerItemWith({
        creationTime: new Date("2026-08-01T10:00:00.000Z"),
        handoutInfo: {
          handoutBy: "branch",
          handoutById: "branch1",
          time: new Date("2026-08-01T10:00:00.000Z"),
        },
      }),
    });
    const cancel = options(line, "cancel")[0];
    assert.isTrue(cancel?.available);
    assert.isTrue(cancel?.monitored);
    assert.equal(
      cancel?.reason,
      "Boka ble delt ut for mer enn to uker siden, og skal normalt ikke kanselleres",
    );
  });

  test("buying out within two weeks of the handout is allowed but monitored, with the reason", ({
    assert,
  }) => {
    const fresh = customerItemLine({
      customerItem: customerItemWith({ creationTime: new Date("2026-09-05T10:00:00.000Z") }),
    });
    const buyout = options(fresh, "buyout")[0];
    assert.isTrue(buyout?.available);
    assert.isTrue(buyout?.monitored);
    assert.equal(
      buyout?.reason,
      "Kunden må ha hatt boka i minst to uker for at den skal kunne kjøpes ut",
    );
  });

  test("buying out later is not monitored, even after the deadline", ({ assert }) => {
    const late = customerItemLine({ customerItem: customerItemWith({ deadline: PAST }) });
    assert.isTrue(options(late, "buyout")[0]?.available);
    assert.isFalse(options(late, "buyout")[0]?.monitored);
    assert.isUndefined(options(late, "buyout")[0]?.reason);
  });

  test("buyout is unavailable when no buyout price can be computed", ({ assert }) => {
    const line = customerItemLine({
      handoutBranch: branchWith({ responsible: false, extendPeriods: [] }),
    });
    const buyout = options(line, "buyout")[0];
    assert.isFalse(buyout?.available);
    assert.equal(buyout?.reason, "Klarte ikke beregne utkjøpspris");
  });
});

function itemLine(overrides: Partial<Parameters<typeof priceItemLine>[0]> = {}) {
  return priceItemLine({
    branch: branchWith(),
    item: ITEM,
    branchItem: null,
    now: NOW,
    ...overrides,
  });
}

test.group("priceItemLine", () => {
  test("a book with no branch item can only be rented", ({ assert }) => {
    const line = itemLine();
    assert.deepEqual(
      line.options.map((option) => option.type),
      ["rent", "rent"],
    );
    assert.isNull(line.unavailableReason);
  });

  test("says the book is not on the branch's list when nothing can be offered without one", ({
    assert,
  }) => {
    const line = itemLine({ branch: branchWith({ rentPeriods: [] }) });
    assert.isEmpty(line.options);
    assert.equal(line.unavailableReason, "Boka står ikke i boklisten til Ullern VGS");
  });

  test("says the branch has no period or price when its branch item yields nothing", ({
    assert,
  }) => {
    const line = itemLine({
      branch: branchWith({ rentPeriods: [] }),
      branchItem: mock<BranchItem>({
        rentAtBranch: true,
        partlyPaymentAtBranch: false,
        buyAtBranch: false,
      }),
    });
    assert.isEmpty(line.options);
    assert.equal(
      line.unavailableReason,
      "Ullern VGS har ingen gyldig periode eller pris for denne boka",
    );
  });

  test("follows the branch item's at-branch flags", ({ assert }) => {
    const line = itemLine({
      branch: branchWith({
        responsible: false,
        partlyPaymentPeriods: [
          {
            type: "semester",
            date: SEMESTER_END,
            percentageBuyout: 0.5,
            percentageBuyoutUsed: 0.4,
            percentageUpFront: 0.3,
            percentageUpFrontUsed: 0.2,
          },
        ],
      }),
      branchItem: mock<BranchItem>({
        rentAtBranch: false,
        partlyPaymentAtBranch: true,
        buyAtBranch: true,
      }),
    });
    assert.deepEqual(
      line.options.map((option) => [option.type, option.price]),
      [
        ["partly-payment", 150],
        ["buy", 500],
      ],
    );
  });

  test("offers to buy the book from the customer when the item and branch allow it", ({
    assert,
  }) => {
    const line = itemLine({
      branch: branchWith({ sell: { percentage: 0.333 } }),
      item: mock<Item>({ ...ITEM, buyback: true }),
    });
    assert.equal(options(line, "sell")[0]?.price, -160);
  });

  test("does not offer sell when the item is not bought back", ({ assert }) => {
    const line = itemLine({ branch: branchWith({ sell: { percentage: 0.333 } }) });
    assert.lengthOf(options(line, "sell"), 0);
  });
});

test.group("findOption", () => {
  test("finds the option with the chosen type and period end", ({ assert }) => {
    const line = orderLine();
    const resolved = findOption(line, { type: "rent", to: YEAR_END.toISOString() });
    assert.equal(resolved?.to, YEAR_END.toISOString());
  });

  test("matches a period end by calendar day, whatever the time of day", ({ assert }) => {
    const line = orderLine();
    const resolved = findOption(line, { type: "rent", to: "2026-12-20T15:30:00.000Z" });
    assert.equal(resolved?.to, SEMESTER_END.toISOString());
  });

  test("refuses a date that is not one of the line's periods", ({ assert }) => {
    const line = orderLine();
    assert.isNull(findOption(line, { type: "rent", to: "2027-03-01T00:00:00.000Z" }));
    assert.isNull(findOption(line, { type: "cancel", to: "2027-03-01T00:00:00.000Z" }));
  });

  test("refuses a type the line does not offer", ({ assert }) => {
    const line = orderLine();
    assert.isNull(findOption(line, { type: "buyout" }));
  });
});
