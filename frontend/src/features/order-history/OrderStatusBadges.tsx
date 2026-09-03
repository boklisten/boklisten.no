import type {
  OrderHistoryEntry,
  OrderPaymentStatus,
} from "@boklisten/backend/shared/order/order-history";
import { Badge } from "@mantine/core";
import { IconTruck } from "@tabler/icons-react";

/** "free" has no chip on purpose: most orders are free, and a chip on every card is noise. */
const PAYMENT_BADGES: Record<
  Exclude<OrderPaymentStatus, "free">,
  { label: string; color: string }
> = {
  paid: { label: "Betalt", color: "green" },
  unpaid: { label: "Ikke betalt", color: "red" },
  refunded: { label: "Refundert", color: "orange" },
  invoice: { label: "Betalt via faktura", color: "blue" },
};

export function PaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  if (status === "free") {
    return null;
  }
  const { label, color } = PAYMENT_BADGES[status];
  return (
    <Badge variant="light" color={color} tt="none" size="sm" style={{ flexShrink: 0 }}>
      {label}
    </Badge>
  );
}

/** Mail orders only; a branch pickup is the normal case and gets no chip. */
export function DeliveryBadge({ order }: { order: OrderHistoryEntry }) {
  if (order.delivery === null || order.delivery.method === "branch") {
    return null;
  }
  return (
    <Badge
      variant="light"
      color="gray"
      tt="none"
      size="sm"
      leftSection={<IconTruck size={12} />}
      style={{ flexShrink: 0 }}
    >
      I posten
    </Badge>
  );
}
