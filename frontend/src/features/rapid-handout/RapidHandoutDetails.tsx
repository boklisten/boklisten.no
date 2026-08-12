import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import type { Order } from "@boklisten/backend/shared/order/order";
import type { OrderItem } from "@boklisten/backend/shared/order/order-item/order-item";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Box, Button, Modal, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconObjectScan } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { forViewer, partyName } from "@/features/matches/forViewer";
import PeerTransferList, { type PeerBook } from "@/features/rapid-handout/PeerTransferList";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { ItemStatus } from "@/shared/components/matches/matches-helper";
import { ItemStatusTable } from "@/shared/components/matches/MatchItemTable";
import { StandScannerProgress } from "@/shared/components/matches/MatchScannerContent";
import ScannerPanel, { type ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";

// Above the scanner's manual-entry modal (300) so a decision is always reachable, and below its
// notice modal (400), which only appears once a decision has been made.
const CONFIRM_Z_INDEX = 350;

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

function buildPeerBooks(matches: MatchDto[], customerId: string) {
  const receiveBooks: PeerBook[] = [];
  const giveBooks: PeerBook[] = [];
  for (const match of matches) {
    if (match.isStandMatch) continue;
    const { toDeliver, toReceive } = forViewer(match, customerId);
    const toPeerBooks = (obligations: typeof toDeliver): PeerBook[] =>
      obligations.map((obligation) => ({
        id: obligation.itemId,
        title: obligation.title,
        fulfilled: obligation.fulfilled,
        personName: partyName(obligation.expected),
        locked: obligation.lockedToMatch,
      }));
    receiveBooks.push(...toPeerBooks(toReceive));
    giveBooks.push(...toPeerBooks(toDeliver));
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
  const [pendingBlid, setPendingBlid] = useState<string | null>(null);

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

  const { receiveBooks, giveBooks } = buildPeerBooks(matchData ?? [], customer.id);
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

  async function handOutBlid(blid: string): Promise<ScanNotice | void> {
    const response = await client.api.rapidHandout.handout({
      body: { blid, customerId: customer.id },
    });

    if (response.connectBlid) {
      setPendingBlid(blid);
      return {
        title: "Mangler kobling",
        message: `${response.feedback} Skann ISBN-en på boka for å koble den.`,
      };
    }

    if (response.requiresConfirmation) {
      const confirmed = await asyncConfirmModal({
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
        confirmLabel: "Del ut likevel",
        confirmColor: "red",
        zIndex: CONFIRM_Z_INDEX,
      });
      if (!confirmed) {
        return { message: "Boka ble ikke delt ut." };
      }
      const forced = await client.api.rapidHandout.handout({
        body: { blid, customerId: customer.id, force: true },
      });
      if (forced.feedback) {
        return { message: forced.feedback };
      }
      return;
    }

    if (response.feedback) {
      return { message: response.feedback };
    }
  }

  async function connectThenHandOut(blid: string, isbn: string): Promise<ScanNotice | void> {
    const item = await client.api.items.getByIsbn({ params: { isbn } });
    if (!item) {
      return {
        title: "Ukjent ISBN",
        message: `Fant ingen bok med ISBN ${isbn}. Sjekk at du skannet riktig strekkode.`,
      };
    }

    const confirmed = await asyncConfirmModal({
      title: "Bekreft kobling",
      children: (
        <Text>
          Unik ID{" "}
          <Text span fw={700}>
            {blid}
          </Text>{" "}
          blir koblet til{" "}
          <Text span fw={700}>
            «{item.title}»
          </Text>
          . Er dette riktig?
        </Text>
      ),
      confirmLabel: "Koble til",
      zIndex: CONFIRM_Z_INDEX,
    });
    if (!confirmed) {
      return { message: "Boka ble ikke koblet. Skann ISBN-en på nytt for å prøve igjen." };
    }

    const connection = await client.api.uniqueItems.add({ body: { blid, isbn } });
    setPendingBlid(null);
    if (connection.feedback) {
      return { message: connection.feedback };
    }

    return handOutBlid(blid);
  }

  return (
    <Stack gap={"lg"}>
      {nothingToShow && <InfoAlert>Denne kunden har for øyeblikket ingen bestilte bøker</InfoAlert>}

      {standStatuses.length > 0 && (
        <Stack gap={"xs"}>
          <Title order={2}>{standTitle}</Title>
          <ItemStatusTable itemStatuses={standStatuses} isSender={true} />
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

      <Modal
        opened={opened}
        onClose={() => {
          close();
          setPendingBlid(null);
        }}
        title={"Skann bøker"}
      >
        <ScannerPanel
          allowManualEntry
          accepts={pendingBlid === null ? ["blid"] : ["isbn"]}
          instruction={
            pendingBlid === null
              ? null
              : {
                  text: `Skann ISBN-en på boka for å koble den til unik ID ${pendingBlid}`,
                  illustrate: "isbn",
                }
          }
          onScan={(code) =>
            pendingBlid === null ? handOutBlid(code) : connectThenHandOut(pendingBlid, code)
          }
          onSuccess={invalidate}
        >
          <StandScannerProgress itemStatuses={standStatuses} />
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
        </ScannerPanel>
      </Modal>
    </Stack>
  );
}
