import Payment from "#models/payment";
import type { Payment as PaymentDto } from "#shared/payment/payment";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

type PaymentColumns = Pick<Payment, (typeof Payment.$columns)[number]>;

/**
 * Inserts a payment of an order into the test Postgres, a confirmed card payment of 100 unless told
 * otherwise. The order must exist already.
 */
export async function createPayment(
  overrides: Partial<PaymentColumns> & Pick<PaymentColumns, "orderId">,
): Promise<Payment> {
  sequence++;
  return Payment.create({
    id: fixtureId(`ae${sequence.toString(16)}`),
    method: "card",
    amount: 100,
    confirmed: true,
    ...overrides,
  });
}

/** A plain `Payment` for pure functions. */
export function paymentDto(overrides: Partial<PaymentDto> = {}): PaymentDto {
  return {
    id: fixtureId("a0"),
    orderId: fixtureId("f0"),
    method: "card",
    amount: 100,
    confirmed: true,
    createdAt: new Date("2026-08-15T10:00:00Z"),
    updatedAt: new Date("2026-08-15T10:00:00Z"),
    ...overrides,
  };
}
