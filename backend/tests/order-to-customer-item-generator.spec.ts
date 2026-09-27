import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderToCustomerItemGenerator } from "#services/customer_items/order_to_customer_item_generator";
import type Order from "#models/order";
import type OrderItem from "#models/order_item";
import User from "#models/user";
import { BlError } from "#shared/bl-error";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import { mock } from "#tests/test-doubles";
import { userDouble } from "#tests/user_fixtures";

test.group("OrderToCustomerItemGenerator", (group) => {
  const userDetail = userDouble({
    id: "customer1",
    name: "Hans Hansen",
    email: "hanshansen@hansen.com",
    phone: "12345678",
    address: "hanseveien 10",
    postCode: "1234",
    postCity: "oslo",
    dob: DateTime.fromISO("2008-03-04"),
    guardianName: "Lathans Hansen",
    guardianEmail: "lathanshansen@hansen.com",
    guardianPhone: "12345678",
  });
  /** The snapshot of the customer that a customer item carries. */
  const customerInfo = {
    name: userDetail.name,
    phone: userDetail.phone ?? "",
    address: userDetail.address,
    postCode: userDetail.postCode,
    postCity: userDetail.postCity,
    dob: userDetail.dob?.toJSDate(),
    guardian: {
      name: userDetail.guardianName ?? "",
      email: userDetail.guardianEmail ?? "",
      phone: userDetail.guardianPhone ?? "",
    },
  };
  const deadline = DateTime.fromObject({ year: 2100, month: 2, day: 1 });
  const today = DateTime.now();
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(User, "findOrFail").callsFake((id) => {
      if (id === userDetail.id) {
        return Promise.resolve(userDetail);
      }
      throw new BlError("not found").code(702);
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });
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

  function orderWith(orderItems: OrderItem[]): Order {
    return mock<Order>({
      id: "order1",
      amount: 100,
      orderItems,
      branchId: "branch1",
      customerId: "customer1",
      byCustomer: false,
      placed: false,
      employeeId: "employee1",
      deliveryId: "delivery1",
      createdAt: today,
    });
  }

  /** The customer item the generator makes for a handed-out line of `orderWith`. */
  function expectedCustomerItem(line: OrderItem) {
    return {
      id: null,
      item: line.itemId,
      type: line.type,
      customer: "customer1",
      deadline: deadline.toJSDate(),
      handout: true,
      handoutInfo: {
        handoutById: "branch1",
        handoutEmployee: "employee1",
        time: today.toJSDate(),
      },
      returned: false,
      buyout: false,
      cancel: false,
      buyback: false,
      ...(line.type === "partly-payment"
        ? { amountLeftToPay: line.amountLeftToPay ?? undefined }
        : {}),
      blid: line.blid ?? undefined,
      orders: ["order1"],
      customerInfo,
    };
  }

  test('should return customer-item type "partly-payment', async ({ assert }) => {
    const line = orderItem("partly-payment", "blid1", { amountLeftToPay: 200 });

    assert.deepEqual(await generator.generate(orderWith([line])), [expectedCustomerItem(line)]);
  });

  test('should return multiple customer-items when more than one order-item has type "partly-payment', async ({
    assert,
  }) => {
    const line = orderItem("partly-payment", "blid1", { amountLeftToPay: 200 });
    const line2 = orderItem("partly-payment", "blid2", {
      amountLeftToPay: 210,
      periodType: "year",
    });

    assert.deepEqual(await generator.generate(orderWith([line, line2])), [
      expectedCustomerItem(line),
      expectedCustomerItem(line2),
    ]);
  });

  test("should return empty array if no order-item shall be converted to customer-items when more than one order-item", async ({
    assert,
  }) => {
    const order = orderWith([orderItem("extend", null), orderItem("buy", null)]);

    assert.deepEqual(await generator.generate(order), []);
  });

  test('should return customer-item type "rent"', async ({ assert }) => {
    const line = orderItem("rent", "blid1");

    assert.deepEqual(await generator.generate(orderWith([line])), [expectedCustomerItem(line)]);
  });

  test('should return multiple customer-items with type "rent"', async ({ assert }) => {
    const line = orderItem("rent", "blid1");
    const line2 = orderItem("rent", "blid2");

    assert.deepEqual(await generator.generate(orderWith([line, line2])), [
      expectedCustomerItem(line),
      expectedCustomerItem(line2),
    ]);
  });

  test('should return multiple customer-items with enums "rent" and "partly-payment"', async ({
    assert,
  }) => {
    const line2 = orderItem("rent", "blid2");
    const line3 = orderItem("partly-payment", "blid3");
    const line4 = orderItem("buy", "blid4");

    assert.deepEqual(await generator.generate(orderWith([line2, line3, line4])), [
      expectedCustomerItem(line2),
      expectedCustomerItem(line3),
    ]);
  });

  test("considers only the given order items when they are passed", async ({ assert }) => {
    const line = orderItem("rent", "blid1");
    const line2 = orderItem("rent", "blid2");

    assert.deepEqual(await generator.generate(orderWith([line, line2]), [line2]), [
      expectedCustomerItem(line2),
    ]);
  });
});
