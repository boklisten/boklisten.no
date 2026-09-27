import type { PaymentMethod } from "#shared/payment/payment-method/payment-method";

/**
 * Money recorded against an order: what the customer paid, or, with a negative amount, what was
 * refunded. It belongs to the order's customer and branch; `confirmed` is set when the order is
 * placed.
 */
export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  confirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
