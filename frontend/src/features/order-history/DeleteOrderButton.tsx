import type { OrderHistoryEntry } from "@boklisten/backend/shared/order/order-history";
import { Button, Stack, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import MonitoringNotice from "@/shared/components/MonitoringNotice";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * Deletes the order document and nothing else, for any employee. Everyone below admin is reported
 * to the administrator, and told so before they confirm.
 */
export default function DeleteOrderButton({ order }: { order: OrderHistoryEntry }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const deleteMutation = useMutation(
    api.orderHistory.deleteOrder.mutationOptions({
      onSuccess: () => showSuccessNotification("Ordren ble slettet"),
      onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke slette ordren")),
      // A gone order changes the customer's books, open orders and branch lists alike.
      onSettled: () => queryClient.invalidateQueries(),
    }),
  );

  async function confirmAndDelete() {
    const confirmed = await asyncConfirmModal({
      title: "Slett ordre",
      children: (
        <Stack gap="xs">
          <Text>Er du sikker på at du vil slette ordren? Dette kan ikke angres.</Text>
          <MonitoringNotice>
            Sletter du ordren, sendes et varsel til administrator med navn på deg og kunden.
          </MonitoringNotice>
        </Stack>
      ),
      confirmLabel: "Slett ordre",
      confirmColor: "red",
    });
    if (confirmed) {
      deleteMutation.mutate({ params: { orderId: order.id } });
    }
  }

  return (
    <Button
      variant="subtle"
      color="red"
      size="xs"
      leftSection={<IconTrash size={14} />}
      loading={deleteMutation.isPending}
      onClick={confirmAndDelete}
    >
      Slett ordre
    </Button>
  );
}
