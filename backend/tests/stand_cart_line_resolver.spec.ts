import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";
import { DateTime } from "luxon";

import BranchModel from "#models/branch";
import OrderItem from "#models/order_item";
import Payment from "#models/payment";
import { PeerObligations } from "#services/matches/peer_obligations";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import User from "#models/user";
import type { Branch } from "#shared/branch";
import type { StandCartLine } from "#shared/stand_cart";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createDelivery } from "#tests/delivery_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import { unchecked } from "#tests/test-doubles";
import { createUser, userDouble } from "#tests/user_fixtures";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SEMESTER_END = "2026-12-20";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f01";
const OTHER_CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f02";
const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f11";
const OTHER_BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f12";
const ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f21";
const OTHER_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f22";
const ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";
const PAID_ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f32";
const HANDOUT_ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f33";
const CUSTOMER_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f41";
const BLID = "12345678";
const OTHER_BLID = "87654321";
// One title in two editions
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

const ISBN = 9_788_202_000_001;
const OTHER_ISBN = 9_788_202_000_002;

/** The catalogue rows every test starts from; the Postgres table is seeded with them. */
const CATALOGUE = [
  { id: ITEM_ID, title: "Sinus 1T", price: 500, buyback: false, isbn: ISBN },
  { id: OTHER_ITEM_ID, title: "Kosmos SF", price: 600, buyback: true, isbn: OTHER_ISBN },
];

const branches: Partial<Branch>[] = [
  {
    id: BRANCH_ID,
    name: "Ullern VGS",
    paymentResponsible: true,
    // Nothing is bought back unless a test says so.
    sellPercentage: 0,
    rentPeriods: [{ type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 1 }],
  },
  {
    id: OTHER_BRANCH_ID,
    name: "Persbråten VGS",
    paymentResponsible: false,
    sellPercentage: 0,
    rentPeriods: [{ type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 0.5 }],
  },
];

/** An order row to insert, and whether it has payments recorded. */
type OrderSpec = Parameters<typeof createOrder>[0] & { id: string; paid?: boolean };

function orderWith(overrides: Partial<OrderSpec>): OrderSpec {
  return {
    id: ORDER_ID,
    customerId: CUSTOMER_ID,
    branchId: BRANCH_ID,
    placed: true,
    byCustomer: true,
    amount: 0,
    orderItems: [
      {
        type: "rent",
        itemId: ITEM_ID,
        periodTo: DateTime.fromISO(SEMESTER_END),
        periodType: "semester",
      },
    ],
    ...overrides,
  };
}

/** A customer item row to insert. */
type CustomerItemSpec = Parameters<typeof createCustomerItem>[0];

const activeCustomerItem: CustomerItemSpec = {
  id: CUSTOMER_ITEM_ID,
  customerId: CUSTOMER_ID,
  itemId: ITEM_ID,
  blid: BLID,
  type: "rent",
  deadline: DateTime.fromISO(SEMESTER_END),
  handoutBranchId: BRANCH_ID,
  handedOutAt: DateTime.fromJSDate(NOW),
  createdAt: DateTime.fromISO("2026-08-01T10:00:00.000Z"),
};

interface World {
  orders: OrderSpec[];
  customerItems: CustomerItemSpec[];
  /** The orders shipped with Bring. */
  bringOrderIds: string[];
  peerSender: string | null;
}

/**
 * Inserts the orders. Moved links may point either way between them, so the lines get them once
 * every order exists.
 */
async function insertOrders(orders: OrderSpec[]): Promise<void> {
  for (const { paid: _paid, orderItems = [], ...order } of orders) {
    await createOrder({
      ...order,
      orderItems: orderItems.map(
        ({ movedFromOrderId: _from, movedToOrderId: _to, ...orderItem }) => orderItem,
      ),
    });
  }
  for (const order of orders) {
    for (const [position, orderItem] of (order.orderItems ?? []).entries()) {
      await OrderItem.query()
        .where("order_id", order.id)
        .where("position", position)
        .update({
          moved_from_order_id: orderItem.movedFromOrderId ?? null,
          moved_to_order_id: orderItem.movedToOrderId ?? null,
        });
    }
  }
}

async function stubWorld(sandbox: sinon.SinonSandbox, world: World) {
  // Order lines may point at the customer items, so those go in first.
  for (const customerItem of world.customerItems) {
    await createCustomerItem(customerItem);
  }
  await insertOrders(world.orders);
  const paid = new Set(world.orders.filter((order) => order.paid).map((order) => order.id));
  sandbox
    .stub(Payment, "existFor")
    .callsFake((orderId: string) => Promise.resolve(paid.has(orderId)));
  for (const orderId of world.bringOrderIds) {
    await createDelivery({ orderId });
  }
  sandbox.stub(User, "find").resolves(userDouble({ id: OTHER_CUSTOMER_ID, name: "Kari Nordmann" }));
  sandbox.stub(PeerObligations, "findPeerSender").resolves(world.peerSender);
}

function line(result: Awaited<ReturnType<typeof StandCartLineResolver.resolve>>): StandCartLine {
  if (result.kind !== "line") {
    throw new Error(`expected a line, got ${JSON.stringify(result)}`);
  }
  return result.line;
}

test.group("StandCartLineResolver.resolve", (group) => {
  let sandbox: sinon.SinonSandbox;
  let world: World;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    for (const item of CATALOGUE) {
      await createItem(item);
    }
    for (const branch of branches) {
      await createBranch(branch);
    }
    await createUniqueItem({ itemId: ITEM_ID, blid: BLID });
    await createUniqueItem({ itemId: OTHER_ITEM_ID, blid: OTHER_BLID });
    await createUser({ id: CUSTOMER_ID });
    await createUser({ id: OTHER_CUSTOMER_ID });
    sandbox = createSandbox();
    world = {
      orders: [orderWith({})],
      customerItems: [],
      bringOrderIds: [],
      peerSender: null,
    };
  });
  group.each.teardown(() => sandbox.restore());

  const resolve = async (
    source: Parameters<typeof StandCartLineResolver.resolve>[0]["source"],
    extra: Partial<Parameters<typeof StandCartLineResolver.resolve>[0]> = {},
  ) => {
    await stubWorld(sandbox, world);
    return StandCartLineResolver.resolve(
      { customerId: CUSTOMER_ID, branchId: BRANCH_ID, source, ...extra },
      NOW,
    );
  };

  test("builds a line for an open order item; without a copy in hand it cannot be handed out", async ({
    assert,
  }) => {
    const resolved = line(await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID }));
    assert.equal(resolved.key, `order:${ORDER_ID}:${ITEM_ID}`);
    assert.equal(resolved.title, "Sinus 1T");
    assert.equal(resolved.itemId, ITEM_ID);
    assert.isNull(resolved.blid);
    assert.deepEqual(resolved.originalBranch, { id: BRANCH_ID, name: "Ullern VGS" });
    assert.deepEqual(resolved.notes, []);
    assert.isFalse(resolved.options.some((option) => option.type === "rent"));
    assert.equal(resolved.options[resolved.defaultOptionIndex]?.type, "cancel");
  });

  test("notes when the order sits on another branch than the cart", async ({ assert }) => {
    world.orders = [orderWith({ branchId: OTHER_BRANCH_ID })];
    const resolved = line(await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID }));
    assert.deepEqual(resolved.notes, [{ kind: "other-branch", branchName: "Persbråten VGS" }]);
    // Priced from the cart branch, which pays for its students
    assert.equal(resolved.options[0]?.price, 0);
  });

  test("notes what a prepaid mail order already paid and that it goes by mail", async ({
    assert,
  }) => {
    world.orders = [
      orderWith({
        id: PAID_ORDER_ID,
        amount: 250,
        paid: true,
        orderItems: [
          {
            type: "rent",
            itemId: ITEM_ID,
            amount: 250,
            unitPrice: 250,
            handout: false,
            delivered: false,
            periodTo: DateTime.fromISO(SEMESTER_END),
            periodType: "semester",
          },
        ],
      }),
    ];
    world.bringOrderIds = [PAID_ORDER_ID];
    const resolved = line(
      await resolve({ kind: "order", orderId: PAID_ORDER_ID, itemId: ITEM_ID }),
    );
    assert.deepEqual(resolved.notes, [
      { kind: "prepaid", amount: 250 },
      { kind: "bring-delivery" },
    ]);
  });

  test("refuses an order item that is no longer open", async ({ assert }) => {
    world.orders = [
      orderWith({
        orderItems: [
          {
            type: "rent",
            itemId: ITEM_ID,
            amount: 0,
            unitPrice: 0,
            handout: false,
            delivered: false,
            movedToOrderId: HANDOUT_ORDER_ID,
          },
        ],
      }),
      orderWith({ id: HANDOUT_ORDER_ID, orderItems: [] }),
    ];
    const result = await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID });
    assert.deepEqual(result, { kind: "refused", message: "«Sinus 1T» er ikke lenger bestilt" });
  });

  test("refuses another customer's order", async ({ assert }) => {
    world.orders = [orderWith({ customerId: OTHER_CUSTOMER_ID })];
    const result = await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID });
    assert.equal(result.kind, "refused");
  });

  test("attaches a scanned blid to an order line, which can then be handed out as ordered", async ({
    assert,
  }) => {
    const resolved = line(
      await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID }, { blid: BLID }),
    );
    assert.equal(resolved.blid, BLID);
    assert.equal(resolved.options[resolved.defaultOptionIndex]?.type, "rent");
    assert.equal(resolved.itemId, ITEM_ID);
  });

  test("refuses a blid that is another book than the ordered one", async ({ assert }) => {
    const result = await resolve(
      { kind: "order", orderId: ORDER_ID, itemId: ITEM_ID },
      { blid: OTHER_BLID },
    );
    assert.deepEqual(result, {
      kind: "refused",
      message: `Unik ID ${OTHER_BLID} er «Kosmos SF», ikke «Sinus 1T»`,
    });
  });

  test("refuses a blid another customer is holding", async ({ assert }) => {
    world.customerItems = [{ ...activeCustomerItem, customerId: OTHER_CUSTOMER_ID }];
    const result = await resolve(
      { kind: "order", orderId: ORDER_ID, itemId: ITEM_ID },
      { blid: BLID },
    );
    assert.deepEqual(result, {
      kind: "refused",
      message: "Denne boka er allerede delt ut til en annen kunde. Sjekk boka i Boksøk.",
    });
  });

  test("notes every copy of the title the customer is holding, equivalent editions included", async ({
    assert,
  }) => {
    await createItem({ id: GYMNOS_2009, title: "GYMNOS 2009", price: 400 });
    await createItem({ id: GYMNOS_2012, title: "GYMNOS 2012", price: 400 });
    world.orders = [
      orderWith({
        orderItems: [
          {
            type: "rent",
            itemId: GYMNOS_2012,
            amount: 0,
            unitPrice: 0,
            handout: false,
            delivered: false,
            periodTo: DateTime.fromISO(SEMESTER_END),
            periodType: "semester",
          },
        ],
      }),
    ];
    world.customerItems = [
      { ...activeCustomerItem, id: "held-2009", itemId: GYMNOS_2009, blid: "11111111" },
      { ...activeCustomerItem, id: "held-sinus", blid: "22222222" },
      {
        ...activeCustomerItem,
        id: "returned-2012",
        itemId: GYMNOS_2012,
        blid: "33333333",
        returned: true,
      },
    ];
    const resolved = line(await resolve({ kind: "order", orderId: ORDER_ID, itemId: GYMNOS_2012 }));
    assert.deepEqual(resolved.notes, [
      { kind: "already-held", customerItemId: "held-2009", title: "GYMNOS 2009" },
    ]);
  });

  test("notes a held copy on a scanned copy nobody ordered", async ({ assert }) => {
    world.orders = [];
    world.customerItems = [{ ...activeCustomerItem, id: "held", blid: "11111111" }];
    const resolved = line(await resolve({ kind: "item", itemId: ITEM_ID, blid: BLID }));
    assert.deepEqual(resolved.notes, [
      { kind: "already-held", customerItemId: "held", title: "Sinus 1T" },
    ]);
  });

  test("notes a book the customer is due to get from another student", async ({ assert }) => {
    world.peerSender = OTHER_CUSTOMER_ID;
    const resolved = line(await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID }));
    assert.deepEqual(resolved.notes, [
      { kind: "peer-match", deliverFromId: OTHER_CUSTOMER_ID, deliverFromName: "Kari Nordmann" },
    ]);
  });

  test("builds a line for a book the customer holds, on its handout branch", async ({ assert }) => {
    world.customerItems = [activeCustomerItem];
    world.orders = [
      orderWith({
        id: HANDOUT_ORDER_ID,
        byCustomer: false,
        orderItems: [
          {
            type: "rent",
            itemId: ITEM_ID,
            amount: 0,
            unitPrice: 0,
            handout: true,
            delivered: false,
            customerItemId: CUSTOMER_ITEM_ID,
            movedFromOrderId: PAID_ORDER_ID,
            periodTo: DateTime.fromISO(SEMESTER_END),
            periodType: "semester",
          },
        ],
      }),
      orderWith({
        id: PAID_ORDER_ID,
        amount: 250,
        paid: true,
        orderItems: [
          {
            type: "rent",
            itemId: ITEM_ID,
            amount: 250,
            unitPrice: 250,
            handout: false,
            delivered: false,
            movedToOrderId: HANDOUT_ORDER_ID,
            periodTo: DateTime.fromISO(SEMESTER_END),
            periodType: "semester",
          },
        ],
      }),
    ];
    const resolved = line(
      await resolve({ kind: "customerItem", customerItemId: CUSTOMER_ITEM_ID }),
    );
    assert.equal(resolved.key, `customerItem:${CUSTOMER_ITEM_ID}`);
    assert.equal(resolved.blid, BLID);
    assert.deepEqual(resolved.originalBranch, { id: BRANCH_ID, name: "Ullern VGS" });
    // The refund follows the handout order back to the order the customer paid
    const cancel = resolved.options.find((option) => option.type === "cancel");
    assert.equal(cancel?.price, -250);
  });

  test("refuses a book the customer no longer holds", async ({ assert }) => {
    world.customerItems = [{ ...activeCustomerItem, returned: true }];
    const result = await resolve({ kind: "customerItem", customerItemId: CUSTOMER_ITEM_ID });
    assert.deepEqual(result, { kind: "refused", message: "Kunden har ikke «Sinus 1T» lenger" });
  });

  test("builds a line for a scanned copy nobody ordered", async ({ assert }) => {
    world.orders = [];
    const resolved = line(await resolve({ kind: "item", itemId: OTHER_ITEM_ID, blid: OTHER_BLID }));
    assert.equal(resolved.key, `item:${OTHER_BLID}`);
    assert.equal(resolved.title, "Kosmos SF");
    assert.equal(resolved.blid, OTHER_BLID);
    assert.isNull(resolved.originalBranch);
  });

  test("refuses a copy line whose blid is linked to a different book", async ({ assert }) => {
    const result = await resolve({ kind: "item", itemId: ITEM_ID, blid: OTHER_BLID });
    assert.equal(result.kind, "refused");
  });

  test("reports a blid that is not linked to any book", async ({ assert }) => {
    const result = await resolve({ kind: "blid", blid: "99999999" });
    assert.deepEqual(result, { kind: "unlinked", blid: "99999999" });
  });

  test("a scanned blid the customer holds becomes that book's line", async ({ assert }) => {
    world.customerItems = [activeCustomerItem];
    world.orders = [];
    const resolved = line(await resolve({ kind: "blid", blid: BLID }));
    assert.deepEqual(resolved.source, { kind: "customerItem", customerItemId: CUSTOMER_ITEM_ID });
  });

  test("a scanned blid another customer holds is refused", async ({ assert }) => {
    world.customerItems = [{ ...activeCustomerItem, customerId: OTHER_CUSTOMER_ID }];
    const result = await resolve({ kind: "blid", blid: BLID });
    assert.equal(result.kind, "refused");
  });

  test("a scanned blid attaches to the customer's open order for that book", async ({ assert }) => {
    const resolved = line(await resolve({ kind: "blid", blid: BLID }));
    assert.deepEqual(resolved.source, { kind: "order", orderId: ORDER_ID, itemId: ITEM_ID });
    assert.equal(resolved.blid, BLID);
  });

  test("a scanned blid skips order lines already in the cart and becomes a new copy", async ({
    assert,
  }) => {
    const resolved = line(
      await resolve({ kind: "blid", blid: BLID }, { takenKeys: [`order:${ORDER_ID}:${ITEM_ID}`] }),
    );
    assert.deepEqual(resolved.source, { kind: "item", itemId: ITEM_ID, blid: BLID });
  });

  test("a scanned blid nobody ordered becomes a copy line", async ({ assert }) => {
    const resolved = line(await resolve({ kind: "blid", blid: OTHER_BLID }));
    assert.deepEqual(resolved.source, { kind: "item", itemId: OTHER_ITEM_ID, blid: OTHER_BLID });
  });

  test("a scanned ISBN attaches to the customer's open order for that book without a sticker", async ({
    assert,
  }) => {
    const resolved = line(await resolve({ kind: "isbn", isbn: String(ISBN) }));
    assert.deepEqual(resolved.source, { kind: "order", orderId: ORDER_ID, itemId: ITEM_ID });
    assert.isNull(resolved.blid);
    // A loan cannot go out unscanned, so the order can only be cancelled as it stands
    assert.equal(resolved.options[resolved.defaultOptionIndex]?.type, "cancel");
  });

  test("a scanned ISBN of an ordered buy goes out as bought, sticker or not", async ({
    assert,
  }) => {
    world.orders = [
      orderWith({
        orderItems: [
          {
            type: "buy",
            itemId: ITEM_ID,
            amount: 500,
            unitPrice: 500,
            handout: false,
            delivered: false,
          },
        ],
      }),
    ];
    const resolved = line(await resolve({ kind: "isbn", isbn: String(ISBN) }));
    assert.deepEqual(resolved.source, { kind: "order", orderId: ORDER_ID, itemId: ITEM_ID });
    assert.equal(resolved.options[resolved.defaultOptionIndex]?.type, "buy");
  });

  test("a scanned ISBN nobody ordered becomes a sticker-less copy line, sold to the stand by default", async ({
    assert,
  }) => {
    await BranchModel.query().where("id", BRANCH_ID).update({ sell_percentage: 0.33 });
    const resolved = line(await resolve({ kind: "isbn", isbn: String(OTHER_ISBN) }));
    assert.deepEqual(resolved.source, { kind: "item", itemId: OTHER_ITEM_ID, blid: null });
    assert.equal(resolved.key, `item:${OTHER_ITEM_ID}`);
    assert.isNull(resolved.blid);
    assert.equal(resolved.options[resolved.defaultOptionIndex]?.type, "sell");
  });

  test("a scanned ISBN skips order lines already in the cart", async ({ assert }) => {
    const resolved = line(
      await resolve(
        { kind: "isbn", isbn: String(ISBN) },
        { takenKeys: [`order:${ORDER_ID}:${ITEM_ID}`] },
      ),
    );
    assert.deepEqual(resolved.source, { kind: "item", itemId: ITEM_ID, blid: null });
  });

  test("refuses an ISBN no book has", async ({ assert }) => {
    const result = await resolve({ kind: "isbn", isbn: "9780000000000" });
    assert.deepEqual(result, {
      kind: "refused",
      message: "Fant ingen bok med ISBN 9780000000000. Sjekk at du skannet riktig strekkode.",
    });
  });

  test("a sticker-less copy line resolves from the item alone", async ({ assert }) => {
    const resolved = line(await resolve({ kind: "item", itemId: OTHER_ITEM_ID, blid: null }));
    assert.equal(resolved.title, "Kosmos SF");
    assert.isNull(resolved.blid);
    assert.isFalse(resolved.options.some((option) => option.type === "rent"));
  });

  test("refuses an order that does not exist", async ({ assert }) => {
    world.orders = [];
    const result = await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID });
    assert.deepEqual(result, { kind: "refused", message: "Fant ikke bestillingen" });
  });

  test("refuses a customer item that does not exist", async ({ assert }) => {
    const missing = await resolve({ kind: "customerItem", customerItemId: unchecked("nope") });
    assert.deepEqual(missing, { kind: "refused", message: "Fant ikke boka" });
  });
});
