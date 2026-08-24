export type PaymentMethod =
  | "cash"
  | "card"
  | "vipps"
  | "vipps-checkout"
  | "branch"
  | "later"
  | "cashout";

//cash and card are payment methods used when a customer pays at branch
// if a customer wants to pay 100 kr on cash and 50 kr by card this is possible
// the customer can however not pay two or more times with cash or two or more times with card
// just one of each

//vipps is a payment method intended for use on both web and branch, but not supported yet

//branch method is used when branch is responsible for the payments and the customer does not need to
// pay before getting the items

//later is used if the user does not want to pay right away,
// but the orderItems can not be distributed as customerItems
// before the payment is moved to another method and confirmed
// later essentially means 'not payed yet'

//cash out means when the branch pays the customer for a item
// for example, if a customer whants to sell inn a car for 100kr to a branch
// that branch needs to pay the customer 100kr
