import { StorageService } from "#services/storage_service";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { Order } from "#shared/order/order";
import { OrderItem } from "#shared/order/order-item/order-item";
import { UserDetail } from "#shared/user-detail";

export class OrderToCustomerItemGenerator {
  public async generate(order: Order): Promise<CustomerItem[]> {
    const customerItems = [];

    if (!order.customer) {
      return [];
    }

    const customerDetail = await StorageService.UserDetails.get(order.customer);

    for (const orderItem of order.orderItems) {
      if (this.shouldCreateCustomerItem(orderItem)) {
        const customerItem = this.convertOrderItemToCustomerItem(customerDetail, order, orderItem);
        customerItem.viewableFor = [customerDetail?.blid ?? ""];
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
    customerDetail: UserDetail,
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
    customerDetail: UserDetail,
    order: Order,
    orderItem: OrderItem,
  ): CustomerItem {
    return {
      // @ts-expect-error fixme: auto ignored
      id: null,
      type: "partly-payment",
      item: orderItem.item,
      blid: orderItem.blid,
      customer: order.customer,
      // @ts-expect-error fixme: auto ignored
      deadline: orderItem.info.to,
      handout: true,

      // @ts-expect-error fixme: auto ignored
      handoutInfo: this.createHandoutInfo(order),
      returned: false,
      // @ts-expect-error fixme: auto ignored
      amountLeftToPay: orderItem["info"]["amountLeftToPay"],
      totalAmount: orderItem.amount,
      orders: [order.id],
      customerInfo: this.createCustomerInfo(customerDetail),
    };
  }

  private createRentCustomerItem(
    customerDetail: UserDetail,
    order: Order,
    orderItem: OrderItem,
  ): CustomerItem {
    return {
      // @ts-expect-error fixme: auto ignored
      id: null,
      type: "rent",
      item: orderItem.item,
      blid: orderItem.blid,
      customer: order.customer,
      // @ts-expect-error fixme: auto ignored
      deadline: orderItem.info.to,
      handout: true,

      // @ts-expect-error fixme: auto ignored
      handoutInfo: this.createHandoutInfo(order),
      returned: false,
      totalAmount: orderItem.amount,
      orders: [order.id],
      customerInfo: this.createCustomerInfo(customerDetail),
    };
  }

  private createHandoutInfo(order: Order) {
    return {
      handoutBy: "branch",
      handoutById: order.branch,
      handoutEmployee: order.employee,
      time: order.creationTime,
    };
  }

  private createCustomerInfo(customerDetail: UserDetail) {
    return {
      name: customerDetail.name,
      phone: customerDetail.phone,
      address: customerDetail.address,
      postCode: customerDetail.postCode,
      postCity: customerDetail.postCity,
      dob: customerDetail.dob,
      guardian: customerDetail.guardian,
    };
  }
}
