import { BaseTransformer } from "@adonisjs/core/transformers";
import type WaitingListCustomer from "#models/waiting_list_customer";

export default class WaitingListCustomerTransformer extends BaseTransformer<WaitingListCustomer> {
  toObject() {
    return {
      id: this.resource.id.toString(),
      ...this.pick(this.resource, ["name", "phoneNumber", "itemId", "branchId"]),
    };
  }
}
