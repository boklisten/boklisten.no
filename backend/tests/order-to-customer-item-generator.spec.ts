import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import { OrderToCustomerItemGenerator } from "#services/customer_items/order_to_customer_item_generator";
import type Order from "#models/order";
import type OrderItem from "#models/order_item";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { mock } from "#tests/test-doubles";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("OrderToCustomerItemGenerator.generate", () => {
  const deadline = DateTime.fromObject({ year: 2100, month: 2, day: 1 });
  const today = DateTime.now();
  const generator = new OrderToCustomerItemGenerator();

  function orderItem(
    type: OrderItemType,
    blid: string | null,
    extra: Partial<Pick<OrderItem, "amountLeftToPay" | "periodType">> = {},
  ): OrderItem {
    return mock<OrderItem>({
      handout: false,
      delivered: false,
      type,
      itemId: "item1",
      blid,
      amount: 100,
      unitPrice: 100,
      periodFrom: today,
      periodTo: deadline,
      periodType: "semester",
      numberOfPeriods: 1,
      amountLeftToPay: null,
      ...extra,
    });
  }

  function orderWith(orderItems: OrderItem[], customerId: string | null = "customer1"): Order {
    return mock<Order>({
      id: "order1",
      amount: 100,
      orderItems,
      branchId: "branch1",
      customerId,
      byCustomer: false,
      placed: false,
      employeeId: "employee1",
      createdAt: today,
    });
  }

  /** The customer item the generator makes for a handed-out line of `orderWith`. */
  function expected(line: OrderItem) {
    return {
      orderItem: line,
      customerItem: {
        type: line.type === "partly-payment" ? "partly-payment" : "rent",
        itemId: line.itemId,
        blid: line.blid,
        customerId: "customer1",
        deadline,
        handoutBranchId: "branch1",
        handoutEmployeeId: "employee1",
        handedOutAt: today,
        amountLeftToPay: line.type === "partly-payment" ? line.amountLeftToPay : null,
      },
    };
  }

  test('should return customer-item type "partly-payment', ({ assert }) => {
    const line = orderItem("partly-payment", "blid1", { amountLeftToPay: 200 });

    assert.deepEqual(generator.generate(orderWith([line])), [expected(line)]);
  });

  test('should return multiple customer-items when more than one order-item has type "partly-payment', ({
    assert,
  }) => {
    const line = orderItem("partly-payment", "blid1", { amountLeftToPay: 200 });
    const line2 = orderItem("partly-payment", "blid2", {
      amountLeftToPay: 210,
      periodType: "year",
    });

    assert.deepEqual(generator.generate(orderWith([line, line2])), [
      expected(line),
      expected(line2),
    ]);
  });

  test("should return empty array if no order-item shall be converted to customer-items when more than one order-item", ({
    assert,
  }) => {
    const order = orderWith([orderItem("extend", null), orderItem("buy", null)]);

    assert.deepEqual(generator.generate(order), []);
  });

  test('should return customer-item type "rent", for rentals and match handouts alike', ({
    assert,
  }) => {
    const line = orderItem("rent", "blid1");
    const line2 = orderItem("match-receive", "blid2");

    assert.deepEqual(generator.generate(orderWith([line, line2])), [
      expected(line),
      expected(line2),
    ]);
  });

  test('should return multiple customer-items with enums "rent" and "partly-payment"', ({
    assert,
  }) => {
    const line2 = orderItem("rent", "blid2");
    const line3 = orderItem("partly-payment", "blid3");
    const line4 = orderItem("buy", "blid4");

    assert.deepEqual(generator.generate(orderWith([line2, line3, line4])), [
      expected(line2),
      expected(line3),
    ]);
  });

  test("considers only the given order items when they are passed", ({ assert }) => {
    const line = orderItem("rent", "blid1");
    const line2 = orderItem("rent", "blid2");

    assert.deepEqual(generator.generate(orderWith([line, line2]), [line2]), [expected(line2)]);
  });

  test("an order without a customer hands out nothing", ({ assert }) => {
    assert.deepEqual(generator.generate(orderWith([orderItem("rent", "blid1")], null)), []);
  });
});

test.group("OrderToCustomerItemGenerator.createFor", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("creates the customer items and points each loan line at its own", async ({ assert }) => {
    const [branch, item, customer] = await Promise.all([
      createBranch(),
      createItem(),
      createUser(),
    ]);
    await createUniqueItem({ blid: "blid0001", itemId: item.id });
    await createUniqueItem({ blid: "blid0002", itemId: item.id });
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [
        { itemId: item.id, type: "rent", blid: "blid0001", periodTo: DateTime.now() },
        { itemId: item.id, type: "return" },
        { itemId: item.id, type: "rent", blid: "blid0002", periodTo: DateTime.now() },
      ],
    });

    const created = await new OrderToCustomerItemGenerator().createFor(order);

    assert.lengthOf(created, 2);
    assert.deepEqual(
      order.orderItems.map((line) => line.customerItemId),
      [created[0]?.id, null, created[1]?.id],
    );
    assert.deepEqual(
      (await CustomerItem.query().orderBy("blid")).map((customerItem) => customerItem.blid),
      ["blid0001", "blid0002"],
    );
  });
});
