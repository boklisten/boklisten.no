import type Order from "#models/order";
import User from "#models/user";
import { BlError } from "#shared/bl-error";

export class OrderUserDetailValidator {
  /** The order's customer must exist; nothing else about them is checked here. */
  public async validate(order: Order): Promise<boolean> {
    const customer = order.customerId === null ? null : await User.find(order.customerId);
    if (!customer) {
      throw new BlError("userDetail not found").code(701);
    }
    return true;
  }
}
