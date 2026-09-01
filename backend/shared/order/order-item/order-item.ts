import type { OrderItemInfo } from "#shared/order/order-item/order-item-info";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";

export interface OrderItem {
  type: OrderItemType; //the operation on this OrderItem
  item: string; //id of/or the item
  blid?: string; // BLID of item
  title: string; //the title of item
  amount: number; //the amount to pay
  unitPrice: number; //item.price * rentRate (or item.price * branchItem.partlyPaymentRate if type is "partly-payment")
  handout: boolean; // if set, this orderItem is the "handout" of this item
  info?: OrderItemInfo; //if the type is rent or extend, this object contains info about the rental period
  delivered: boolean; // if the orderItem is delivered out or not
  customerItem?: string; // if this orderItem is for a customerItem, this is the id of the customerItem
  match?: string; // if the orderItem is part of a match
  movedToOrder?: string; // if the orderItem is added again in a new order, this points to it
  movedFromOrder?: string; //if the orderItem is from another order, this points to it
}
