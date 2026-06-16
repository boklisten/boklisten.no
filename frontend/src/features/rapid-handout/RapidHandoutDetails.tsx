import type { Order } from "@boklisten/backend/shared/order/order";
import type { OrderItem } from "@boklisten/backend/shared/order/order-item/order-item";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Box, Button, Modal, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconObjectScan } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, useEffect, useRef, useState } from "react";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { ItemStatus } from "@/shared/components/matches/matches-helper";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import MatchScannerContent from "@/shared/components/matches/MatchScannerContent";
import { determineScannedTextType } from "@/shared/components/scanner/BlidScanner";
import ScannerModal from "@/shared/components/scanner/ScannerModal";
import useApiClient from "@/shared/hooks/useApiClient";
import { TextType } from "@/shared/utils/types";

function calculateUnfulfilledOrderItems(orders: Order[]): OrderItem[] {
  return orders
    .filter((order) => order.byCustomer && !order.handoutByDelivery)
    .flatMap((order) => order.orderItems)
    .filter(
      (orderItem) =>
        !orderItem.movedToOrder &&
        !orderItem.handout &&
        (orderItem.type === "rent" || orderItem.type === "partly-payment"),
    );
}

function mapOrdersToItemStatuses(orders: Order[]): ItemStatus[] {
  return calculateUnfulfilledOrderItems(orders).map((oi) => ({
    id: oi.item,
    title: oi.title,
    fulfilled: false,
  }));
}

export default function RapidHandoutDetails({ customer }: { customer: UserDetail }) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const { data: orders } = useQuery(
    api.orders.getPlacedOrders.queryOptions(
      { params: { detailsId: customer.id } },
      {
        staleTime: 5000,
      },
    ),
  );
  const [opened, { open, close }] = useDisclosure(false);
  const [itemStatuses, setItemStatuses] = useState<ItemStatus[]>([]);
  const tempBlidRef = useRef<string | null>(null);
  const setTempBlid = (v: string | null) => {
    tempBlidRef.current = v;
  };

  useEffect(() => {
    client.api.orders
      .getPlacedOrders({ params: { detailsId: customer.id } })
      .then((originalOrders) => {
        return setItemStatuses(mapOrdersToItemStatuses(originalOrders));
      })
      .catch((error) => {
        console.error("Failed to fetch original orders, error:", error);
      });
  }, [client, customer.id]);

  useEffect(() => {
    function updateFulfilledOrderItems() {
      if (!orders) {
        return;
      }
      const unfulfilledOrderItems = calculateUnfulfilledOrderItems(orders);
      setItemStatuses((previousState) =>
        previousState.map((itemStatus) => ({
          ...itemStatus,
          fulfilled: !unfulfilledOrderItems.some((orderItem) => orderItem.item === itemStatus.id),
        })),
      );
    }
    updateFulfilledOrderItems();
  }, [orders]);
  return (
    <>
      <Activity mode={itemStatuses.length === 0 ? "visible" : "hidden"}>
        <InfoAlert>Denne kunden har for øyeblikket ingen bestilte bøker</InfoAlert>
      </Activity>
      <Activity mode={itemStatuses.length > 0 ? "visible" : "hidden"}>
        <Stack gap={"xs"}>
          <Title order={2}>Bestilte bøker</Title>
          <MatchItemTable itemStatuses={itemStatuses} isSender={true} />
          <Box>
            <Button color={"green"} leftSection={<IconObjectScan />} onClick={open}>
              Scan bøker
            </Button>
          </Box>
          <Modal opened={opened} onClose={close} title={"Scann bøker"}>
            <ScannerModal
              allowManualRegistration
              disableValidation={true}
              onScan={async (scannedText) => {
                const scannedType = determineScannedTextType(scannedText);
                const tempBlid = tempBlidRef.current;

                if (tempBlid) {
                  if (scannedType !== TextType.ISBN) {
                    return [
                      {
                        feedback: `Du må skanne ISBN til ${scannedText}`,
                      },
                    ];
                  }
                  await client.api.uniqueItems.add({
                    body: {
                      blid: tempBlid,
                      isbn: scannedText,
                    },
                  });
                  setTempBlid(null);
                } else if (scannedType !== TextType.BLID) {
                  return [
                    {
                      feedback: "Feil strekkode. Vennligst skann bokas unike ID",
                    },
                  ];
                }
                const response = await client.api.rapidHandout.handout({
                  body: {
                    blid: tempBlid ?? scannedText,
                    customerId: customer.id,
                  },
                });

                if (response.connectBlid) {
                  setTempBlid(scannedText);
                  return [
                    {
                      feedback: "Denne boken er ikke knyttet til noen unik ID. Skann bokas ISBN",
                    },
                  ];
                }
                return [{ feedback: response.feedback }];
              }}
              onSuccessfulScan={() =>
                queryClient.invalidateQueries({
                  queryKey: api.orders.getPlacedOrders.queryKey({
                    params: { detailsId: customer.id },
                  }),
                })
              }
            >
              <MatchScannerContent
                itemStatuses={itemStatuses}
                expectedItems={itemStatuses.map((itemStatus) => itemStatus.id)}
                fulfilledItems={itemStatuses
                  .filter((itemStatus) => itemStatus.fulfilled)
                  .map((itemStatus) => itemStatus.id)}
              />
            </ScannerModal>
          </Modal>
        </Stack>
      </Activity>
    </>
  );
}
