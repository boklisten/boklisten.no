import Order from "#models/order";
import type OrderItem from "#models/order_item";
import { APP_CONFIG } from "#services/application_config";
import { OrderPayments } from "#services/payments/order_payments";
import { PriceService } from "#services/price_service";
import { BlError } from "#shared/bl-error";
import type { Branch, RentPeriod } from "#shared/branch";
import { itemsAreEquivalent } from "#shared/item-equivalence";
import type { Period } from "#shared/period";

export class OrderItemRentPeriodValidator {
  private readonly priceService = new PriceService(APP_CONFIG.payment.paymentServiceConfig);

  public async validate(
    orderItem: OrderItem,
    branch: Pick<Branch, "paymentResponsible" | "rentPeriods">,
    itemPrice: number,
  ): Promise<boolean> {
    if (orderItem.type !== "rent") {
      throw new BlError('orderItem.type is not "rent" when validating rent period');
    }

    if (branch.paymentResponsible) {
      if (orderItem.amount !== 0 || orderItem.unitPrice !== 0) {
        throw new BlError("amounts where set on orderItem when branch is responsible");
      }

      return true;
    }

    const branchPaymentPeriod = this.getRentPeriodFromBranch(orderItem.periodType, branch);

    if (orderItem.movedFromOrderId !== null) {
      return this.validateIfMovedFromOrder(orderItem, branchPaymentPeriod, itemPrice);
    }

    this.validateOrderItemPrice(orderItem, branchPaymentPeriod, itemPrice);

    return true;
  }

  private validateOrderItemPrice(
    orderItem: OrderItem,
    branchPaymentPeriod: RentPeriod,
    itemPrice: number,
  ) {
    const expectedAmount = this.priceService.sanitize(
      this.priceService.round(itemPrice * branchPaymentPeriod.percentage),
    );

    if (expectedAmount !== orderItem.amount) {
      throw new BlError(
        `orderItem.amount "${orderItem.amount}" is not equal to itemPrice "${itemPrice}" * percentage "${branchPaymentPeriod.percentage}" "${expectedAmount}"`,
      );
    }
  }

  private getRentPeriodFromBranch(
    period: Period | null,
    branch: Pick<Branch, "rentPeriods">,
  ): RentPeriod {
    for (const rentPeriod of branch.rentPeriods) {
      if (period === rentPeriod.type) {
        return rentPeriod;
      }
    }

    throw new BlError(`rent period "${period}" is not valid on branch`);
  }

  private async validateIfMovedFromOrder(
    orderItem: OrderItem,
    branchRentPeriod: RentPeriod,
    itemPrice: number,
  ): Promise<boolean> {
    if (orderItem.movedFromOrderId === null) {
      return true;
    }

    const order = await Order.getOrFail(orderItem.movedFromOrderId);
    const isPaid = await OrderPayments.exist(order.id);
    if (!isPaid && orderItem.amount === 0) {
      throw new BlError(
        'the original order has not been payed, but current orderItem.amount is "0"',
      );
    }

    if (isPaid) {
      const movedFromOrderItem = this.getOrderItemFromOrder(orderItem.itemId, order);

      if (movedFromOrderItem.periodType === orderItem.periodType) {
        if (movedFromOrderItem.amount > 0 && orderItem.amount !== 0) {
          throw new BlError(
            `the original order has been payed, but current orderItem.amount is "${orderItem.amount}"`,
          );
        }
      } else {
        // the periodType is changed after the original placed order
        const expectedOrderItemAmount =
          this.priceService.round(
            this.priceService.sanitize(itemPrice * branchRentPeriod.percentage),
          ) - movedFromOrderItem.amount;

        if (orderItem.amount !== expectedOrderItemAmount) {
          throw new BlError(
            `orderItem amount is "${orderItem.amount}" but should be "${expectedOrderItemAmount}" since the old orderItem.amount was "${movedFromOrderItem.amount}"`,
          );
        }
      }
    }
    return true;
  }

  private getOrderItemFromOrder(itemId: string, order: Order): OrderItem {
    const exact = order.orderItems.find((orderItem) => orderItem.itemId === itemId);
    // A moved order item may carry an equivalent edition of the originally ordered item.
    const equivalent = order.orderItems.find((orderItem) =>
      itemsAreEquivalent(orderItem.itemId, itemId),
    );
    const found = exact ?? equivalent;
    if (!found) {
      throw new BlError("not found in original orderItem");
    }
    return found;
  }
}
