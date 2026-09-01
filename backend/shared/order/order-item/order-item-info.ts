import type { Period } from "#shared/period";

export interface OrderItemInfo {
  from?: Date;
  to?: Date;
  numberOfPeriods?: number;
  periodType?: Period;
  customerItem?: string;
  amountLeftToPay?: number;
  buybackAmount?: number;
}
