import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { UserMatchWithDetails } from "@boklisten/backend/shared/match/match-dtos";
import type { Order } from "@boklisten/backend/shared/order/order";
import type { OrderItem } from "@boklisten/backend/shared/order/order-item/order-item";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Box, Button, Modal, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { IconObjectScan } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import PeerTransferList, { type PeerBook } from "@/features/rapid-handout/PeerTransferList";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import {
  calculateItemStatuses,
  calculateUserMatchStatus,
  ItemStatus,
} from "@/shared/components/matches/matches-helper";
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

/**
 * Splits the customer's user matches into books they receive from / deliver to other students,
 * seen from this customer's perspective. Books received from a peer should not be handed out at
 * the stand; books delivered to a peer are shown as a reminder.
 */
function buildPeerBooks(userMatches: UserMatchWithDetails[], customerId: string) {
  const receiveBooks: PeerBook[] = [];
  const giveBooks: PeerBook[] = [];
  for (const userMatch of userMatches) {
    const status = calculateUserMatchStatus(userMatch, customerId);
    const toPeerBooks = (itemIds: string[], fulfilledIds: string[]): PeerBook[] => {
      try {
        return calculateItemStatuses(userMatch, () => itemIds, fulfilledIds).map((itemStatus) => ({
          ...itemStatus,
          personName: status.otherUser.name,
          locked: userMatch.itemsLockedToMatch,
        }));
      } catch {
        return [];
      }
    };
    receiveBooks.push(
      ...toPeerBooks(status.currentUser.wantedItems, status.currentUser.receivedItems),
    );
    giveBooks.push(...toPeerBooks(status.currentUser.items, status.currentUser.deliveredItems));
  }
  return { receiveBooks, giveBooks };
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
  const { data: matchData } = useQuery(
    api.matches.getMatchesForCustomer.queryOptions(
      { params: { customerId: customer.id } },
      { staleTime: 5000 },
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

  const { receiveBooks, giveBooks } = buildPeerBooks(matchData?.userMatches ?? [], customer.id);
  // Books the customer receives from a peer are not handed out at the stand, so keep them out of
  // the stand list (edition-tolerant comparison).
  const standStatuses = itemStatuses.filter(
    (itemStatus) => !receiveBooks.some((book) => itemsAreEquivalent(book.id, itemStatus.id)),
  );
  const hasPeerBooks = receiveBooks.length > 0 || giveBooks.length > 0;
  const standTitle = hasPeerBooks ? "Del ut på stand" : "Bestilte bøker";
  const nothingToShow =
    standStatuses.length === 0 && receiveBooks.length === 0 && giveBooks.length === 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: api.orders.getPlacedOrders.queryKey({ params: { detailsId: customer.id } }),
    });
    void queryClient.invalidateQueries({
      queryKey: api.matches.getMatchesForCustomer.queryKey({
        params: { customerId: customer.id },
      }),
    });
  };

  return (
    <Stack gap={"lg"}>
      {nothingToShow && <InfoAlert>Denne kunden har for øyeblikket ingen bestilte bøker</InfoAlert>}

      {standStatuses.length > 0 && (
        <Stack gap={"xs"}>
          <Title order={2}>{standTitle}</Title>
          <MatchItemTable itemStatuses={standStatuses} isSender={true} />
        </Stack>
      )}

      {(standStatuses.length > 0 || receiveBooks.length > 0) && (
        <Box>
          <Button color={"green"} leftSection={<IconObjectScan />} onClick={open}>
            Scan bøker
          </Button>
        </Box>
      )}

      {receiveBooks.length > 0 && (
        <PeerTransferList
          title={"Mottas fra andre elever"}
          direction={"receive"}
          books={receiveBooks}
        />
      )}

      {giveBooks.length > 0 && (
        <PeerTransferList title={"Leveres til andre elever"} direction={"give"} books={giveBooks} />
      )}

      <Modal opened={opened} onClose={close} title={"Scann bøker"}>
        <ScannerModal
          allowManualRegistration
          disableValidation={true}
          onScan={async (scannedText) => {
            const scannedType = determineScannedTextType(scannedText);
            const tempBlid = tempBlidRef.current;

            if (tempBlid) {
              if (scannedType !== TextType.ISBN) {
                return [{ feedback: `Du må skanne ISBN til ${scannedText}` }];
              }
              await client.api.uniqueItems.add({
                body: { blid: tempBlid, isbn: scannedText },
              });
              setTempBlid(null);
            } else if (scannedType !== TextType.BLID) {
              return [{ feedback: "Feil strekkode. Vennligst skann bokas unike ID" }];
            }

            const blidToHandout = tempBlid ?? scannedText;
            const response = await client.api.rapidHandout.handout({
              body: { blid: blidToHandout, customerId: customer.id },
            });

            if (response.connectBlid) {
              setTempBlid(scannedText);
              return [
                { feedback: "Denne boken er ikke knyttet til noen unik ID. Skann bokas ISBN" },
              ];
            }

            if (response.requiresConfirmation) {
              const confirmed = await new Promise<boolean>((resolve) => {
                modals.openConfirmModal({
                  title: "Skal mottas fra en annen elev",
                  children: (
                    <Text>
                      Denne boka skal {customer.name} få fra{" "}
                      <Text span fw={700}>
                        {response.deliverFromName}
                      </Text>
                      , ikke på stand. Er du sikker på at du vil dele den ut på stand likevel?
                    </Text>
                  ),
                  labels: { confirm: "Del ut likevel", cancel: "Avbryt" },
                  confirmProps: { color: "red" },
                  onConfirm: () => resolve(true),
                  onCancel: () => resolve(false),
                  // Dismissing via X / overlay / escape only fires onClose; resolve there too so
                  // the awaited scan never hangs (the first resolve wins).
                  onClose: () => resolve(false),
                });
              });
              if (!confirmed) {
                return [{ feedback: "Boka ble ikke delt ut." }];
              }
              const forced = await client.api.rapidHandout.handout({
                body: { blid: blidToHandout, customerId: customer.id, force: true },
              });
              return [{ feedback: forced.feedback }];
            }

            return [{ feedback: response.feedback }];
          }}
          onSuccessfulScan={invalidate}
        >
          <MatchScannerContent
            itemStatuses={standStatuses}
            expectedItems={standStatuses.map((itemStatus) => itemStatus.id)}
            fulfilledItems={standStatuses
              .filter((itemStatus) => itemStatus.fulfilled)
              .map((itemStatus) => itemStatus.id)}
          />
          {receiveBooks.length > 0 && (
            <InfoAlert title={"Fås fra andre elever – ikke del ut her"}>
              <Stack gap={2}>
                {receiveBooks.map((book) => (
                  <Text key={`${book.id}-${book.personName}`} size={"sm"}>
                    {book.title} – fra {book.personName}
                    {book.locked ? " (låst)" : ""}
                  </Text>
                ))}
              </Stack>
            </InfoAlert>
          )}
        </ScannerModal>
      </Modal>
    </Stack>
  );
}
