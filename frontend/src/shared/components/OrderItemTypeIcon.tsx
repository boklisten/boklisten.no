import type { OrderItemType } from "@boklisten/backend/shared/order/order-item/order-item-type";
import {
  IconCalendar,
  IconCalendarPlus,
  IconCancel,
  IconCheckbox,
  IconHeartHandshake,
  IconInfoCircle,
  IconInvoice,
} from "@tabler/icons-react";

export default function OrderItemTypeIcon({ type }: { type: OrderItemType }) {
  switch (type) {
    case "rent":
    case "partly-payment": {
      return <IconCalendar size={18} />;
    }
    case "match-deliver":
    case "match-receive": {
      return <IconHeartHandshake size={18} />;
    }
    case "cancel": {
      return <IconCancel size={18} />;
    }
    case "extend": {
      return <IconCalendarPlus size={18} />;
    }
    case "invoice-paid": {
      return <IconInvoice size={18} />;
    }
    case "return": {
      return <IconCheckbox size={18} />;
    }
  }
  return <IconInfoCircle size={18} />;
}
