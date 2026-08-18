import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";
import { OrderItem } from "#shared/order/order-item/order-item";
import { UserDetail } from "#shared/user-detail";

chaiUse(chaiAsPromised);
should();

test.group("OrderToCustomerItemGenerator", (group) => {
  const userDetail = {
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
  } as UserDetail;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "get").callsFake((id) => {
      if (id === userDetail.id) {
        return new Promise((resolve) => resolve(userDetail));
      } else {
        throw new BlError("not found").code(702);
      }
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });
  const generator = new OrderToCustomerItemGenerator();

  test('should return customer-item type "partly-payment', async () => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
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
      id: "order1",
      amount: 100,
      orderItems: [orderItem],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
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
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem["info"]["amountLeftToPay"],
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
    return expect(result).to.eventually.be.eql(expectedResult);
  });

  test('should return multiple customer-items when more than one order-item has type "partly-payment', async () => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
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
      id: "order1",
      amount: 100,
      orderItems: [orderItem, orderItem2],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
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
        blid: orderItem.blid,
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem["info"]["amountLeftToPay"],
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
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem2["info"]["amountLeftToPay"],
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
    return expect(result).to.eventually.be.eql(expectedResult);
  });

  test("should return empty array if no order-item shall be converted to customer-items when more than one order-item", async () => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
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
      id: "order1",
      amount: 100,
      orderItems: [orderItem, orderItem2],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const result = generator.generate(order);
    return expect(result).to.eventually.be.eql([]);
  });

  test('should return customer-item type "rent"', async () => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
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
      id: "order1",
      amount: 0,
      orderItems: [orderItem],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
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
    return expect(result).to.eventually.be.eql(expectedResult);
  });

  test('should return multiple customer-items with type "rent"', async () => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
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
      id: "order1",
      amount: 0,
      orderItems: [orderItem, orderItem2],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
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
    return expect(result).to.eventually.be.eql(expectedResult);
  });

  test('should return multiple customer-items with type "loan"', async () => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
      type: "loan",
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
      type: "loan",
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
      id: "order1",
      amount: 0,
      orderItems: [orderItem, orderItem2],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const expectedResult = [
      {
        id: null,
        item: orderItem.item,
        type: "loan",
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
        type: "loan",
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
    return expect(result).to.eventually.be.eql(expectedResult);
  });

  test('should return multiple customer-items with enums "loan", "rent" and "partly-payment"', async () => {
    const deadline = new Date(2100, 1, 1);
    const today = new Date();

    const orderItem: OrderItem = {
      type: "loan",
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
      id: "order1",
      amount: 0,
      orderItems: [orderItem, orderItem2, orderItem3, orderItem4],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      employee: "employee1",
      payments: [],
      delivery: "delivery1",
      creationTime: today,
    };

    const expectedResult = [
      {
        id: null,
        item: orderItem.item,
        type: "loan",
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
        // @ts-expect-error fixme: auto ignored
        amountLeftToPay: orderItem3["info"]["amountLeftToPay"],
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
    return expect(result).to.eventually.be.eql(expectedResult);
  });
});
