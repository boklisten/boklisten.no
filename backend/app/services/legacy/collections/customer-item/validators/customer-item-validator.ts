import { isNullish } from "#services/legacy/typescript-helpers";
import { BlError } from "#shared/bl-error";
import type { CustomerItem } from "#shared/customer-item/customer-item";

export class CustomerItemValidator {
  public validate(customerItem: CustomerItem): Promise<boolean> {
    if (isNullish(customerItem)) {
      return Promise.reject(new BlError("customerItem is undefined"));
    }

    return Promise.resolve(true);
  }
}
