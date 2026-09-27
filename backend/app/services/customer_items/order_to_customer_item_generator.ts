import type Order from "#models/order";
import type OrderItem from "#models/order_item";
import User from "#models/user";
import type { CustomerItem } from "#shared/customer-item/customer-item";

export class OrderToCustomerItemGenerator {
  /**
   * The customer items the order's loans hand out. `orderItems` narrows the lines considered
   * (default: all of the order's lines).
   */
  public async generate(
    order: Order,
    orderItems: OrderItem[] = order.orderItems,
  ): Promise<CustomerItem[]> {
    const customerItems = [];

    if (!order.customerId) {
      return [];
    }

    const customerDetail = await User.findOrFail(order.customerId);

    for (const orderItem of orderItems) {
      if (this.shouldCreateCustomerItem(orderItem)) {
        const customerItem = this.convertOrderItemToCustomerItem(customerDetail, order, orderItem);
        customerItems.push(customerItem);
      }
    }

    return customerItems;
  }

  private shouldCreateCustomerItem(orderItem: OrderItem) {
    return (
      orderItem.type === "partly-payment" ||
      orderItem.type === "rent" ||
      orderItem.type === "match-receive"
    );
  }

  private convertOrderItemToCustomerItem(
    customerDetail: User,
    order: Order,
    orderItem: OrderItem,
  ): CustomerItem {
    switch (orderItem.type) {
      case "partly-payment": {
        return this.createPartlyPaymentCustomerItem(customerDetail, order, orderItem);
      }
      case "rent":
      case "match-receive": {
        return this.createRentCustomerItem(customerDetail, order, orderItem);
      }
      // No default
    }

    throw new Error(`orderItem type "${orderItem.type}" is not supported`);
  }

  private createPartlyPaymentCustomerItem(
    customerDetail: User,
    order: Order,
    orderItem: OrderItem,
  ): CustomerItem {
    return {
      // @ts-expect-error fixme: auto ignored
      id: null,
      type: "partly-payment",
      item: orderItem.itemId,
      blid: orderItem.blid ?? undefined,
      customer: customerDetail.id,
      // @ts-expect-error fixme: auto ignored
      deadline: orderItem.periodTo?.toJSDate(),
      handout: true,
      handoutInfo: this.createHandoutInfo(order),
      returned: false,
      buyout: false,
      cancel: false,
      buyback: false,
      amountLeftToPay: orderItem.amountLeftToPay ?? undefined,
      orders: [order.id],
      customerInfo: this.createCustomerInfo(customerDetail),
    };
  }

  private createRentCustomerItem(
    customerDetail: User,
    order: Order,
    orderItem: OrderItem,
  ): CustomerItem {
    return {
      // @ts-expect-error fixme: auto ignored
      id: null,
      type: "rent",
      item: orderItem.itemId,
      blid: orderItem.blid ?? undefined,
      customer: customerDetail.id,
      // @ts-expect-error fixme: auto ignored
      deadline: orderItem.periodTo?.toJSDate(),
      handout: true,
      handoutInfo: this.createHandoutInfo(order),
      returned: false,
      buyout: false,
      cancel: false,
      buyback: false,
      orders: [order.id],
      customerInfo: this.createCustomerInfo(customerDetail),
    };
  }

  private createHandoutInfo(order: Order) {
    return {
      handoutById: order.branchId,
      handoutEmployee: order.employeeId ?? undefined,
      time: order.createdAt.toJSDate(),
    };
  }

  private createCustomerInfo(customerDetail: User) {
    return {
      name: customerDetail.name,
      phone: customerDetail.phone ?? "",
      address: customerDetail.address,
      postCode: customerDetail.postCode,
      postCity: customerDetail.postCity,
      dob: customerDetail.dob?.toJSDate(),
      guardian: {
        name: customerDetail.guardianName ?? "",
        email: customerDetail.guardianEmail ?? "",
        phone: customerDetail.guardianPhone ?? "",
      },
    };
  }
}
