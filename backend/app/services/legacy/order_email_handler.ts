import DispatchService from "#services/dispatch_service";
import { DateService } from "#services/legacy/date.service";
import { StorageService } from "#services/storage_service";
import { TranslationService } from "#services/translation_service";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import type { Payment } from "#shared/payment/payment";
import type { UserDetail } from "#shared/user-detail";
import type { EmailOrder, EmailUser } from "#types/email";

export const OrderEmailHandler = {
  async sendOrderReceipt(customerDetail: UserDetail, order: Order) {
    const branchId = order.branch;

    const withAgreement: boolean = await this.shouldSendAgreement(order);

    const emailOrder: EmailOrder = await this.orderToEmailOrder(order);
    emailOrder.loan = withAgreement;

    const emailUser: EmailUser = {
      id: customerDetail.id,
      dob: customerDetail.dob ? DateService.toPrintFormat(customerDetail.dob, "Europe/Oslo") : "",
      name: customerDetail.name,
      email: customerDetail.email,
      address: customerDetail.address,
    };

    if (withAgreement) {
      const branch = await StorageService.Branches.get(branchId);
      await DispatchService.sendSignatureLink(customerDetail, branch?.name ?? "en filial");
    }

    await DispatchService.sendOrderReceipt(emailUser, emailOrder, this.paymentNeeded(order));
  },
  paymentNeeded(order: Order) {
    return order.amount > 0 && order.payments.length === 0;
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

  extractEmailOrderPaymentFromOrder(
    order: Order,
  ): Promise<{ payment: unknown; showPayment: boolean }> {
    if (order.payments.length === 0) {
      return Promise.resolve({ payment: null, showPayment: false });
    }

    const paymentPromises: Promise<Payment>[] = order.payments.map((payment) =>
      StorageService.Payments.get(payment),
    );

    return Promise.all(paymentPromises)
      .then((payments: Payment[]) => {
        const emailPayment = {
          total: payments.reduce((subTotal, payment) => subTotal + payment.amount, 0),
          currency: "NOK",
          payments: payments.map((payment) => this.paymentToEmailPayment(payment)),
        };

        if (
          emailPayment.payments[0] &&
          // @ts-expect-error fixme: auto ignored
          emailPayment.payments[0]["info"] &&
          // @ts-expect-error fixme: auto ignored
          emailPayment.payments[0]["info"]["orderDetails"]
        ) {
          emailPayment.currency =
            // @ts-expect-error fixme: auto ignored
            emailPayment.payments[0]["info"]["orderDetails"].currency;
        }

        return { payment: emailPayment, showPayment: true };
      })
      .catch((getPaymentsError) => {
        throw getPaymentsError;
      });
  },

  async extractEmailOrderDeliveryFromOrder(order: Order) {
    const deliveryId = order.delivery;
    if (!deliveryId?.length) {
      return { delivery: null, showDelivery: false };
    }
    const delivery = await StorageService.Deliveries.get(deliveryId);
    return delivery.method === "bring"
      ? {
          delivery: this.deliveryToEmailDelivery(delivery),
          showDelivery: true,
        }
      : { delivery: null, showDelivery: false };
  },

  paymentToEmailPayment(payment: Payment) {
    if (!payment) {
      return null;
    }

    const paymentObject = {
      method: "",
      amount: "",
      cardInfo: null,
      paymentId: "",
      status: "bekreftet",
      creationTime: payment.creationTime
        ? DateService.format(payment.creationTime, "Europe/Oslo", "DD.MM.YYYY HH.mm.ss")
        : null,
    };

    if (payment.method) {
      paymentObject.method = payment.method;
    }

    if (payment.amount) {
      paymentObject.amount = payment.amount.toString();
    }

    if (payment.id) {
      paymentObject.paymentId = payment.id;
    }

    return paymentObject;
  },

  deliveryToEmailDelivery(delivery: Delivery) {
    return {
      method: delivery.method,
      currency: "NOK",
      amount: delivery.amount,

      // @ts-expect-error fixme: auto ignored
      address: delivery.info["shipmentAddress"]
        ? // @ts-expect-error fixme: auto ignored
          `${delivery.info["shipmentAddress"].name}, ${delivery.info["shipmentAddress"].address}, ${delivery.info["shipmentAddress"].postalCode} ${delivery.info["shipmentAddress"].postalCity}`
        : null,

      // @ts-expect-error fixme: auto ignored
      trackingNumber: delivery.info["trackingNumber"],

      // @ts-expect-error fixme: auto ignored
      estimatedDeliveryDate: delivery.info["estimatedDelivery"]
        ? DateService.toPrintFormat(
            // @ts-expect-error fixme: auto ignored
            delivery.info["estimatedDelivery"],
            "Europe/Oslo",
          )
        : "",
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
        orderItem.type === "rent" || orderItem.type === "extend"
          ? DateService.toPrintFormat(orderItem.info?.to ?? "", "Europe/Oslo")
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
