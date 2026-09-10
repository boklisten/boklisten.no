import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import type { SEDbQuery } from "#models/mongoose/storage/db-query";
import { MatchRepository } from "#services/matches/match_repository";
import { PeerObligations } from "#services/matches/peer_obligations";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type { BranchItem } from "#shared/branch-item";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Delivery } from "#shared/delivery/delivery";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { StandCartLine } from "#shared/stand_cart";
import type { UniqueItem } from "#shared/unique-item";
import type { UserDetail } from "#shared/user-detail";
import { mock, unchecked } from "#tests/test-doubles";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SEMESTER_END = new Date("2026-12-20T00:00:00.000Z");

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
const DELIVERY_ID = "5f7f7f7f7f7f7f7f7f7f7f51";
const BLID = "12345678";
const OTHER_BLID = "87654321";

const items: Record<string, Item> = {
  [ITEM_ID]: mock<Item>({ id: ITEM_ID, title: "Sinus 1T", price: 500, buyback: false }),
  [OTHER_ITEM_ID]: mock<Item>({ id: OTHER_ITEM_ID, title: "Kosmos SF", price: 600, buyback: true }),
};

const branches: Record<string, Branch> = {
  [BRANCH_ID]: mock<Branch>({
    id: BRANCH_ID,
    name: "Ullern VGS",
    paymentInfo: {
      responsible: true,
      rentPeriods: [{ type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 1 }],
      extendPeriods: [],
    },
  }),
  [OTHER_BRANCH_ID]: mock<Branch>({
    id: OTHER_BRANCH_ID,
    name: "Persbråten VGS",
    paymentInfo: {
      responsible: false,
      rentPeriods: [
        { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 0.5 },
      ],
      extendPeriods: [],
    },
  }),
};

function orderWith(overrides: Partial<Order>): Order {
  return mock<Order>({
    id: ORDER_ID,
    customer: CUSTOMER_ID,
    branch: BRANCH_ID,
    placed: true,
    byCustomer: true,
    payments: [],
    amount: 0,
    orderItems: [
      {
        type: "rent",
        item: ITEM_ID,
        title: "Sinus 1T",
        amount: 0,
        unitPrice: 0,
        handout: false,
        delivered: false,
        info: { to: SEMESTER_END, periodType: "semester" },
      },
    ],
    ...overrides,
  });
}

const activeCustomerItem = mock<CustomerItem>({
  id: CUSTOMER_ITEM_ID,
  customer: CUSTOMER_ID,
  item: ITEM_ID,
  blid: BLID,
  type: "rent",
  deadline: SEMESTER_END,
  handout: true,
  returned: false,
  buyout: false,
  cancel: false,
  buyback: false,
  handoutInfo: { handoutBy: "branch", handoutById: BRANCH_ID, time: NOW },
  creationTime: new Date("2026-08-01T10:00:00.000Z"),
  orders: [HANDOUT_ORDER_ID],
});

interface World {
  orders: Order[];
  customerItems: CustomerItem[];
  uniqueItems: UniqueItem[];
  branchItems: BranchItem[];
  deliveries: Delivery[];
  peerSender: string | null;
}

function stringFilter(query: SEDbQuery, field: string): string | undefined {
  return query.stringFilters.find((filter) => filter.fieldName === field)?.value;
}

function objectIdFilter(query: SEDbQuery, field: string): string | undefined {
  const value = query.objectIdFilters.find((filter) => filter.fieldName === field)?.value;
  return typeof value === "string" ? value : undefined;
}

const byId =
  <T extends { id: string }>(rows: T[]) =>
  (id: string | undefined) =>
    Promise.resolve(rows.find((row) => row.id === id) ?? null);

function stubWorld(sandbox: sinon.SinonSandbox, world: World) {
  sandbox.stub(StorageService.Orders, "getOrNull").callsFake(byId(world.orders));
  sandbox
    .stub(StorageService.Orders, "getByQueryOrNull")
    .callsFake((query) =>
      Promise.resolve(
        world.orders.filter((order) => order.customer === objectIdFilter(query, "customer")),
      ),
    );
  sandbox.stub(StorageService.CustomerItems, "getOrNull").callsFake(byId(world.customerItems));
  sandbox
    .stub(StorageService.CustomerItems, "getByQueryOrNull")
    .callsFake((query) =>
      Promise.resolve(
        world.customerItems.filter(
          (customerItem) => customerItem.blid === stringFilter(query, "blid"),
        ),
      ),
    );
  sandbox
    .stub(StorageService.Items, "getOrNull")
    .callsFake((id) => Promise.resolve(id === undefined ? null : (items[id] ?? null)));
  sandbox
    .stub(StorageService.Branches, "getOrNull")
    .callsFake((id) => Promise.resolve(id === undefined ? null : (branches[id] ?? null)));
  sandbox
    .stub(StorageService.BranchItems, "getByQueryOrNull")
    .callsFake((query) =>
      Promise.resolve(
        world.branchItems.filter(
          (branchItem) =>
            branchItem.branch === objectIdFilter(query, "branch") &&
            branchItem.item === objectIdFilter(query, "item"),
        ),
      ),
    );
  sandbox
    .stub(StorageService.UniqueItems, "getByQueryOrNull")
    .callsFake((query) =>
      Promise.resolve(
        world.uniqueItems.filter((uniqueItem) => uniqueItem.blid === stringFilter(query, "blid")),
      ),
    );
  sandbox.stub(StorageService.Deliveries, "getOrNull").callsFake(byId(world.deliveries));
  sandbox
    .stub(StorageService.UserDetails, "getOrNull")
    .resolves(mock<UserDetail>({ id: OTHER_CUSTOMER_ID, name: "Kari Nordmann" }));
  sandbox.stub(MatchRepository, "findForCustomer").resolves([]);
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

  group.each.setup(() => {
    sandbox = createSandbox();
    world = {
      orders: [orderWith({})],
      customerItems: [],
      uniqueItems: [
        mock<UniqueItem>({ id: "u1", blid: BLID, item: ITEM_ID, title: "Sinus 1T" }),
        mock<UniqueItem>({ id: "u2", blid: OTHER_BLID, item: OTHER_ITEM_ID, title: "Kosmos SF" }),
      ],
      branchItems: [],
      deliveries: [],
      peerSender: null,
    };
  });
  group.each.teardown(() => sandbox.restore());

  const resolve = (
    source: Parameters<typeof StandCartLineResolver.resolve>[0]["source"],
    extra: Partial<Parameters<typeof StandCartLineResolver.resolve>[0]> = {},
  ) => {
    stubWorld(sandbox, world);
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
    world.orders = [orderWith({ branch: OTHER_BRANCH_ID })];
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
        payments: ["payment1"],
        delivery: DELIVERY_ID,
        orderItems: [
          {
            type: "rent",
            item: ITEM_ID,
            title: "Sinus 1T",
            amount: 250,
            unitPrice: 250,
            handout: false,
            delivered: false,
            info: { to: SEMESTER_END, periodType: "semester" },
          },
        ],
      }),
    ];
    world.deliveries = [mock<Delivery>({ id: DELIVERY_ID, method: "bring" })];
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
            item: ITEM_ID,
            title: "Sinus 1T",
            amount: 0,
            unitPrice: 0,
            handout: false,
            delivered: false,
            movedToOrder: HANDOUT_ORDER_ID,
          },
        ],
      }),
    ];
    const result = await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID });
    assert.deepEqual(result, { kind: "refused", message: "«Sinus 1T» er ikke lenger bestilt" });
  });

  test("refuses another customer's order", async ({ assert }) => {
    world.orders = [orderWith({ customer: OTHER_CUSTOMER_ID })];
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
    world.customerItems = [{ ...activeCustomerItem, customer: OTHER_CUSTOMER_ID }];
    const result = await resolve(
      { kind: "order", orderId: ORDER_ID, itemId: ITEM_ID },
      { blid: BLID },
    );
    assert.deepEqual(result, {
      kind: "refused",
      message: "Denne boka er allerede delt ut til en annen kunde. Sjekk boka i Boksøk.",
    });
  });

  test("notes a book the customer is due to get from another student", async ({ assert }) => {
    world.peerSender = OTHER_CUSTOMER_ID;
    const resolved = line(await resolve({ kind: "order", orderId: ORDER_ID, itemId: ITEM_ID }));
    assert.deepEqual(resolved.notes, [{ kind: "peer-match", deliverFromName: "Kari Nordmann" }]);
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
            item: ITEM_ID,
            title: "Sinus 1T",
            amount: 0,
            unitPrice: 0,
            handout: true,
            delivered: false,
            customerItem: CUSTOMER_ITEM_ID,
            movedFromOrder: PAID_ORDER_ID,
            info: { to: SEMESTER_END, periodType: "semester" },
          },
        ],
      }),
      orderWith({
        id: PAID_ORDER_ID,
        amount: 250,
        payments: ["payment1"],
        orderItems: [
          {
            type: "rent",
            item: ITEM_ID,
            title: "Sinus 1T",
            amount: 250,
            unitPrice: 250,
            handout: false,
            delivered: false,
            movedToOrder: HANDOUT_ORDER_ID,
            info: { to: SEMESTER_END, periodType: "semester" },
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
    world.customerItems = [{ ...activeCustomerItem, customer: OTHER_CUSTOMER_ID }];
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
