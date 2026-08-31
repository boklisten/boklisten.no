import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, Text, Tooltip } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";

import type { ItemStatus } from "@/shared/components/matches/matches-helper";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * Per-row "Avbestill" in the customer search book table. When `disabledReason` is set, the button
 * looks disabled but keeps hover events (data-disabled, not disabled) so the tooltip can explain
 * why cancellation is blocked.
 */
export default function CancelOrderItemButton({
  itemStatus,
  orderId,
  disabledReason,
  customer,
  onCancelled,
  onSettled,
}: {
  itemStatus: ItemStatus;
  orderId: string;
  disabledReason: string | null;
  customer: UserDetail;
  onCancelled: () => void;
  onSettled: () => void;
}) {
  const { api } = useApiClient();

  const cancelMutation = useMutation(
    api.orders.cancelOrderItemAsEmployee.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Boka ble avbestilt");
        onCancelled();
      },
      onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke avbestille boka")),
      onSettled,
    }),
  );

  async function confirmAndCancel() {
    const confirmed = await asyncConfirmModal({
      title: "Bekreft avbestilling",
      children: (
        <Text>
          Du er nå i ferd med å avbestille{" "}
          <Text span fw={700}>
            «{itemStatus.title}»
          </Text>{" "}
          for {customer.name}. Kunden får kvittering på e-post. Dette kan ikke angres.
        </Text>
      ),
      confirmLabel: "Avbestill",
      confirmColor: "red",
    });
    if (!confirmed) return;
    cancelMutation.mutate({ body: { orderId, itemId: itemStatus.id } });
  }

  return (
    <Tooltip label={disabledReason} disabled={disabledReason === null} multiline maw={280}>
      <Button
        variant={"subtle"}
        color={"red"}
        size={"compact-sm"}
        data-disabled={disabledReason !== null || undefined}
        loading={cancelMutation.isPending}
        onClick={(event) => {
          if (disabledReason !== null) {
            event.preventDefault();
            return;
          }
          void confirmAndCancel();
        }}
      >
        Avbestill
      </Button>
    </Tooltip>
  );
}
