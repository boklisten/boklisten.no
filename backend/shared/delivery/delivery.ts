import type { BlDocument } from "#shared/bl-document";
import type { DeliveryInfoBranch } from "#shared/delivery/delivery-info/delivery-info-branch";
import type { DeliveryInfoBring } from "#shared/delivery/delivery-info/delivery-info-bring";
import type { DeliveryMethod } from "#shared/delivery/delivery-method/delivery-method";

export interface Delivery extends BlDocument {
  method: DeliveryMethod; //method used for delivery
  info: DeliveryInfoBring | DeliveryInfoBranch; //specific info for the delivery type
  order: string; //id off/or the order
  amount: number; //total amount for this delivery
}
