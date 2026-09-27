import CustomerItem from "#models/customer_item";
import type Order from "#models/order";
import type OrderItem from "#models/order_item";

type CustomerItemColumns = Pick<CustomerItem, (typeof CustomerItem.$columns)[number]>;

/** The columns a customer item is created with; the rest take their defaults. */
export type NewCustomerItem = Pick<
  CustomerItemColumns,
  | "type"
  | "itemId"
  | "blid"
  | "customerId"
  | "deadline"
  | "handoutBranchId"
  | "handoutEmployeeId"
  | "handedOutAt"
  | "amountLeftToPay"
>;

export class OrderToCustomerItemGenerator {
  /**
   * The customer items the order's loans hand out, each with the line it comes from.
   * `orderItems` narrows the lines considered (default: all of the order's lines).
   */
  public generate(
    order: Order,
    orderItems: OrderItem[] = order.orderItems,
  ): { orderItem: OrderItem; customerItem: NewCustomerItem }[] {
    const { customerId } = order;
    if (!customerId) {
      return [];
    }
    return orderItems.filter(createsCustomerItem).map((orderItem) => {
      if (!orderItem.periodTo) {
        throw new Error(`order item ${orderItem.id} of type ${orderItem.type} has no deadline`);
      }
      return {
        orderItem,
        customerItem: {
          type: orderItem.type === "partly-payment" ? "partly-payment" : "rent",
          itemId: orderItem.itemId,
          blid: orderItem.blid,
          customerId,
          deadline: orderItem.periodTo,
          handoutBranchId: order.branchId,
          handoutEmployeeId: order.employeeId,
          handedOutAt: order.createdAt,
          amountLeftToPay: orderItem.type === "partly-payment" ? orderItem.amountLeftToPay : null,
        },
      };
    });
  }

  /**
   * Creates the customer items the order's loans hand out and points each line at its customer
   * item. The caller persists the lines (`order.saveWithItems()`).
   */
  public async createFor(
    order: Order,
    orderItems: OrderItem[] = order.orderItems,
  ): Promise<CustomerItem[]> {
    const created: CustomerItem[] = [];
    for (const { orderItem, customerItem } of this.generate(order, orderItems)) {
      const row = await CustomerItem.create(customerItem);
      orderItem.customerItemId = row.id;
      created.push(row);
    }
    return created;
  }
}

function createsCustomerItem(orderItem: OrderItem): boolean {
  return (
    orderItem.type === "partly-payment" ||
    orderItem.type === "rent" ||
    orderItem.type === "match-receive"
  );
}
