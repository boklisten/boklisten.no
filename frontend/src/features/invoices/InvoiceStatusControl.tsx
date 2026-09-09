import type { InvoiceStatus } from "@boklisten/backend/shared/invoice";
import { INVOICE_STATUSES } from "@boklisten/backend/shared/invoice";
import type { MantineSize } from "@mantine/core";
import { SegmentedControl, Select } from "@mantine/core";

import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_OPTIONS,
  parseInvoiceStatus,
} from "@/features/invoices/invoiceLabels";

/**
 * The five invoice statuses as one row of segments, tinted in the status colour so the control
 * reads like the summary tiles above the list. `compact` swaps in a dropdown where five segments
 * do not fit. A missing value (a mixed selection) leaves every segment unlit.
 */
export default function InvoiceStatusControl({
  value,
  onChange,
  disabled = false,
  compact = false,
  size = "xs",
  ariaLabel = "Status",
  dropdownZIndex,
}: {
  value: InvoiceStatus | null;
  onChange: (status: InvoiceStatus) => void;
  disabled?: boolean;
  compact?: boolean;
  size?: MantineSize;
  ariaLabel?: string;
  dropdownZIndex?: number;
}) {
  const handleChange = (next: string | null) => {
    const status = parseInvoiceStatus(next);
    if (status && status !== value) {
      onChange(status);
    }
  };

  if (compact) {
    return (
      <Select
        aria-label={ariaLabel}
        data={INVOICE_STATUS_OPTIONS}
        value={value}
        placeholder="Velg status"
        onChange={handleChange}
        allowDeselect={false}
        disabled={disabled}
        size={size}
        comboboxProps={{ zIndex: dropdownZIndex, withinPortal: true }}
        styles={{
          input: value
            ? {
                backgroundColor: `var(--mantine-color-${INVOICE_STATUS_COLORS[value]}-light)`,
                color: `var(--mantine-color-${INVOICE_STATUS_COLORS[value]}-light-color)`,
                fontWeight: 600,
              }
            : undefined,
        }}
      />
    );
  }

  const tint = value ? INVOICE_STATUS_COLORS[value] : null;
  return (
    <SegmentedControl
      aria-label={ariaLabel}
      value={value ?? ""}
      onChange={handleChange}
      disabled={disabled}
      size={size}
      data={INVOICE_STATUSES.map((status) => ({
        value: status,
        label: INVOICE_STATUS_LABELS[status],
      }))}
      style={
        tint
          ? {
              "--sc-color": `var(--mantine-color-${tint}-light)`,
              "--sc-label-color": `var(--mantine-color-${tint}-light-color)`,
            }
          : undefined
      }
    />
  );
}
