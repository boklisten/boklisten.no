import Branch from "#models/branch";
import Delivery from "#models/delivery";
import type Order from "#models/order";
import type OrderItem from "#models/order_item";
import Payment from "#models/payment";
import type User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { TranslationService } from "#services/translation_service";
import { BlError } from "#shared/bl-error";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { EmailOrder, EmailUser } from "#types/email";

export const OrderEmailHandler = {
  async sendOrderReceipt(customer: User, order: Order) {
    const branchId = order.branchId;

    const withAgreement: boolean = await this.shouldSendAgreement(order);

    const emailOrder: EmailOrder = await this.orderToEmailOrder(order);
    emailOrder.loan = withAgreement;

    const emailUser: EmailUser = {
      id: customer.id,
      dob: customer.dob?.toFormat("dd.MM.yy") ?? "",
      name: customer.name ?? "",
      email: customer.email,
      address: customer.address ?? "",
    };

    if (withAgreement) {
      const branch = await Branch.findOrFail(branchId);
      await DispatchService.sendSignatureLink(customer, branch.name);
    }

    await DispatchService.sendOrderReceipt(emailUser, emailOrder, await this.paymentNeeded(order));
  },
  async paymentNeeded(order: Order) {
    return order.amount > 0 && !(await Payment.existFor(order.id));
  },
  async orderToEmailOrder(order: Order) {
    const emailOrder: EmailOrder = {
      id: order.id,
      showDeadline: this.shouldShowDeadline(order),
      showPrice: order.amount !== 0,
      showStatus: true,
      currency: "NOK",
      itemAmount: order.amount.toString(),
      totalAmount: order.amount.toString(), // should include the totalAmount including the delivery amount
      items: this.orderItemsToEmailItems(order.orderItems),
      showDelivery: false,
      // @ts-expect-error fixme: auto ignored
      delivery: null,
      showPayment: false,
      // @ts-expect-error fixme: auto ignored
      payment: null,
    };

    let emailOrderDelivery: { showDelivery: boolean; delivery: any };
    let emailOrderPayment: { showPayment: boolean; payment: any };

    try {
      emailOrderDelivery = await this.extractEmailOrderDeliveryFromOrder(order);
      emailOrderPayment = await this.extractEmailOrderPaymentFromOrder(order);
    } catch (error) {
      throw new BlError(`could not create email based on order${String(error)}`);
    }

    emailOrder.showDelivery = emailOrderDelivery.showDelivery;
    emailOrder.delivery = emailOrderDelivery.delivery;

    if (emailOrder.delivery) {
      emailOrder.totalAmount = order.amount + emailOrderDelivery.delivery["amount"];
    }

    emailOrder.showPayment = emailOrderPayment.showPayment;
    emailOrder.payment = emailOrderPayment.payment;

    return emailOrder;
  },

  shouldShowDeadline(order: Order) {
    return order.orderItems.some(
      (orderItem) => orderItem.type === "rent" || orderItem.type === "extend",
    );
  },

  async extractEmailOrderPaymentFromOrder(
    order: Order,
  ): Promise<{ payment: unknown; showPayment: boolean }> {
    const payments = await Payment.ofOrder(order.id);
    if (payments.length === 0) {
      return { payment: null, showPayment: false };
    }
    return {
      payment: {
        total: payments.reduce((subTotal, payment) => subTotal + payment.amount, 0),
        currency: "NOK",
        payments: payments.map((payment) => this.paymentToEmailPayment(payment)),
      },
      showPayment: true,
    };
  },

  async extractEmailOrderDeliveryFromOrder(order: Order) {
    const delivery = await Delivery.ofOrder(order.id);
    return delivery?.method === "bring"
      ? {
          delivery: this.deliveryToEmailDelivery(delivery),
          showDelivery: true,
        }
      : { delivery: null, showDelivery: false };
  },

  paymentToEmailPayment(payment: Payment) {
    return {
      method: payment.method,
      amount: payment.amount === 0 ? "" : payment.amount.toString(),
      cardInfo: null,
      paymentId: payment.id,
      status: "bekreftet",
      creationTime: payment.createdAt.toFormat("dd.MM.yyyy HH.mm.ss"),
    };
  },

  deliveryToEmailDelivery(delivery: Delivery) {
    return {
      method: delivery.method,
      currency: "NOK",
      amount: delivery.amount,
      address: `${delivery.shipmentName}, ${delivery.shipmentAddress}, ${delivery.shipmentPostalCode} ${delivery.shipmentPostalCity}`,
      trackingNumber: delivery.trackingNumber ?? undefined,
      estimatedDeliveryDate: delivery.estimatedDelivery?.toFormat("dd.MM.yy") ?? "",
    };
  },

  orderItemsToEmailItems(orderItems: OrderItem[]): {
    title: string;
    status: string;
    deadline: string | null;
    price: string | null;
  }[] {
    return orderItems.map((orderItem) => ({
      title: orderItem.title,
      status: this.translateOrderItemType(orderItem.type, orderItem.handout),
      deadline:
        (orderItem.type === "rent" || orderItem.type === "extend") && orderItem.periodTo
          ? orderItem.periodTo.toFormat("dd.MM.yy")
          : null,
      price: orderItem.type !== "return" && orderItem.amount ? orderItem.amount.toString() : null,
    }));
  },

  translateOrderItemType(orderItemType: OrderItemType, handout?: boolean): string {
    return `${TranslationService.translateOrderItemTypePastTense(orderItemType)}${
      handout && orderItemType !== "return" ? " - utlevert" : ""
    }`;
  },

  async shouldSendAgreement(order: Order): Promise<boolean> {
    const onlyHandout = order.orderItems[0]?.handout;
    const rentFound = order.orderItems.some((orderItem) => orderItem.type === "rent");

    if (onlyHandout) {
      return false;
    }

    if (!rentFound) {
      return false;
    }

    return true;
  },
};
