import { CustomerItemPeriodExtendSchema } from "#database/schema";
import type { Period } from "#shared/period";

/**
 * One deadline extension of a customer item: the deadline moved from `periodFrom` to `periodTo`.
 * `createdAt` is when the extension was bought. Read through `CustomerItem`, which loads them
 * oldest first.
 */
export default class CustomerItemPeriodExtend extends CustomerItemPeriodExtendSchema {
  declare periodType: Period;
}
