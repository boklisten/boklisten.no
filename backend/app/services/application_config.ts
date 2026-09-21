import { DateTime } from "luxon";

/** The weeks around school start when Bring is quick, as [month, day] bounds, inclusive. */
const DELIVERY_HIGH_SEASONS: { from: [number, number]; to: [number, number] }[] = [
  { from: [8, 5], to: [9, 10] },
  { from: [1, 7], to: [2, 8] },
];

/**
 * Days Bring is expected to need for a shipment: shorter in season. Evaluated per call because
 * the process stays up across season boundaries.
 */
export function deliveryDays(now: DateTime = DateTime.now()): number {
  const inSeason = DELIVERY_HIGH_SEASONS.some(
    ({ from, to }) =>
      now >= now.set({ month: from[0], day: from[1] }).startOf("day") &&
      now <= now.set({ month: to[0], day: to[1] }).endOf("day"),
  );
  return inSeason ? 3 : 7;
}

export const APP_CONFIG = {
  payment: {
    paymentServiceConfig: {
      roundDown: true,
      roundUp: false,
    },
  },
} as const;
