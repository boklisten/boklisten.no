// rent
// buy
// extend
// sell
// buyout
// return
// cancel
// partly-payment
// buyback -- when a customer wants to "sell" a partly-payment item back to us

export type OrderItemType =
  | "rent"
  | "buy"
  | "extend"
  | "sell"
  | "buyout"
  | "return"
  | "cancel"
  | "partly-payment"
  | "buyback"
  | "invoice-paid"
  | "match-receive"
  | "match-deliver";
