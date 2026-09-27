import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import { createSandbox } from "sinon";
import type sinon from "sinon";

import BadRequestException from "#exceptions/bad_request_exception";
import type Branch from "#models/branch";
import type Item from "#models/item";
import type User from "#models/user";
import { OrderManagerService, toBringReportRow } from "#services/order_manager_service";
import { OrderPayments } from "#services/payments/order_payments";
import type { Payment } from "#shared/payment/payment";
import { createBranch } from "#tests/branch_fixtures";
import { createDelivery } from "#tests/delivery_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";
import { mock } from "#tests/test-doubles";

const T0 = DateTime.fromISO("2026-09-01T12:00:00.000Z");
const at = (seconds: number) => T0.plus({ seconds });

interface World {
  branch: Branch;
  otherBranch: Branch;
  customer: User;
  sinus: Item;
  matte: Item;
}

async function seedWorld(): Promise<World> {
  const [branch, otherBranch, customer, sinus, matte] = await Promise.all([
    createBranch({ name: "Ullern VGS" }),
    createBranch({ name: "Nydalen VGS" }),
    createUser({ name: "Kari", email: "kari@example.com", phone: "91234567" }),
    createItem({ title: "Sinus 1T" }),
    createItem({ title: "Matte 1P" }),
  ]);
  return { branch, otherBranch, customer, sinus, matte };
}

/** Payments stay in Mongo, which the test environment has none of. */
function stubPayments(sandbox: sinon.SinonSandbox, payments = new Map<string, Payment[]>()) {
  sandbox.stub(OrderPayments, "byOrder").resolves(payments);
}

test.group("OrderManagerService: listing", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    return () => sandbox.restore();
  });

  test("only placed orders with a book still owed, newest first", async ({ assert }) => {
    stubPayments(sandbox);
    const { branch, customer, sinus, matte } = await seedWorld();
    const older = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: at(0),
      orderItems: [
        { itemId: sinus.id, type: "buy" },
        { itemId: matte.id, handout: true },
      ],
    });
    const newer = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: at(10),
      orderItems: [{ itemId: sinus.id, type: "partly-payment" }],
    });
    // Not open: unplaced, handed out, delivered, carried on, or a type that owes no book.
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      placed: false,
      orderItems: [{ itemId: sinus.id }],
    });
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [
        { itemId: sinus.id, handout: true },
        { itemId: sinus.id, delivered: true },
        { itemId: sinus.id, movedToOrderId: newer.id },
        { itemId: sinus.id, type: "extend" },
      ],
    });

    const page = await OrderManagerService.listOpenOrders({}, undefined, 50);

    assert.deepEqual(
      page.rows.map((row) => row.id),
      [newer.id, older.id],
    );
    assert.deepEqual(page.rows[1]?.openItems, [
      { itemId: sinus.id, title: "Sinus 1T", type: "buy" },
    ]);
    assert.deepEqual(page.rows[1]?.customer, { id: customer.id, name: "Kari" });
    assert.deepEqual(page.rows[1]?.branch, { id: branch.id, name: "Ullern VGS" });
    assert.equal(page.rows[1]?.creationTime, at(0).toJSDate().toISOString());
    assert.isNull(page.nextCursor);
  });

  test("the branch filter narrows to the given branches", async ({ assert }) => {
    stubPayments(sandbox);
    const { branch, otherBranch, customer, sinus } = await seedWorld();
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id }],
    });
    const other = await createOrder({
      branchId: otherBranch.id,
      customerId: customer.id,
      orderItems: [{ itemId: sinus.id }],
    });

    const page = await OrderManagerService.listOpenOrders(
      { branchIds: [otherBranch.id] },
      undefined,
      50,
    );

    assert.deepEqual(
      page.rows.map((row) => row.id),
      [other.id],
    );
  });

  test("an order whose customer is gone is listed without one", async ({ assert }) => {
    stubPayments(sandbox);
    const { branch, sinus } = await seedWorld();
    await createOrder({
      branchId: branch.id,
      customerId: null,
      orderItems: [{ itemId: sinus.id }],
    });

    const page = await OrderManagerService.listOpenOrders({}, undefined, 50);

    assert.isNull(page.rows[0]?.customer);
  });

  test("the cursor walks every order once, also across equal timestamps", async ({ assert }) => {
    stubPayments(sandbox);
    const { branch, customer, sinus } = await seedWorld();
    const created = [];
    for (const seconds of [0, 5, 5, 5, 9]) {
      created.push(
        await createOrder({
          branchId: branch.id,
          customerId: customer.id,
          createdAt: at(seconds),
          orderItems: [{ itemId: sinus.id }],
        }),
      );
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await OrderManagerService.listOpenOrders({}, cursor, 2);
      seen.push(...page.rows.map((row) => row.id));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor !== undefined && pages < 10);

    const expected = created
      .toSorted(
        (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis() || b.id.localeCompare(a.id),
      )
      .map((order) => order.id);
    assert.deepEqual(seen, expected);
    assert.equal(pages, 3);
  });

  test("a mangled cursor is refused", async ({ assert }) => {
    stubPayments(sandbox);
    await assert.rejects(
      () => OrderManagerService.listOpenOrders({}, "not-a-cursor", 50),
      BadRequestException,
    );
  });

  test("unpaid means something to pay and no payment recorded", async ({ assert }) => {
    const { branch, customer, sinus } = await seedWorld();
    const free = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: at(0),
      orderItems: [{ itemId: sinus.id }],
    });
    const owing = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      amount: 100,
      createdAt: at(1),
      orderItems: [{ itemId: sinus.id }],
    });
    const paid = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      amount: 100,
      createdAt: at(2),
      orderItems: [{ itemId: sinus.id }],
    });
    stubPayments(sandbox, new Map([[paid.id, [mock<Payment>({ id: "p" })]]]));

    const page = await OrderManagerService.listOpenOrders({}, undefined, 50);

    const unpaid = new Map(page.rows.map((row) => [row.id, row.unpaid]));
    assert.isFalse(unpaid.get(free.id));
    assert.isTrue(unpaid.get(owing.id));
    assert.isFalse(unpaid.get(paid.id));
  });

  test("Bring orders are flagged, and Bring-only narrows before the page is cut", async ({
    assert,
  }) => {
    const { branch, customer, sinus } = await seedWorld();
    const mailed = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: at(0),
      orderItems: [{ itemId: sinus.id }],
    });
    await createDelivery({ orderId: mailed.id });
    for (const index of [0, 1, 2]) {
      const order = await createOrder({
        branchId: branch.id,
        customerId: customer.id,
        createdAt: at(10 + index),
        orderItems: [{ itemId: sinus.id }],
      });
      if (index === 0) {
        await createDelivery({ orderId: order.id, method: "branch", branchId: branch.id });
      }
    }
    stubPayments(sandbox);

    const all = await OrderManagerService.listOpenOrders({}, undefined, 50);
    assert.deepEqual(
      all.rows.filter((row) => row.bring).map((row) => row.id),
      [mailed.id],
    );

    const bringOnly = await OrderManagerService.listOpenOrders({ bringOnly: true }, undefined, 1);
    assert.deepEqual(
      bringOnly.rows.map((row) => row.id),
      [mailed.id],
    );
    assert.isNull(bringOnly.nextCursor);
  });
});

test.group("OrderManagerService: reports", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    return () => sandbox.restore();
  });

  test("the orders report has one row per open book, in the CSV column order", async ({
    assert,
  }) => {
    const { branch, customer, sinus, matte } = await seedWorld();
    const membership = await createBranch({ name: "Ullern VG1" });
    await customer.merge({ branchMembershipId: membership.id }).save();
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      amount: 100,
      createdAt: at(0),
      orderItems: [{ itemId: sinus.id }, { itemId: matte.id, handout: true }],
    });
    stubPayments(sandbox, new Map([[order.id, [mock<Payment>({ id: "p" })]]]));

    const report = await OrderManagerService.ordersReport({});

    assert.lengthOf(report, 1);
    assert.deepEqual(Object.keys(report[0] ?? {}), [
      "name",
      "email",
      "phone",
      "address",
      "dob",
      "branchMembership",
      "school",
      "title",
      "isbn",
      "orderTime",
      "paid",
      "pivot",
    ]);
    assert.equal(report[0]?.name, "Kari");
    assert.equal(report[0]?.branchMembership, "Ullern VG1");
    assert.equal(report[0]?.school, "Ullern VGS");
    assert.equal(report[0]?.title, "Sinus 1T");
    assert.equal(report[0]?.isbn, String(sinus.isbn));
    assert.equal(report[0]?.orderTime, at(0).toJSDate().toISOString());
    assert.isTrue(report[0]?.paid);
  });

  test("the Bring report splits on the mailbox product, unknown products go to the pickup file", async ({
    assert,
  }) => {
    const { branch, customer, sinus } = await seedWorld();
    for (const [name, product] of [
      ["Mottaker 1", "3584"],
      ["Mottaker 2", "SERVICEPAKKE"],
      ["Mottaker 3", null],
    ] as const) {
      const order = await createOrder({
        branchId: branch.id,
        customerId: customer.id,
        orderItems: [{ itemId: sinus.id }],
      });
      await createDelivery({ orderId: order.id, shipmentName: name, product });
    }
    stubPayments(sandbox);

    const mailbox = await OrderManagerService.bringReport({}, "postkasse");
    const pickup = await OrderManagerService.bringReport({}, "hentested");

    assert.deepEqual(
      mailbox.map((row) => row["Name *"]),
      ["Mottaker 1"],
    );
    assert.sameMembers(
      pickup.map((row) => row["Name *"]),
      ["Mottaker 2", "Mottaker 3"],
    );
    assert.equal(mailbox[0]?.["Mobile number *"], "+4791234567");
    assert.equal(mailbox[0]?.["E-mail *"], "kari@example.com");
  });

  test("Bring rows carry the Mybring headers for their parcel type", ({ assert }) => {
    const shipment = {
      name: "Kari Nordmann",
      address: "Storgata 1",
      postalCode: "0150",
      phone: "91234567",
      email: "kari@example.com",
    };

    const mailbox = toBringReportRow(shipment, "postkasse");
    assert.deepEqual(Object.keys(mailbox), [
      "Name *",
      "Address line 1 *",
      "Address line 2 *",
      "Postal code *",
      "Contact person",
      "Mobile number *",
      "E-mail *",
      "Sender's reference",
      "Recipient's reference",
      "Bag on Door (yes/no)",
    ]);
    assert.equal(mailbox["Mobile number *"], "+4791234567");
    assert.equal(mailbox["Bag on Door (yes/no)"], "no");

    const pickup = toBringReportRow({ ...shipment, phone: "+4791234567" }, "hentested");
    assert.deepEqual(Object.keys(pickup), [
      "Number of items (per shipment) *",
      "Name *",
      "Address line 1 *",
      "Address line 2 *",
      "Postal code *",
      "Contact person",
      "Mobile number (incl. country code) *",
      "E-mail *",
      "Sender's reference",
      "Recipient's reference",
    ]);
    assert.equal(pickup["Number of items (per shipment) *"], 1);
    assert.equal(pickup["Mobile number (incl. country code) *"], "+4791234567");
  });
});
