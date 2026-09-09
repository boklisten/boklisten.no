import type { InvoiceListRow, InvoiceStatus } from "@boklisten/backend/shared/invoice";
import { INVOICE_STATUSES } from "@boklisten/backend/shared/invoice";
import { UnstyledButton } from "@mantine/core";

import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  formatKroner,
} from "@/features/invoices/invoiceLabels";
import classes from "@/features/invoices/InvoiceStatusSummary.module.css";

export interface StatusTotals {
  count: number;
  amount: number;
}

export function totalsByStatus(rows: InvoiceListRow[]): Map<InvoiceStatus, StatusTotals> {
  const totals = new Map<InvoiceStatus, StatusTotals>();
  for (const row of rows) {
    const current = totals.get(row.status) ?? { count: 0, amount: 0 };
    totals.set(row.status, {
      count: current.count + 1,
      amount: current.amount + row.totalIncludingFee,
    });
  }
  return totals;
}

/**
 * One tile per status with how many invoices it holds and what they add up to. The tiles are
 * also the list filter: a lit tile is shown, an unlit one is hidden.
 */
export default function InvoiceStatusSummary({
  rows,
  active,
  onChange,
}: {
  rows: InvoiceListRow[];
  active: InvoiceStatus[];
  onChange: (active: InvoiceStatus[]) => void;
}) {
  const totals = totalsByStatus(rows);
  const toggle = (status: InvoiceStatus) =>
    onChange(
      active.includes(status)
        ? active.filter((candidate) => candidate !== status)
        : INVOICE_STATUSES.filter(
            (candidate) => candidate === status || active.includes(candidate),
          ),
    );

  return (
    <div className={classes.tiles} role="group" aria-label="Filtrer på status">
      {INVOICE_STATUSES.map((status) => {
        const color = INVOICE_STATUS_COLORS[status];
        const { count, amount } = totals.get(status) ?? { count: 0, amount: 0 };
        return (
          <UnstyledButton
            key={status}
            className={classes.tile}
            aria-pressed={active.includes(status)}
            onClick={() => toggle(status)}
            style={{
              "--tile-bg": `var(--mantine-color-${color}-light)`,
              "--tile-color": `var(--mantine-color-${color}-light-color)`,
            }}
          >
            <div className={classes.label}>{INVOICE_STATUS_LABELS[status]}</div>
            <div className={classes.count}>{count}</div>
            <div className={classes.amount}>{formatKroner(amount)}</div>
          </UnstyledButton>
        );
      })}
    </div>
  );
}
