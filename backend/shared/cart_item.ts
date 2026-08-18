export type CartItemType = "rent" | "partly-payment" | "buy" | "extend" | "buyout";

// Order item types that hand out a new copy, as opposed to acting on one the customer already has
export const ACQUISITION_CART_ITEM_TYPES: CartItemType[] = ["rent", "partly-payment", "buy"];

export interface CartItemOption {
  type: CartItemType;
  price: number;
  payLater?: number;
  to?: Date;
}

export interface CartItem {
  id: string;
  title: string;
  branchId: string;
  subject?: string;
  options: CartItemOption[];
  selectedOptionIndex: number;
}

export interface CheckoutCartItem {
  id: string;
  branchId: string;
  type: CartItemType;
  to?: Date | undefined;
}
