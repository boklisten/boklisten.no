import { OrderFieldValidator } from "#services/legacy/collections/order/helpers/order-validator/order-field-validator/order-field-validator";
import { OrderItemBuyValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-buy-validator/order-item-buy-validator";
import { OrderItemExtendValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-extend-validator/order-item-extend-validator";
import { OrderItemPartlyPaymentValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-partly-payment-validator/order-item-partly-payment-validator";
import { OrderItemRentValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-rent-validator/order-item-rent-validator";
import { PriceService } from "#services/legacy/price.service";
import { isNotNullish } from "#services/legacy/typescript-helpers";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";

export class OrderItemValidator {
  private readonly orderItemFieldValidator: OrderFieldValidator;
  private readonly orderItemExtendValidator: OrderItemExtendValidator;
  private readonly orderItemBuyValidator: OrderItemBuyValidator;
  private readonly orderItemRentValidator: OrderItemRentValidator;
  private readonly orderItemPartlyPaymentValidator: OrderItemPartlyPaymentValidator;
  private readonly priceService: PriceService;

  constructor(
    orderItemFieldValidator?: OrderFieldValidator,
    orderItemRentValidator?: OrderItemRentValidator,
    orderItemBuyValidator?: OrderItemBuyValidator,
    orderItemExtendValidator?: OrderItemExtendValidator,
    orderItemPartlyPaymentValidator?: OrderItemPartlyPaymentValidator,
  ) {
    this.orderItemFieldValidator = orderItemFieldValidator ?? new OrderFieldValidator();
    this.orderItemRentValidator = orderItemRentValidator ?? new OrderItemRentValidator();
    this.orderItemBuyValidator = orderItemBuyValidator ?? new OrderItemBuyValidator();
    this.orderItemExtendValidator = orderItemExtendValidator ?? new OrderItemExtendValidator();
    this.priceService = new PriceService({ roundDown: true });
    this.orderItemPartlyPaymentValidator =
      orderItemPartlyPaymentValidator ?? new OrderItemPartlyPaymentValidator();
  }

  public async validate(branch: Branch, order: Order, isAdmin: boolean): Promise<boolean> {
    try {
      if (!isAdmin) {
        this.validateDeadlines(order.orderItems ?? []);
      }
      await this.orderItemFieldValidator.validate(order);
      this.assertNoDuplicateOrderItems(order.orderItems);
      this.validateAmount(order);

      for (const orderItem of order.orderItems) {
        const item = await StorageService.Items.get(orderItem.item);
        await this.validateOrderItemBasedOnType(branch, item, orderItem);
        this.validateOrderItemAmounts(orderItem);
      }
    } catch (error) {
      if (error instanceof BlError) {
        throw error;
      }
      throw new BlError("unknown error, orderItem could not be validated").store("error", error);
    }

    // @ts-expect-error fixme: auto ignored
    return undefined;
  }

  private assertNoDuplicateOrderItems(orderItems: OrderItem[]): void {
    const blids = orderItems
      .filter(
        (orderItem) =>
          isNotNullish(orderItem.blid) && ["partly-payment", "rent"].includes(orderItem.type),
      )
      .map((orderItem) => orderItem.blid);
    if (blids.length > 0 && blids.length !== new Set(blids).size) {
      throw new BlError("order contains multiple of the same blid").code(814);
    }
  }

  private async validateOrderItemBasedOnType(
    branch: Branch,
    item: Item,
    orderItem: OrderItem,
  ): Promise<boolean> {
    switch (orderItem.type) {
      case "rent": {
        return this.orderItemRentValidator.validate(branch, orderItem, item);
      }
      case "partly-payment": {
        return this.orderItemPartlyPaymentValidator.validate(orderItem, item, branch);
      }
      case "buy": {
        return this.orderItemBuyValidator.validate(orderItem, item);
      }
      case "extend": {
        return this.orderItemExtendValidator.validate(branch, orderItem);
      }
      default: {
        // Other order item types have no type-specific validation
        return true;
      }
    }
  }

  private validateOrderItemAmounts(orderItem: OrderItem) {
    const expectedTotalAmount = this.priceService.sanitize(orderItem.unitPrice);
    if (orderItem.amount !== expectedTotalAmount) {
      throw new BlError(
        `orderItem.amount "${orderItem.amount}" is not equal to orderItem.unitPrice "${orderItem.unitPrice}"`,
      );
    }
  }

  private validateAmount(order: Order): boolean {
    let expectedTotalAmount = 0;

    for (const orderItem of order.orderItems) {
      expectedTotalAmount += orderItem.amount;
    }

    if (expectedTotalAmount !== order.amount) {
      throw new BlError(
        `order.amount is "${order.amount}" but total of orderItems amount is "${expectedTotalAmount}"`,
      );
    }

    return true;
  }

  private validateDeadlines(orderItems: OrderItem[]) {
    const now = new Date();
    const nowWithGracePeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10);
    const fourYearsFromNow = new Date(now.getFullYear() + 4, now.getMonth(), now.getDate());
    const hasExpiredDeadlines = orderItems.some((item) => {
      if (!item.info?.to) {
        return false;
      }
      const deadline = new Date(item.info.to);
      return nowWithGracePeriod > deadline;
    });

    const hasDeadlinesTooFarInTheFuture = orderItems.some((item) => {
      if (!item.info?.to) {
        return false;
      }
      const deadline = new Date(item.info.to);
      return deadline > fourYearsFromNow;
    });

    if (hasExpiredDeadlines) {
      throw new BlError("orderItem deadlines must be in the future").code(809);
    }

    if (hasDeadlinesTooFarInTheFuture) {
      throw new BlError("orderItem deadlines must less than two years into the future").code(810);
    }
  }
}
