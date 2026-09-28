import Branch from "#models/branch";
import type Order from "#models/order";
import { OrderFieldValidator } from "#services/orders/validation/order_field_validator";
import { OrderItemValidator } from "#services/orders/validation/order_item_validator";
import { OrderPlacedValidator } from "#services/orders/validation/order_placed_validator";
import { OrderUserValidator } from "#services/orders/validation/order_user_validator";
import { BlError } from "#shared/bl-error";

export class OrderValidator {
  private readonly orderPlacedValidator: OrderPlacedValidator;
  private readonly orderItemValidator: OrderItemValidator;

  private readonly orderFieldValidator: OrderFieldValidator;
  private readonly orderUserValidator: OrderUserValidator;

  constructor(
    orderItemValidator?: OrderItemValidator,
    orderPlacedValidator?: OrderPlacedValidator,

    orderFieldValidator?: OrderFieldValidator,
    orderUserValidator?: OrderUserValidator,
  ) {
    this.orderItemValidator = orderItemValidator ?? new OrderItemValidator();
    this.orderPlacedValidator = orderPlacedValidator ?? new OrderPlacedValidator();

    this.orderFieldValidator = orderFieldValidator ?? new OrderFieldValidator();
    this.orderUserValidator = orderUserValidator ?? new OrderUserValidator();
  }

  public async validate(order: Order, isAdmin: boolean): Promise<boolean> {
    try {
      if (this.mustHaveCustomer(order)) {
        await this.orderUserValidator.validate(order);
      }

      await this.orderFieldValidator.validate(order);
      const branch = await Branch.findOrFail(order.branchId);

      await this.orderItemValidator.validate(branch, order, isAdmin);
      await this.orderPlacedValidator.validate(order);
    } catch (error) {
      if (error instanceof BlError) {
        throw error;
      }
      throw new BlError("order could not be validated").store("error", error);
    }
    return true;
  }

  private mustHaveCustomer(order: Order): boolean {
    for (const orderItem of order.orderItems) {
      if (orderItem.type !== "buy") {
        return true;
      }
    }

    return false;
  }
}
