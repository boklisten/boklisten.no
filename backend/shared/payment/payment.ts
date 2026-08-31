import { BlDocument } from "#shared/bl-document";
import { PaymentInfo } from "#shared/payment/payment-info/payment-info";
import { PaymentMethod } from "#shared/payment/payment-method/payment-method";

export interface Payment extends BlDocument {
  method: PaymentMethod; //the method used for payment
  order: string; // the id order this payment is for
  amount: number; //the total amount for this payment
  customer: string; //the id of the customer this payment is intended for
  branch: string; //the id of the branch this payment was placed on
  info?: PaymentInfo; //method specific info; only present on historic gateway payments
  confirmed: boolean; //a boolean to check if the payment is confirmed or not
}
