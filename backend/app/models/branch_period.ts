import { DateTime } from "luxon";

import { BranchPeriodSchema } from "#database/schema";
import type { BranchPeriods, ExtendPeriod, PartlyPaymentPeriod, RentPeriod } from "#shared/branch";
import type { Period } from "#shared/period";

export const PERIOD_KINDS = ["partly_payment", "rent", "extend"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

/** The `BranchPeriods` list each kind of row is read from and written to. */
export const PERIOD_LIST_BY_KIND = {
  partly_payment: "partlyPaymentPeriods",
  rent: "rentPeriods",
  extend: "extendPeriods",
} as const satisfies Record<PeriodKind, keyof BranchPeriods>;

/** The columns of a period row apart from its generated id. */
type BranchPeriodRow = Omit<Pick<BranchPeriod, (typeof BranchPeriodSchema.$columns)[number]>, "id">;

type KindColumns = Pick<
  BranchPeriodRow,
  "maxNumberOfPeriods" | "percentage" | "price" | "percentageBuyout" | "percentageUpFront"
>;

/** One row; the columns the kind does not use stay null. `date` may arrive as an ISO string over the API. */
function periodRow(
  branchId: string,
  kind: PeriodKind,
  period: { type: Period; date: Date },
  columns: Partial<KindColumns>,
): BranchPeriodRow {
  return {
    branchId,
    kind,
    periodType: period.type,
    date: DateTime.fromJSDate(new Date(period.date)),
    maxNumberOfPeriods: columns.maxNumberOfPeriods ?? null,
    percentage: columns.percentage ?? null,
    price: columns.price ?? null,
    percentageBuyout: columns.percentageBuyout ?? null,
    percentageUpFront: columns.percentageUpFront ?? null,
  };
}

/**
 * One entry of a branch's rent, extend or partly-payment period list. The three kinds share the
 * table; the columns a kind does not use are null. `Branch` exposes them as three typed lists.
 */
export default class BranchPeriod extends BranchPeriodSchema {
  declare kind: PeriodKind;
  declare periodType: Period;

  /** The rows that store the given period lists for `branchId`, in list order. */
  static rowsFor(branchId: string, periods: Partial<BranchPeriods>): BranchPeriodRow[] {
    return [
      ...(periods.partlyPaymentPeriods ?? []).map((period) =>
        periodRow(branchId, "partly_payment", period, {
          percentageBuyout: period.percentageBuyout,
          percentageUpFront: period.percentageUpFront,
        }),
      ),
      ...(periods.rentPeriods ?? []).map((period) =>
        periodRow(branchId, "rent", period, {
          maxNumberOfPeriods: period.maxNumberOfPeriods,
          percentage: period.percentage,
        }),
      ),
      ...(periods.extendPeriods ?? []).map((period) =>
        periodRow(branchId, "extend", period, {
          maxNumberOfPeriods: period.maxNumberOfPeriods,
          price: period.price,
          percentage: period.percentage,
        }),
      ),
    ];
  }

  toRentPeriod(): RentPeriod {
    return {
      type: this.periodType,
      date: this.date.toJSDate(),
      maxNumberOfPeriods: this.required(this.maxNumberOfPeriods, "maxNumberOfPeriods"),
      percentage: this.required(this.percentage, "percentage"),
    };
  }

  toExtendPeriod(): ExtendPeriod {
    return {
      type: this.periodType,
      date: this.date.toJSDate(),
      maxNumberOfPeriods: this.required(this.maxNumberOfPeriods, "maxNumberOfPeriods"),
      price: this.required(this.price, "price"),
      percentage: this.percentage,
    };
  }

  toPartlyPaymentPeriod(): PartlyPaymentPeriod {
    return {
      type: this.periodType,
      date: this.date.toJSDate(),
      percentageBuyout: this.required(this.percentageBuyout, "percentageBuyout"),
      percentageUpFront: this.required(this.percentageUpFront, "percentageUpFront"),
    };
  }

  /** Only our own validated writes reach the table, so a missing kind-specific column is a bug. */
  private required(value: number | null, column: string): number {
    if (value === null) {
      throw new Error(`branch_periods.${this.id} (${this.kind}): ${column} is null`);
    }
    return value;
  }
}
