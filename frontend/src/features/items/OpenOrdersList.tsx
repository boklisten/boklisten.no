import { Box, Button, Table, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconShoppingCart } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { useNavigate } from "@tanstack/react-router";

export default function OpenOrdersList({
  openOrderItems,
}: {
  openOrderItems: {
    orderId: string;
    itemId: string;
    deadline: string;
    title: string;
    cancelable: boolean;
  }[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { api } = useApiClient();

  const cancelOrderItemMutation = useMutation(
    api.orders.cancelOrderItem.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.orders.getOpenOrders.pathKey(),
        }),
      onSuccess: () => showSuccessNotification("Avbestillingen var vellykket!"),
      onError: () => showErrorNotification("Klarte ikke avbestille bok!"),
    }),
  );

  return (
    <>
      <Activity mode={(openOrderItems?.length ?? 0) > 0 ? "visible" : "hidden"}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tittel</Table.Th>
              <Table.Th>Frist</Table.Th>
              <Table.Th>Handling</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {openOrderItems?.map((orderItem) => (
              <Table.Tr key={orderItem.orderId + orderItem.itemId}>
                <Table.Td>{orderItem.title}</Table.Td>
                <Table.Td>{norwegianTime(orderItem.deadline).format("DD/MM/YYYY")}</Table.Td>
                <Table.Td>
                  <Tooltip
                    disabled={orderItem.cancelable}
                    label="Ikke tilgjenglig for øyeblikket. Ta kontakt dersom du ønsker å avbestille"
                  >
                    <Button
                      variant="subtle"
                      disabled={!orderItem.cancelable}
                      color="red"
                      loading={cancelOrderItemMutation.isPending}
                      onClick={async () => {
                        modals.openConfirmModal({
                          title: `Bekreft avbestilling`,
                          children: `Du er nå i ferd med å avbestille ${orderItem.title}. Dette kan ikke angres.`,
                          confirmProps: { color: "red" },
                          labels: { cancel: "Avbryt", confirm: "Avbestill" },
                          onConfirm: () =>
                            cancelOrderItemMutation.mutate({
                              body: {
                                orderId: orderItem.orderId,
                                itemId: orderItem.itemId,
                              },
                            }),
                        });
                      }}
                    >
                      Avbestill
                    </Button>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Activity>

      <Activity mode={!openOrderItems || openOrderItems.length === 0 ? "visible" : "hidden"}>
        <InfoAlert title="Du har ingen aktive bestillinger">
          Trykk på 'bestill bøker' for å bestille noen.
        </InfoAlert>
      </Activity>
      <Box>
        <Button
          leftSection={<IconShoppingCart />}
          onClick={async () => {
            void navigate({ to: "/bestilling" });
          }}
        >
          {(openOrderItems?.length ?? 0) > 0 ? "Bestill flere" : "Bestill bøker"}
        </Button>
      </Box>
    </>
  );
}
