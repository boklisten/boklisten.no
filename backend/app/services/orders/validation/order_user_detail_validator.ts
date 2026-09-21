import User from "#models/user";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";

export class OrderUserDetailValidator {
  /** The order's customer must exist; nothing else about them is checked here. */
  public async validate(order: Order): Promise<boolean> {
    const customer = await User.find(order.customer);
    if (!customer) {
      throw new BlError("userDetail not found").code(701);
    }
    return true;
  }
}
