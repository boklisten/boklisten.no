// "cash" and "card" are used when a customer pays at a branch;
// a payment can be split into one cash and one card payment, but not two of either.
// "vipps" is manual Vipps payment at a branch, "vipps-checkout" is the online checkout,
// "vipps-epayment" is a payment request pushed to the customer's phone from the stand.
// "dibs" is a retired payment gateway; it only occurs on historic documents and is
// never written for new payments.
export type PaymentMethod =
  | "cash"
  | "card"
  | "vipps"
  | "vipps-checkout"
  | "vipps-epayment"
  | "dibs";
