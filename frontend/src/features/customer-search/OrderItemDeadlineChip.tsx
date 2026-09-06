import type { OrderItemType } from "@boklisten/backend/shared/order/order-item/order-item-type";
import { IconCalendarDue } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import ChipButton from "@/shared/components/ChipButton";
import ChangeDeadlineModal from "@/shared/components/corrections/ChangeDeadlineModal";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const TYPE_LABELS: Partial<Record<OrderItemType, string>> = {
  rent: "Lån",
  "partly-payment": "Delbetaling",
};

/**
 * The period an ordered book is due back, as an editable chip on the handout list. Only the
 * order item moves; a later handout copies the deadline onto the customer item. Any employee may
 * do it; the change is monitored, so the modal says so before the form.
 */
export default function OrderItemDeadlineChip({
  orderId,
  itemId,
  type,
  deadline,
  onChanged,
}: {
  orderId: string;
  itemId: string;
  type: OrderItemType;
  deadline: string | Date;
  onChanged: () => void;
}) {
  const { api } = useApiClient();
  const [editing, setEditing] = useState(false);
  const updateMutation = useMutation(
    api.orderHistory.updateItemDeadline.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Fristen ble endret");
        setEditing(false);
      },
      onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke endre fristen")),
      onSettled: onChanged,
    }),
  );
  const label = TYPE_LABELS[type] ?? "Frist";
  return (
    <>
      <ChipButton
        icon={IconCalendarDue}
        color="gray"
        title="Endre frist"
        onClick={() => setEditing(true)}
      >
        {label} til {norwegianTime(deadline).format("DD.MM.YYYY")}
      </ChipButton>
      {editing && (
        <ChangeDeadlineModal
          currentDeadline={deadline}
          description="Datoen boka skal leveres tilbake innen"
          isPending={updateMutation.isPending}
          onClose={() => setEditing(false)}
          onSubmit={(newDeadline) =>
            updateMutation.mutate({ params: { orderId }, body: { itemId, deadline: newDeadline } })
          }
        />
      )}
    </>
  );
}
