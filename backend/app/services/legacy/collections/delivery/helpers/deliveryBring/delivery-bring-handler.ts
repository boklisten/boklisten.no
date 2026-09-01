import { isNullish } from "#services/legacy/typescript-helpers";
import { BlError } from "#shared/bl-error";
import type { Delivery } from "#shared/delivery/delivery";

export class DeliveryBringHandler {
  public validate(delivery: Delivery): Promise<boolean> {
    if (isNullish(delivery.info)) {
      return Promise.reject(new BlError("delivery.info not defined"));
    }

    // @ts-expect-error fixme bad enums
    if (isNullish(delivery.info["from"])) {
      return Promise.reject(new BlError("delivery.info.from not defined"));
    }

    // @ts-expect-error fixme bad enums
    if (isNullish(delivery.info["to"])) {
      return Promise.reject(new BlError("delivery.info.to not defined"));
    }

    return Promise.resolve(true);
  }
}
