import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

test.group("OrderToCustomerItemGenerator", (group) => {
  const userDetail = mock<UserDetail>({
    id: "customer1",
    name: "Hans Hansen",
    email: "hanshansen@hansen.com",
    phone: "123456789",
    address: "hanseveien 10",
    postCode: "1234",
    postCity: "oslo",
    dob: new Date(),
    blid: "userBlid1",
    guardian: {
      name: "Lathans Hansen",
      email: "lathanshansen@hansen.com",
      phone: "123456789",
    },
  });
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "get").callsFake((id) => {
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

  test('should return customer-item type "partly-payment', async ({ assert }) => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
      handout: false,
      delivered: false,
      type: "partly-payment",
      item: "item1",
      title: "signatur",
      blid: "blid1",
      amount: 100,
      unitPrice: 100,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
        amountLeftToPay: 200,
        customerItem: "",
      },
    };

    const order: Order = {
      handoutByDelivery: false,
      id: "order1",
      amount: 100,
      orderItems: [orderItem],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      placed: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const expectedResult = [
      {
        id: null,
        item: orderItem.item,
        type: "partly-payment",
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem.info.to,
        handout: true,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem.info.amountLeftToPay,
        totalAmount: orderItem.amount,
        blid: orderItem.blid,
        viewableFor: [userDetail.blid],
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
    ];

    const result = generator.generate(order);
    assert.deepEqual(await result, expectedResult);
  });

  test('should return multiple customer-items when more than one order-item has type "partly-payment', async ({
    assert,
  }) => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
      handout: false,
      delivered: false,
      type: "partly-payment",
      item: "item1",
      title: "signatur",
      blid: "blid1",
      amount: 100,
      unitPrice: 100,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
        amountLeftToPay: 200,
        customerItem: "",
      },
    };

    const orderItem2: OrderItem = {
      handout: false,
      delivered: false,
      type: "partly-payment",
      item: "item1",
      title: "signatur",
      blid: "blid2",
      amount: 110,
      unitPrice: 110,
      info: {
        from: today,
        to: deadline,
        periodType: "year",
        numberOfPeriods: 1,
        amountLeftToPay: 210,
        customerItem: "",
      },
    };

    const order: Order = {
      handoutByDelivery: false,
      id: "order1",
      amount: 100,
      orderItems: [orderItem, orderItem2],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      placed: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const expectedResult = [
      {
        id: null,
        item: orderItem.item,
        type: "partly-payment",
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem.info.to,
        handout: true,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        blid: orderItem.blid,
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem.info.amountLeftToPay,
        totalAmount: orderItem.amount,
        viewableFor: [userDetail.blid],
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
      {
        id: null,
        item: orderItem2.item,
        type: "partly-payment",
        blid: orderItem2.blid,
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem2.info.to,
        viewableFor: [userDetail.blid],
        handout: true,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem2.info.amountLeftToPay,
        totalAmount: orderItem2.amount,
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
    ];

    const result = generator.generate(order);
    assert.deepEqual(await result, expectedResult);
  });

  test("should return empty array if no order-item shall be converted to customer-items when more than one order-item", async ({
    assert,
  }) => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
      handout: false,
      delivered: false,
      type: "extend",
      item: "item1",
      title: "signatur",
      amount: 100,
      unitPrice: 100,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
        amountLeftToPay: 200,
        customerItem: "",
      },
    };

    const orderItem2: OrderItem = {
      handout: false,
      delivered: false,
      type: "buy",
      item: "item1",
      title: "signatur",
      amount: 110,
      unitPrice: 110,
      info: {
        from: today,
        to: deadline,
        periodType: "year",
        numberOfPeriods: 1,
        amountLeftToPay: 210,
        customerItem: "",
      },
    };

    const order: Order = {
      handoutByDelivery: false,
      id: "order1",
      amount: 100,
      orderItems: [orderItem, orderItem2],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      placed: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const result = generator.generate(order);
    assert.deepEqual(await result, []);
  });

  test('should return customer-item type "rent"', async ({ assert }) => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
      handout: false,
      delivered: false,
      type: "rent",
      item: "item1",
      title: "signatur",
      blid: "blid1",
      amount: 0,
      unitPrice: 0,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
      },
    };

    const order: Order = {
      handoutByDelivery: false,
      id: "order1",
      amount: 0,
      orderItems: [orderItem],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      placed: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const expectedResult = [
      {
        id: null,
        item: orderItem.item,
        type: "rent",
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem.info.to,
        handout: true,
        viewableFor: [userDetail.blid],
        blid: orderItem.blid,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        totalAmount: orderItem.amount,
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
    ];

    const result = generator.generate(order);
    assert.deepEqual(await result, expectedResult);
  });

  test('should return multiple customer-items with type "rent"', async ({ assert }) => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
      handout: false,
      delivered: false,
      type: "rent",
      item: "item1",
      title: "signatur",
      blid: "blid1",
      amount: 0,
      unitPrice: 0,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
      },
    };

    const orderItem2: OrderItem = {
      handout: false,
      delivered: false,
      type: "rent",
      item: "item1",
      title: "signatur 2",
      blid: "blid2",
      amount: 0,
      unitPrice: 0,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
      },
    };

    const order: Order = {
      handoutByDelivery: false,
      id: "order1",
      amount: 0,
      orderItems: [orderItem, orderItem2],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      placed: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const expectedResult = [
      {
        id: null,
        item: orderItem.item,
        type: "rent",
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem.info.to,
        viewableFor: [userDetail.blid],
        blid: orderItem.blid,
        handout: true,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        totalAmount: orderItem.amount,
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
      {
        id: null,
        item: orderItem2.item,
        type: "rent",
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem2.info.to,
        viewableFor: [userDetail.blid],
        blid: orderItem2.blid,
        handout: true,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        totalAmount: orderItem2.amount,
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
    ];

    const result = generator.generate(order);
    assert.deepEqual(await result, expectedResult);
  });

  test('should return multiple customer-items with enums "rent" and "partly-payment"', async ({
    assert,
  }) => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem2: OrderItem = {
      handout: false,
      delivered: false,
      type: "rent",
      item: "item1",
      title: "signatur 2",
      blid: "blid2",
      amount: 0,
      unitPrice: 0,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
      },
    };

    const orderItem3: OrderItem = {
      handout: false,
      delivered: false,
      type: "partly-payment",
      item: "item1",
      title: "signatur 3",
      blid: "blid3",
      amount: 0,
      unitPrice: 0,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
      },
    };

    const orderItem4: OrderItem = {
      handout: false,
      delivered: false,
      type: "buy",
      item: "item1",
      title: "signatur 4",
      blid: "blid4",
      amount: 0,
      unitPrice: 0,
      info: {
        from: today,
        to: deadline,
        periodType: "semester",
        numberOfPeriods: 1,
      },
    };

    const order: Order = {
      handoutByDelivery: false,
      id: "order1",
      amount: 0,
      orderItems: [orderItem2, orderItem3, orderItem4],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      placed: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const expectedResult = [
      {
        id: null,
        item: orderItem2.item,
        type: "rent",
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem2.info.to,
        viewableFor: [userDetail.blid],
        blid: orderItem2.blid,
        handout: true,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        totalAmount: orderItem2.amount,
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
      {
        id: null,
        item: orderItem3.item,
        type: "partly-payment",
        customer: order.customer,

        // @ts-expect-error fixme: auto ignored
        deadline: orderItem3.info.to,
        viewableFor: [userDetail.blid],
        blid: orderItem3.blid,
        handout: true,
        handoutInfo: {
          handoutBy: "branch",
          handoutById: order.branch,
          handoutEmployee: order.employee,
          time: today,
        },
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem3.info.amountLeftToPay,
        totalAmount: orderItem3.amount,
        orders: [order.id],
        customerInfo: {
          name: userDetail.name,
          phone: userDetail.phone,
          address: userDetail.address,
          postCode: userDetail.postCode,
          postCity: userDetail.postCity,
          dob: userDetail.dob,
          guardian: userDetail.guardian,
        },
      },
    ];

    const result = generator.generate(order);
    assert.deepEqual(await result, expectedResult);
  });
});
