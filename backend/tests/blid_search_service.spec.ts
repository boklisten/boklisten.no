import { test } from "@japa/runner";

import type { BlidCustomerItem, BlidSearchSources } from "#services/blid_search_service";
import { assembleBlidSearch, collectReferencedIds } from "#services/blid_search_service";
import type { Order, OrderItem } from "#shared/order/order";
import { customerItemDto } from "#tests/customer_item_fixtures";

const BLID = "12345678";
const IDA = "ida-id";
const PETRA = "petra-id";
const EMPLOYEE = "employee-id";
const BRANCH = "branch-id";

const T1 = new Date("2026-08-01T10:00:00.000Z");
const T2 = new Date("2026-08-02T11:30:15.000Z");
const T3 = new Date("2026-08-03T12:45:30.000Z");

const DEADLINE_1 = new Date("2026-12-20T00:00:00.000Z");
const DEADLINE_2 = new Date("2027-07-01T00:00:00.000Z");
// After the T1 handout, before NOW: the expiry slots in as the newest event.
const EXPIRED_DEADLINE = new Date("2026-08-15T00:00:00.000Z");
const NOW = new Date("2026-08-30T12:00:00.000Z");

function baseSources(overrides: Partial<BlidSearchSources> = {}): BlidSearchSources {
  return {
    blid: BLID,
    item: { id: "item-1", title: "Sinus 1T", isbn: "9788202419676" },
    registered: true,
    registration: null,
    customerItems: [],
    orders: [],
    handovers: [],
    bringDeliveryOrderIds: new Set(),
    userDetails: new Map([
      [IDA, "Ida"],
      [PETRA, "Petra"],
      [EMPLOYEE, "Emil Ansatt"],
    ]),
    branchNames: new Map([[BRANCH, "Ullern VGS"]]),
    now: NOW,
    ...overrides,
  };
}

type TestOrderItem = Partial<OrderItem> & Pick<OrderItem, "type">;

function makeOrder(
  overrides: Omit<Partial<Order>, "orderItems"> & { orderItems: TestOrderItem[] },
): Order {
  return {
    id: "order-1",
    amount: 0,
    branchId: BRANCH,
    customerId: IDA,
    byCustomer: false,
    employeeId: EMPLOYEE,
    placed: true,
    deliveryId: null,
    notifyByEmail: true,
    checkoutState: null,
    createdAt: T1,
    updatedAt: T1,
    ...overrides,
    orderItems: overrides.orderItems.map((orderItem, index) => ({
      id: index + 1,
      itemId: "item-1",
      title: "Sinus 1T",
      blid: null,
      amount: 0,
      unitPrice: 0,
      handout: false,
      delivered: false,
      customerItemId: null,
      periodFrom: null,
      periodTo: null,
      numberOfPeriods: null,
      periodType: null,
      amountLeftToPay: null,
      buybackAmount: null,
      movedFromOrderId: null,
      movedToOrderId: null,
      ...orderItem,
    })),
  };
}

function makeCustomerItem(overrides: Partial<BlidCustomerItem> = {}): BlidCustomerItem {
  return {
    ...customerItemDto({
      id: "customer-item-1",
      itemId: "item-1",
      blid: BLID,
      customerId: IDA,
      deadline: DEADLINE_1,
      handoutBranchId: BRANCH,
      handoutEmployeeId: EMPLOYEE,
      handedOutAt: T1,
    }),
    orderIds: [],
    ...overrides,
  };
}

test.group("BlidSearchService.assembleBlidSearch() – book", () => {
  test("returns book info and empty history when nothing references the blid", ({ assert }) => {
    const result = assembleBlidSearch(baseSources());
    assert.deepEqual(result.book, { id: "item-1", title: "Sinus 1T", isbn: "9788202419676" });
    assert.lengthOf(result.history, 0);
  });

  test("returns null book when the blid was never connected", ({ assert }) => {
    const result = assembleBlidSearch(baseSources({ item: null }));
    assert.isNull(result.book);
  });
});

test.group("BlidSearchService.assembleBlidSearch() – postal handouts", () => {
  const rentItem = {
    type: "rent",
    itemId: "item-1",
    blid: BLID,
    title: "Sinus 1T",
    amount: 0,
    unitPrice: 0,
    handout: true,
    periodTo: DEADLINE_1,
  } as const;

  test("marks an order-item handout whose order has a Bring delivery as sent by mail", ({
    assert,
  }) => {
    const order = makeOrder({ deliveryId: "delivery-1", orderItems: [rentItem] });
    const result = assembleBlidSearch(
      baseSources({ orders: [order], bringDeliveryOrderIds: new Set(["order-1"]) }),
    );
    const [event] = result.history;
    assert.equal(event?.action, "handout");
    assert.isTrue(event?.byMail);
    assert.equal(event?.handoutType, "rent");
    assert.deepEqual(event?.employee, { detailsId: EMPLOYEE, name: "Emil Ansatt" });
  });

  test("marks a handover-row handout whose order has a Bring delivery as sent by mail", ({
    assert,
  }) => {
    const order = makeOrder({ deliveryId: "delivery-1", orderItems: [rentItem] });
    const result = assembleBlidSearch(
      baseSources({
        orders: [order],
        handovers: [
          { fromUserDetailId: null, toUserDetailId: IDA, occurredAt: T1, orderId: "order-1" },
        ],
        bringDeliveryOrderIds: new Set(["order-1"]),
      }),
    );
    assert.lengthOf(result.history, 1);
    assert.isTrue(result.history[0]?.byMail);
  });

  test("marks a blid-less legacy handout as sent by mail through its customer item's order", ({
    assert,
  }) => {
    const order = makeOrder({
      deliveryId: "delivery-1",
      orderItems: [
        { ...rentItem, blid: null, periodTo: DEADLINE_1, customerItemId: "customer-item-1" },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({
        orders: [order],
        customerItems: [makeCustomerItem({ orderIds: ["order-1"] })],
        bringDeliveryOrderIds: new Set(["order-1"]),
      }),
    );
    const handouts = result.history.filter((event) => event.action === "handout");
    assert.lengthOf(handouts, 1);
    assert.isTrue(handouts[0]?.byMail);
  });

  test("leaves a stand handout without the mail marker", ({ assert }) => {
    const order = makeOrder({ orderItems: [rentItem] });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.isUndefined(result.history[0]?.byMail);
  });

  test("does not mark a handout by mail when the order's delivery is a branch pickup", ({
    assert,
  }) => {
    const order = makeOrder({ deliveryId: "delivery-1", orderItems: [rentItem] });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.isUndefined(result.history[0]?.byMail);
  });
});

test.group("BlidSearchService.assembleBlidSearch() – handover events", () => {
  test("maps a stand handout handover to a handout event enriched from its order", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "rent",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          handout: true,
          periodTo: DEADLINE_1,
        },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({
        orders: [order],
        handovers: [
          { fromUserDetailId: null, toUserDetailId: IDA, occurredAt: T1, orderId: "order-1" },
        ],
      }),
    );
    assert.lengthOf(result.history, 1);
    const [event] = result.history;
    assert.equal(event?.action, "handout");
    assert.deepEqual(event?.from, { type: "stand" });
    assert.deepEqual(event?.to, { type: "customer", detailsId: IDA, name: "Ida" });
    assert.deepEqual(event?.employee, { detailsId: EMPLOYEE, name: "Emil Ansatt" });
    assert.equal(event?.branchName, "Ullern VGS");
    assert.equal(event?.deadline, DEADLINE_1.toISOString());
    assert.equal(event?.time, T1.toISOString());
    assert.isFalse(event?.byCustomer);
    assert.equal(event?.handoutType, "rent");
  });

  test("maps a return handover to a return event", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({
        handovers: [{ fromUserDetailId: IDA, toUserDetailId: null, occurredAt: T2, orderId: null }],
      }),
    );
    const [event] = result.history;
    assert.equal(event?.action, "return");
    assert.deepEqual(event?.from, { type: "customer", detailsId: IDA, name: "Ida" });
    assert.deepEqual(event?.to, { type: "stand" });
  });

  test("maps a customer-to-customer handover to a match transfer marked byCustomer", ({
    assert,
  }) => {
    const result = assembleBlidSearch(
      baseSources({
        handovers: [
          { fromUserDetailId: PETRA, toUserDetailId: IDA, occurredAt: T2, orderId: null },
        ],
      }),
    );
    const [event] = result.history;
    assert.equal(event?.action, "match-transfer");
    assert.deepEqual(event?.from, { type: "customer", detailsId: PETRA, name: "Petra" });
    assert.deepEqual(event?.to, { type: "customer", detailsId: IDA, name: "Ida" });
    assert.isTrue(event?.byCustomer);
  });

  test("drops the order's own movement events when a handover covers the order", ({ assert }) => {
    const order = makeOrder({
      byCustomer: true,
      employeeId: null,
      orderItems: [
        {
          type: "match-receive",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({
        orders: [order],
        handovers: [
          { fromUserDetailId: PETRA, toUserDetailId: IDA, occurredAt: T2, orderId: "order-1" },
        ],
      }),
    );
    assert.lengthOf(result.history, 1);
    assert.equal(result.history[0]?.action, "match-transfer");
  });
});

test.group("BlidSearchService.assembleBlidSearch() – order events (legacy, no handovers)", () => {
  test("names an order's deleted customer without a link", ({ assert }) => {
    const order = makeOrder({
      customerId: null,
      orderItems: [{ type: "rent", blid: BLID, handout: true, periodTo: DEADLINE_1 }],
    });

    const result = assembleBlidSearch(baseSources({ orders: [order] }));

    assert.deepEqual(result.history[0]?.to, {
      type: "customer",
      detailsId: null,
      name: "Slettet kunde",
    });
  });

  test("builds handout, return and buyout events from order items", ({ assert }) => {
    const orders = [
      makeOrder({
        id: "order-1",
        createdAt: T1,
        orderItems: [
          {
            type: "rent",
            itemId: "item-1",
            blid: BLID,
            title: "Sinus 1T",
            amount: 0,
            unitPrice: 0,
            handout: true,
            periodTo: DEADLINE_1,
          },
        ],
      }),
      makeOrder({
        id: "order-2",
        createdAt: T2,
        orderItems: [
          {
            type: "return",
            itemId: "item-1",
            blid: BLID,
            title: "Sinus 1T",
            amount: 0,
            unitPrice: 0,
          },
        ],
      }),
      makeOrder({
        id: "order-3",
        createdAt: T3,
        orderItems: [
          {
            type: "buyout",
            itemId: "item-1",
            blid: BLID,
            title: "Sinus 1T",
            amount: 0,
            unitPrice: 0,
          },
        ],
      }),
    ];
    const result = assembleBlidSearch(baseSources({ orders }));
    assert.deepEqual(
      result.history.map((event) => event.action),
      ["buyout", "return", "handout"],
    );
    const returnEvent = result.history[1];
    assert.deepEqual(returnEvent?.from, { type: "customer", detailsId: IDA, name: "Ida" });
    assert.deepEqual(returnEvent?.to, { type: "stand" });
    const handoutEvent = result.history[2];
    assert.deepEqual(handoutEvent?.from, { type: "stand" });
    assert.deepEqual(handoutEvent?.to, { type: "customer", detailsId: IDA, name: "Ida" });
    const buyoutEvent = result.history[0];
    assert.deepEqual(buyoutEvent?.to, { type: "customer", detailsId: IDA, name: "Ida" });
    assert.deepEqual(buyoutEvent?.employee, { detailsId: EMPLOYEE, name: "Emil Ansatt" });
  });

  test("carries the handout type onto handout events", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "partly-payment",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          handout: true,
          periodTo: DEADLINE_1,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.equal(
      result.history.find((event) => event.action === "handout")?.handoutType,
      "partly-payment",
    );
  });

  test("attributes blid-less order items via their customer item and derives the replaced deadline from the chain", ({
    assert,
  }) => {
    // Legacy extend order items carry no blid and store the moment of extension (not the old
    // deadline) in info.from; the customer item link pins them to the copy.
    const orders = [
      makeOrder({
        id: "order-1",
        createdAt: T1,
        orderItems: [
          {
            type: "partly-payment",
            itemId: "item-1",
            blid: BLID,
            title: "Sinus 1T",
            amount: 0,
            unitPrice: 0,
            handout: true,
            periodTo: DEADLINE_1,
          },
        ],
      }),
      makeOrder({
        id: "order-2",
        createdAt: T2,
        orderItems: [
          {
            type: "extend",
            itemId: "item-1",
            title: "Sinus 1T",
            amount: 50,
            unitPrice: 50,
            periodFrom: T2,
            periodTo: DEADLINE_2,
            customerItemId: "customer-item-1",
          },
        ],
      }),
    ];
    const customerItem = makeCustomerItem({
      deadline: DEADLINE_2,
      periodExtends: [
        { periodFrom: T2, periodTo: DEADLINE_2, periodType: "semester", createdAt: T2 },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders, customerItems: [customerItem] }));

    const extendEvents = result.history.filter((event) => event.action === "extend");
    assert.lengthOf(extendEvents, 1);
    const [extend] = extendEvents;
    assert.equal(extend?.orderId, "order-2");
    assert.equal(extend?.previousDeadline, DEADLINE_1.toISOString());
    assert.equal(extend?.deadline, DEADLINE_2.toISOString());
    assert.deepEqual(extend?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("names the customer who sold the book on a buyback event", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "buyback",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.deepEqual(result.history[0]?.from, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("builds an extend event with both deadlines", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "extend",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          periodFrom: DEADLINE_1,
          periodTo: DEADLINE_2,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    const [event] = result.history;
    assert.equal(event?.action, "extend");
    assert.equal(event?.previousDeadline, DEADLINE_1.toISOString());
    assert.equal(event?.deadline, DEADLINE_2.toISOString());
  });

  test("shows a legacy match-receive without a counterparty", ({ assert }) => {
    const order = makeOrder({
      byCustomer: true,
      employeeId: null,
      orderItems: [
        {
          type: "match-receive",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    const [event] = result.history;
    assert.equal(event?.action, "match-transfer");
    assert.isUndefined(event?.from);
    assert.deepEqual(event?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("ignores order items that only place a booking (no handout flag)", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "rent",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          periodTo: DEADLINE_1,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.lengthOf(result.history, 0);
  });

  test("ignores unplaced orders — an abandoned cart is not history", ({ assert }) => {
    const order = makeOrder({
      placed: false,
      orderItems: [
        {
          type: "return",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          handout: true,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.lengthOf(result.history, 0);
  });

  test("ignores order items for other blids", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "return",
          itemId: "item-1",
          blid: "99999999",
          title: "Annen bok",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.lengthOf(result.history, 0);
  });
});

test.group("BlidSearchService.assembleBlidSearch() – customer item fallbacks", () => {
  test("synthesizes handout and return events when no orders or handovers cover them", ({
    assert,
  }) => {
    const customerItem = makeCustomerItem({
      type: "partly-payment",
      returned: true,
      returnBranchId: BRANCH,
      returnedAt: T2,
    });
    const result = assembleBlidSearch(baseSources({ customerItems: [customerItem] }));
    assert.deepEqual(
      result.history.map((event) => event.action),
      ["return", "handout"],
    );
    const handout = result.history[1];
    assert.equal(handout?.time, T1.toISOString());
    assert.equal(handout?.branchName, "Ullern VGS");
    assert.deepEqual(handout?.employee, { detailsId: EMPLOYEE, name: "Emil Ansatt" });
    assert.equal(handout?.deadline, DEADLINE_1.toISOString());
    assert.equal(handout?.handoutType, "partly-payment");
  });

  test("does not synthesize movement events already covered by orders", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "rent",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          handout: true,
          periodTo: DEADLINE_1,
        },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({ orders: [order], customerItems: [makeCustomerItem()] }),
    );
    assert.lengthOf(result.history, 1);
    assert.equal(result.history[0]?.orderId, "order-1");
  });

  test("uses the first extend's previous deadline for the synthesized handout", ({ assert }) => {
    const customerItem = makeCustomerItem({
      deadline: DEADLINE_2,
      periodExtends: [
        { periodFrom: DEADLINE_1, periodTo: DEADLINE_2, periodType: "year", createdAt: T2 },
      ],
    });
    const result = assembleBlidSearch(baseSources({ customerItems: [customerItem] }));
    const handout = result.history.find((event) => event.action === "handout");
    assert.equal(handout?.deadline, DEADLINE_1.toISOString());
  });

  test("synthesizes extend events not covered by an extend order", ({ assert }) => {
    const customerItem = makeCustomerItem({
      deadline: DEADLINE_2,
      periodExtends: [
        { periodFrom: DEADLINE_1, periodTo: DEADLINE_2, periodType: "year", createdAt: T2 },
      ],
    });
    const result = assembleBlidSearch(baseSources({ customerItems: [customerItem] }));
    const extend = result.history.find((event) => event.action === "extend");
    assert.equal(extend?.previousDeadline, DEADLINE_1.toISOString());
    assert.equal(extend?.deadline, DEADLINE_2.toISOString());
    assert.equal(extend?.time, T2.toISOString());
  });

  test("does not duplicate an extend covered by an extend order with the same new deadline", ({
    assert,
  }) => {
    const order = makeOrder({
      createdAt: T2,
      orderItems: [
        {
          type: "extend",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          periodFrom: DEADLINE_1,
          periodTo: DEADLINE_2,
        },
      ],
    });
    const customerItem = makeCustomerItem({
      deadline: DEADLINE_2,
      periodExtends: [
        { periodFrom: DEADLINE_1, periodTo: DEADLINE_2, periodType: "year", createdAt: T2 },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({ orders: [order], customerItems: [customerItem] }),
    );
    assert.lengthOf(
      result.history.filter((event) => event.action === "extend"),
      1,
    );
    assert.equal(result.history.find((event) => event.action === "extend")?.orderId, "order-1");
  });

  test("synthesizes a buyout event when no blid-tagged order tells the story", ({ assert }) => {
    const customerItem = makeCustomerItem({
      buyout: true,
      buyoutOrderId: "buyout-order",
      boughtOutAt: T2,
    });
    const result = assembleBlidSearch(baseSources({ customerItems: [customerItem] }));
    const buyout = result.history.find((event) => event.action === "buyout");
    assert.equal(buyout?.time, T2.toISOString());
    assert.equal(buyout?.orderId, "buyout-order");
    assert.deepEqual(buyout?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("synthesizes buyback and cancel events from the customer item alone", ({ assert }) => {
    const boughtBack = makeCustomerItem({
      returned: true,
      buyback: true,
      buybackOrderId: "buyback-order",
      boughtBackAt: T2,
    });
    const buyback = assembleBlidSearch(baseSources({ customerItems: [boughtBack] })).history.find(
      (event) => event.action === "buyback",
    );
    assert.equal(buyback?.time, T2.toISOString());
    assert.equal(buyback?.orderId, "buyback-order");
    assert.deepEqual(buyback?.from, { type: "customer", detailsId: IDA, name: "Ida" });

    const cancelled = makeCustomerItem({
      returned: true,
      cancel: true,
      cancelOrderId: "cancel-order",
      cancelledAt: T3,
    });
    const cancel = assembleBlidSearch(baseSources({ customerItems: [cancelled] })).history.find(
      (event) => event.action === "cancel",
    );
    assert.equal(cancel?.time, T3.toISOString());
    assert.equal(cancel?.orderId, "cancel-order");
    assert.deepEqual(cancel?.from, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("does not repeat a buyback the blid-tagged order already tells", ({ assert }) => {
    const order = makeOrder({
      id: "buyback-order",
      createdAt: T2,
      orderItems: [
        {
          type: "buyback",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 200,
          unitPrice: 200,
          handout: false,
          delivered: false,
          customerItemId: "customer-item-1",
        },
      ],
    });
    const customerItem = makeCustomerItem({
      returned: true,
      buyback: true,
      buybackOrderId: "buyback-order",
      boughtBackAt: T3,
    });
    const result = assembleBlidSearch(
      baseSources({ orders: [order], customerItems: [customerItem] }),
    );
    const buybacks = result.history.filter((event) => event.action === "buyback");
    assert.lengthOf(buybacks, 1);
    assert.equal(buybacks[0]?.time, T2.toISOString());
  });

  test("builds an invoice-paid event when a kept book's invoice was paid", ({ assert }) => {
    // A never-returned book that goes through the invoice flow gets buyout=true on the
    // customer item but no buyoutInfo and no buyout order — only an invoice-paid order item.
    const order = makeOrder({
      id: "invoice-order",
      createdAt: T3,
      orderItems: [
        {
          type: "invoice-paid",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 720,
          unitPrice: 720,
          handout: true,
          customerItemId: "customer-item-1",
        },
      ],
    });
    const customerItem = makeCustomerItem({ buyout: true, orderIds: ["invoice-order"] });
    const result = assembleBlidSearch(
      baseSources({ orders: [order], customerItems: [customerItem] }),
    );
    const invoicePaid = result.history.find((event) => event.action === "invoice-paid");
    assert.equal(invoicePaid?.time, T3.toISOString());
    assert.equal(invoicePaid?.orderId, "invoice-order");
    assert.deepEqual(invoicePaid?.to, { type: "customer", detailsId: IDA, name: "Ida" });
    assert.notInclude(
      result.history.map((event) => event.action),
      "buyout",
    );
    assert.equal(result.status, "bought-out");
  });

  test("does not synthesize a buyout on top of an invoice-paid event for the same order", ({
    assert,
  }) => {
    const order = makeOrder({
      id: "invoice-order",
      createdAt: T3,
      orderItems: [
        {
          type: "invoice-paid",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 720,
          unitPrice: 720,
          customerItemId: "customer-item-1",
        },
      ],
    });
    const customerItem = makeCustomerItem({
      buyout: true,
      buyoutOrderId: "invoice-order",
      boughtOutAt: T3,
    });
    const result = assembleBlidSearch(
      baseSources({ orders: [order], customerItems: [customerItem] }),
    );
    assert.notInclude(
      result.history.map((event) => event.action),
      "buyout",
    );
    assert.lengthOf(
      result.history.filter((event) => event.action === "invoice-paid"),
      1,
    );
  });

  test("does not duplicate a buyout already covered by its order", ({ assert }) => {
    const order = makeOrder({
      id: "buyout-order",
      createdAt: T2,
      orderItems: [
        {
          type: "buyout",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const customerItem = makeCustomerItem({
      buyout: true,
      buyoutOrderId: "buyout-order",
      boughtOutAt: T2,
    });
    const result = assembleBlidSearch(
      baseSources({ orders: [order], customerItems: [customerItem] }),
    );
    assert.lengthOf(
      result.history.filter((event) => event.action === "buyout"),
      1,
    );
  });
});

test.group("BlidSearchService.assembleBlidSearch() – deadline expiry", () => {
  test("adds a deadline-expired event when the held book's deadline has passed", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({ customerItems: [makeCustomerItem({ deadline: EXPIRED_DEADLINE })] }),
    );
    const [newest] = result.history;
    assert.equal(newest?.action, "deadline-expired");
    assert.equal(newest?.time, EXPIRED_DEADLINE.toISOString());
    assert.equal(newest?.deadline, EXPIRED_DEADLINE.toISOString());
    assert.deepEqual(newest?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("keeps the deadline-expired event on top when the deadline predates the handout", ({
    assert,
  }) => {
    // An admin can backdate the deadline to before the handout was even recorded; the expiry
    // still describes the current state, so it must not sink into the middle of the history.
    const backdated = new Date("2026-07-15T00:00:00.000Z");
    const result = assembleBlidSearch(
      baseSources({ customerItems: [makeCustomerItem({ deadline: backdated })] }),
    );
    assert.equal(result.history[0]?.action, "deadline-expired");
    assert.equal(result.history[0]?.time, backdated.toISOString());
    assert.equal(result.history[1]?.action, "handout");
  });

  test("does not add a deadline-expired event while the deadline is in the future", ({
    assert,
  }) => {
    const result = assembleBlidSearch(baseSources({ customerItems: [makeCustomerItem()] }));
    assert.notInclude(
      result.history.map((event) => event.action),
      "deadline-expired",
    );
  });

  test("does not add a deadline-expired event once the book is returned", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({
        customerItems: [
          makeCustomerItem({
            deadline: EXPIRED_DEADLINE,
            returned: true,
            returnBranchId: BRANCH,
            returnedAt: T2,
          }),
        ],
      }),
    );
    assert.notInclude(
      result.history.map((event) => event.action),
      "deadline-expired",
    );
  });
});

test.group("BlidSearchService.assembleBlidSearch() – status", () => {
  test("is handed-out while a customer item is active", ({ assert }) => {
    const result = assembleBlidSearch(baseSources({ customerItems: [makeCustomerItem()] }));
    assert.equal(result.status, "handed-out");
  });

  test("is bought-out when the newest customer item was bought out", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({
        customerItems: [makeCustomerItem({ buyout: true, boughtOutAt: T2 })],
      }),
    );
    assert.equal(result.status, "bought-out");
  });

  test("is not-handed-out after a buyback", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({
        customerItems: [makeCustomerItem({ buyback: true, buybackOrderId: "order-1" })],
      }),
    );
    assert.equal(result.status, "not-handed-out");
  });

  test("is not-handed-out when the newest customer item is returned, even after an older buyout", ({
    assert,
  }) => {
    const boughtOutThenBack = makeCustomerItem({
      id: "customer-item-old",
      buyout: true,
      boughtOutAt: T1,
      handoutBranchId: BRANCH,
      handedOutAt: T1,
      handoutEmployeeId: null,
    });
    const returnedLater = makeCustomerItem({
      id: "customer-item-new",
      customerId: PETRA,
      returned: true,
      returnBranchId: BRANCH,
      returnedAt: T3,
      handoutBranchId: BRANCH,
      handedOutAt: T2,
      handoutEmployeeId: null,
    });
    const result = assembleBlidSearch(
      baseSources({ customerItems: [boughtOutThenBack, returnedLater] }),
    );
    assert.equal(result.status, "not-handed-out");
  });

  test("is not-handed-out when nothing references the blid", ({ assert }) => {
    const result = assembleBlidSearch(baseSources());
    assert.equal(result.status, "not-handed-out");
  });
});

test.group("BlidSearchService.assembleBlidSearch() – customer item authority", () => {
  const BRANCH_2 = "branch-id-2";
  const branchNames = new Map([
    [BRANCH, "Ullern VGS"],
    [BRANCH_2, "Nissen VGS"],
  ]);

  test("its events display the customer item's branch, not the order's", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "rent",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 100,
          unitPrice: 100,
          handout: true,
          periodTo: DEADLINE_1,
        },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({
        branchNames,
        orders: [order],
        customerItems: [
          makeCustomerItem({
            orderIds: [order.id],
            handoutBranchId: BRANCH_2,
            handedOutAt: T1,
            handoutEmployeeId: null,
          }),
        ],
      }),
    );
    const handout = result.history.find((event) => event.action === "handout");
    assert.equal(handout?.branchName, "Nissen VGS");
  });

  test("a return displays the branch the customer item was returned to", ({ assert }) => {
    const order = makeOrder({
      branchId: BRANCH,
      orderItems: [
        {
          type: "return",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({
        branchNames,
        orders: [order],
        customerItems: [
          makeCustomerItem({
            orderIds: [order.id],
            returned: true,
            returnBranchId: BRANCH_2,
            returnedAt: T2,
          }),
        ],
      }),
    );
    const returnEvent = result.history.find((event) => event.action === "return");
    assert.equal(returnEvent?.branchName, "Nissen VGS");
  });

  test("the newest deadline-carrying event displays the customer item's deadline", ({ assert }) => {
    const CORRECTED_DEADLINE = new Date("2028-02-01T00:00:00.000Z");
    const handoutOrder = makeOrder({
      orderItems: [
        {
          type: "rent",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 100,
          unitPrice: 100,
          handout: true,
          periodTo: DEADLINE_1,
        },
      ],
    });
    const extendOrder = makeOrder({
      id: "order-2",
      createdAt: T2,
      orderItems: [
        {
          type: "extend",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 50,
          unitPrice: 50,
          periodFrom: DEADLINE_1,
          periodTo: DEADLINE_2,
        },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({
        orders: [handoutOrder, extendOrder],
        customerItems: [
          makeCustomerItem({
            orderIds: [handoutOrder.id, extendOrder.id],
            deadline: CORRECTED_DEADLINE,
          }),
        ],
      }),
    );
    const extend = result.history.find((event) => event.action === "extend");
    const handout = result.history.find((event) => event.action === "handout");
    assert.equal(extend?.deadline, CORRECTED_DEADLINE.toISOString());
    assert.equal(handout?.deadline, DEADLINE_1.toISOString());
  });
});

test.group("BlidSearchService.assembleBlidSearch() – active item", () => {
  test("exposes the actively held customer item with its deadline and handout branch", ({
    assert,
  }) => {
    const result = assembleBlidSearch(baseSources({ customerItems: [makeCustomerItem()] }));
    assert.deepEqual(result.activeItem, {
      customerItemId: "customer-item-1",
      deadline: new Date(DEADLINE_1).toISOString(),
      handoutBranchId: BRANCH,
    });
  });

  test("is absent once the book is returned", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({
        customerItems: [
          makeCustomerItem({
            returned: true,
            returnBranchId: BRANCH,
            returnedAt: T2,
          }),
        ],
      }),
    );
    assert.isUndefined(result.activeItem);
  });
});

test.group("BlidSearchService.assembleBlidSearch() – transfer reconciliation", () => {
  test("a transfer shows once even when both parties' orders and the handover exist", ({
    assert,
  }) => {
    // A modern match transfer writes three records within the same second: the sender's
    // match-deliver order, the receiver's match-receive order, and the handover row (which
    // references the receiver's order).
    const senderOrder = makeOrder({
      id: "order-deliver",
      customerId: PETRA,
      byCustomer: true,
      employeeId: null,
      createdAt: T2,
      orderItems: [
        {
          type: "match-deliver",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const receiverOrder = makeOrder({
      id: "order-receive",
      customerId: IDA,
      byCustomer: true,
      employeeId: null,
      createdAt: new Date(T2.getTime() + 200),
      orderItems: [
        {
          type: "match-receive",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const result = assembleBlidSearch(
      baseSources({
        orders: [senderOrder, receiverOrder],
        handovers: [
          {
            fromUserDetailId: PETRA,
            toUserDetailId: IDA,
            occurredAt: T2,
            orderId: "order-receive",
          },
        ],
      }),
    );
    assert.lengthOf(result.history, 1);
    const [event] = result.history;
    assert.equal(event?.action, "match-transfer");
    assert.deepEqual(event?.from, { type: "customer", detailsId: PETRA, name: "Petra" });
    assert.deepEqual(event?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("merges a legacy match-deliver and match-receive pair into one two-sided event", ({
    assert,
  }) => {
    const senderOrder = makeOrder({
      id: "order-deliver",
      customerId: PETRA,
      byCustomer: true,
      employeeId: null,
      createdAt: T2,
      orderItems: [
        {
          type: "match-deliver",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const receiverOrder = makeOrder({
      id: "order-receive",
      customerId: IDA,
      byCustomer: true,
      employeeId: null,
      createdAt: new Date(T2.getTime() + 100),
      orderItems: [
        {
          type: "match-receive",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [senderOrder, receiverOrder] }));
    assert.lengthOf(result.history, 1);
    const [event] = result.history;
    assert.equal(event?.action, "match-transfer");
    assert.deepEqual(event?.from, { type: "customer", detailsId: PETRA, name: "Petra" });
    assert.deepEqual(event?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("drops the receiver's stray deliver order left by a double scan", ({ assert }) => {
    // Seen on legacy matches (blid 87767074): a double scan records the receive twice and, on
    // the second pass, a deliver order in the receiver's own name — all within one second.
    const matchOrder = (
      id: string,
      customer: string,
      type: "match-receive" | "match-deliver",
      offsetMs: number,
    ) =>
      makeOrder({
        id,
        customerId: customer,
        byCustomer: true,
        employeeId: null,
        createdAt: new Date(T2.getTime() + offsetMs),
        orderItems: [
          { type, itemId: "item-1", blid: BLID, title: "Sinus 1T", amount: 0, unitPrice: 0 },
        ],
      });
    const result = assembleBlidSearch(
      baseSources({
        orders: [
          matchOrder("order-receive", IDA, "match-receive", 41),
          matchOrder("order-deliver", PETRA, "match-deliver", 99),
          matchOrder("order-receive-dup", IDA, "match-receive", 485),
          matchOrder("order-deliver-echo", IDA, "match-deliver", 530),
        ],
      }),
    );
    assert.lengthOf(result.history, 1);
    const [event] = result.history;
    assert.equal(event?.action, "match-transfer");
    assert.deepEqual(event?.from, { type: "customer", detailsId: PETRA, name: "Petra" });
    assert.deepEqual(event?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("never pairs a customer's receive with their own deliver order", ({ assert }) => {
    const matchOrder = (id: string, type: "match-receive" | "match-deliver", offsetMs: number) =>
      makeOrder({
        id,
        customerId: IDA,
        byCustomer: true,
        employeeId: null,
        createdAt: new Date(T2.getTime() + offsetMs),
        orderItems: [
          { type, itemId: "item-1", blid: BLID, title: "Sinus 1T", amount: 0, unitPrice: 0 },
        ],
      });
    const result = assembleBlidSearch(
      baseSources({
        orders: [
          matchOrder("order-deliver-echo", "match-deliver", 0),
          matchOrder("order-receive", "match-receive", 100),
        ],
      }),
    );
    assert.lengthOf(result.history, 1);
    const [event] = result.history;
    assert.equal(event?.action, "match-transfer");
    assert.isUndefined(event?.from);
    assert.deepEqual(event?.to, { type: "customer", detailsId: IDA, name: "Ida" });
  });

  test("does not synthesize a stand handout for a customer who got the book via a transfer", ({
    assert,
  }) => {
    // The receiver's customer item is created by the transfer, so it must not add its own
    // "got the book from stand" story on top of the transfer event.
    const customerItem = makeCustomerItem({
      handoutBranchId: BRANCH,
      handedOutAt: T2,
      handoutEmployeeId: null,
    });
    const result = assembleBlidSearch(
      baseSources({
        customerItems: [customerItem],
        handovers: [
          { fromUserDetailId: PETRA, toUserDetailId: IDA, occurredAt: T2, orderId: null },
        ],
      }),
    );
    assert.lengthOf(result.history, 1);
    assert.equal(result.history[0]?.action, "match-transfer");
  });

  test("omits the employee when their user detail cannot be resolved", ({ assert }) => {
    const order = makeOrder({
      employeeId: "deleted-employee",
      orderItems: [
        {
          type: "rent",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
          handout: true,
        },
      ],
    });
    const result = assembleBlidSearch(baseSources({ orders: [order] }));
    assert.isUndefined(result.history[0]?.employee);
  });
});

test.group("BlidSearchService.assembleBlidSearch() – ordering", () => {
  test("sorts history newest first", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({
        handovers: [
          { fromUserDetailId: null, toUserDetailId: PETRA, occurredAt: T1, orderId: null },
          { fromUserDetailId: PETRA, toUserDetailId: IDA, occurredAt: T2, orderId: null },
          { fromUserDetailId: IDA, toUserDetailId: null, occurredAt: T3, orderId: null },
        ],
      }),
    );
    assert.deepEqual(
      result.history.map((event) => event.action),
      ["return", "match-transfer", "handout"],
    );
    assert.deepEqual(
      result.history.map((event) => event.time),
      [T3.toISOString(), T2.toISOString(), T1.toISOString()],
    );
  });
});

test.group("BlidSearchService.assembleBlidSearch() – unique ID registration", () => {
  const REGISTERED_AT = new Date("2026-07-20T09:00:00.000Z");

  test("adds a registered event at the unique item's creation time", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({ registration: { createdAt: REGISTERED_AT, updatedAt: REGISTERED_AT } }),
    );
    assert.lengthOf(result.history, 1);
    assert.equal(result.history[0]?.action, "registered");
    assert.equal(result.history[0]?.time, REGISTERED_AT.toISOString());
    assert.isFalse(result.history[0]?.byCustomer);
  });

  test("hides the edited event when the update is within a second of creation", ({ assert }) => {
    // Mongoose stamps the two timestamps in separate calls on insert, so they can drift by
    // a millisecond without anyone having edited the record.
    const drifted = new Date(REGISTERED_AT.getTime() + 999);
    const result = assembleBlidSearch(
      baseSources({ registration: { createdAt: REGISTERED_AT, updatedAt: drifted } }),
    );
    assert.deepEqual(
      result.history.map((event) => event.action),
      ["registered"],
    );
  });

  test("adds an edited event at the last update when it came later", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({ registration: { createdAt: REGISTERED_AT, updatedAt: T3 } }),
    );
    assert.deepEqual(
      result.history.map((event) => [event.action, event.time]),
      [
        ["edited", T3.toISOString()],
        ["registered", REGISTERED_AT.toISOString()],
      ],
    );
  });

  test("sorts the registration events by time among the custody events", ({ assert }) => {
    const result = assembleBlidSearch(
      baseSources({
        registration: { createdAt: REGISTERED_AT, updatedAt: T3 },
        customerItems: [makeCustomerItem({ deadline: EXPIRED_DEADLINE })],
      }),
    );
    assert.deepEqual(
      result.history.map((event) => event.action),
      ["deadline-expired", "edited", "handout", "registered"],
    );
  });

  test("adds no registration events when the unique item is gone", ({ assert }) => {
    const result = assembleBlidSearch(baseSources({ registered: false, registration: null }));
    assert.lengthOf(result.history, 0);
  });
});

test.group("BlidSearchService.collectReferencedIds()", () => {
  test("collects customer, employee and branch ids from every source", ({ assert }) => {
    const order = makeOrder({
      orderItems: [
        {
          type: "return",
          itemId: "item-1",
          blid: BLID,
          title: "Sinus 1T",
          amount: 0,
          unitPrice: 0,
        },
      ],
    });
    const { userDetailIds, branchIds } = collectReferencedIds(
      [makeCustomerItem()],
      [order],
      [{ fromUserDetailId: PETRA, toUserDetailId: null, occurredAt: T2, orderId: null }],
    );
    assert.includeMembers(userDetailIds, [IDA, PETRA, EMPLOYEE]);
    assert.includeMembers(branchIds, [BRANCH]);
  });
});
