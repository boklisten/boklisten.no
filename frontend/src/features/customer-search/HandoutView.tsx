import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Box, Button, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconObjectScan } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import CancelOrderItemButton from "@/features/customer-search/CancelOrderItemButton";
import {
  buildOpenOrderInfo,
  buildPeerBooks,
  calculateUnfulfilledOrderItems,
} from "@/features/customer-search/handoutBooks";
import NoOrderHandoutModal from "@/features/customer-search/NoOrderHandoutModal";
import type { NoOrderChoice } from "@/features/customer-search/NoOrderHandoutModal";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import type { ItemStatus } from "@/shared/components/matches/matches-helper";
import { ItemStatusTable } from "@/shared/components/matches/MatchItemTable";
import { StandScannerProgress } from "@/shared/components/matches/MatchScannerContent";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";
import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";

// Above the scanner's manual-entry modal (300) so a decision is always reachable, and below its
// notice modal (400), which only appears once a decision has been made.
const CONFIRM_Z_INDEX = 350;

const POLL_INTERVAL_MS = 5000;

export default function HandoutView({ customer }: { customer: UserDetail }) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const { data: orders } = useQuery(
    api.orders.getPlacedOrders.queryOptions(
      { params: { detailsId: customer.id } },
      {
        refetchInterval: POLL_INTERVAL_MS,
      },
    ),
  );
  const { data: matchData } = useQuery(
    api.matches.getMatchesForCustomer.queryOptions(
      { params: { customerId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: signatureStatus } = useQuery(
    api.signatures.getSignature.queryOptions(
      { params: { detailsId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const [opened, { open, close }] = useDisclosure(false);
  const [itemStatuses, setItemStatuses] = useState<ItemStatus[]>([]);
  const [pendingBlid, setPendingBlid] = useState<string | null>(null);
  const [noOrderRequest, setNoOrderRequest] = useState<{
    blid: string;
    title: string;
    resolve: (choice: NoOrderChoice | null) => void;
  } | null>(null);

  // Local scan state is reconciled against every fresh poll of the orders during render; starting
  // from undefined means a cache-warm first render still populates the list.
  const [syncedOrders, setSyncedOrders] = useState<typeof orders>(undefined);
  if (orders !== undefined && orders !== syncedOrders) {
    setSyncedOrders(orders);
    const unfulfilledOrderItems = calculateUnfulfilledOrderItems(orders);
    setItemStatuses((previousState) => {
      const refreshed = previousState.map((itemStatus) => ({
        ...itemStatus,
        fulfilled: !unfulfilledOrderItems.some((orderItem) => orderItem.item === itemStatus.id),
      }));
      const knownItems = new Set(refreshed.map((itemStatus) => itemStatus.id));
      const added = unfulfilledOrderItems
        .filter((orderItem) => !knownItems.has(orderItem.item))
        .map((orderItem) => ({ id: orderItem.item, title: orderItem.title, fulfilled: false }));

      const unchanged =
        added.length === 0 &&
        refreshed.every(
          (itemStatus, index) => itemStatus.fulfilled === previousState[index]?.fulfilled,
        );
      if (unchanged) {
        return previousState;
      }
      return [...refreshed, ...added];
    });
  }

  const { receiveBooks } = buildPeerBooks(matchData ?? [], customer.id);
  // One list for everything the customer is due to get: unmarked rows are ordinary stand
  // handouts, rows due from another student carry that student's name (edition-tolerant match).
  // Peer books nobody ordered still belong in the list, ticked once the transfer has happened.
  // Stand books sort first — they are the ones this page hands out — and the table's stable
  // fulfilled-first sort keeps that order within each group.
  const bookRows: ItemStatus[] = [
    ...itemStatuses.map((itemStatus) => {
      const peer = receiveBooks.find((book) => itemsAreEquivalent(book.id, itemStatus.id));
      return peer === undefined ? itemStatus : { ...itemStatus, receiveFromName: peer.personName };
    }),
    ...receiveBooks
      .filter(
        (book) => !itemStatuses.some((itemStatus) => itemsAreEquivalent(book.id, itemStatus.id)),
      )
      .map((book) => ({
        id: book.id,
        title: book.title,
        fulfilled: book.fulfilled,
        receiveFromName: book.personName,
      })),
  ].toSorted(
    (a, b) => Number(a.receiveFromName !== undefined) - Number(b.receiveFromName !== undefined),
  );
  const nothingToShow = orders !== undefined && bookRows.length === 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: api.orders.getPlacedOrders.queryKey({ params: { detailsId: customer.id } }),
    });
    void queryClient.invalidateQueries({
      queryKey: api.matches.getMatchesForCustomer.queryKey({
        params: { customerId: customer.id },
      }),
    });
    // A handed-out book becomes one of the customer's active books, so that list is stale now too.
    void queryClient.invalidateQueries({
      queryKey: api.customerItems.getActiveCustomerItemsForCustomer.queryKey({
        params: { detailsId: customer.id },
      }),
    });
  };

  const openOrderInfo = buildOpenOrderInfo(orders ?? []);
  // Items a user match depends on may never be cancelled, locked or not (edition-tolerant)
  const userMatchItemIds = (matchData ?? [])
    .filter((match) => !match.isStandMatch)
    .flatMap((match) => match.obligations.map((obligation) => obligation.itemId));
  const isInUserMatch = (itemId: string) =>
    userMatchItemIds.some((matchItemId) => itemsAreEquivalent(matchItemId, itemId));

  function renderCancelAction(itemStatus: ItemStatus) {
    if (itemStatus.fulfilled) {
      return null;
    }
    const orderInfo = openOrderInfo.get(itemStatus.id);
    if (!orderInfo) {
      return null;
    }
    const disabledReason = isInUserMatch(itemStatus.id)
      ? "Boka er en del av en overlevering med en annen elev og kan ikke avbestilles"
      : orderInfo.paid
        ? "Bestillingen er betalt og kan ikke avbestilles her"
        : null;
    return (
      <CancelOrderItemButton
        itemStatus={itemStatus}
        orderId={orderInfo.orderId}
        disabledReason={disabledReason}
        customer={customer}
        onCancelled={() =>
          // A cancelled item is gone, not handed out, so drop it instead of letting the
          // fulfilled-refresh mark it with a green tick
          setItemStatuses((previousState) =>
            previousState.filter((previousItem) => previousItem.id !== itemStatus.id),
          )
        }
        onSettled={invalidate}
      />
    );
  }

  function askNoOrderChoice(blid: string, title: string): Promise<NoOrderChoice | null> {
    return new Promise((resolve) => setNoOrderRequest({ blid, title, resolve }));
  }

  async function confirmPeerMatch(deliverFromName: string): Promise<boolean> {
    return await asyncConfirmModal({
      title: "Skal mottas fra en annen elev",
      children: (
        <Text>
          Denne boka skal {customer.name} få fra{" "}
          <Text span fw={700}>
            {deliverFromName}
          </Text>{" "}
          Er du sikker på at du vil dele den ut på stand likevel?
        </Text>
      ),
      confirmLabel: "Del ut likevel",
      confirmColor: "red",
      zIndex: CONFIRM_Z_INDEX,
    });
  }

  async function handOutBlid(blid: string): Promise<ScanNotice | void> {
    let body: {
      blid: string;
      customerId: string;
      force?: boolean;
      branchId?: string;
      deadline?: string;
    } = { blid, customerId: customer.id };
    let noOrderTitle: string | null = null;
    // Each obstacle is confirmed at most once per scan; a reason coming back after its flag was
    // sent means the backend cannot honor it, so bail out instead of looping.
    const confirmedReasons = new Set<string>();

    for (;;) {
      const response = await client.api.handout.handout({ body });

      if ("connectBlid" in response && response.connectBlid) {
        setPendingBlid(blid);
        return {
          title: "Mangler kobling",
          message: `${response.feedback} Skann ISBN-en på boka for å koble den.`,
        };
      }

      if ("requiresConfirmation" in response && response.requiresConfirmation) {
        if (confirmedReasons.has(response.reason)) {
          return { message: "Noe gikk galt under utdelingen. Prøv å skanne boka på nytt." };
        }
        confirmedReasons.add(response.reason);

        if (response.reason === "peer-match") {
          const confirmed = await confirmPeerMatch(response.deliverFromName);
          if (!confirmed) {
            return { message: "Boka ble ikke delt ut." };
          }
          body = { ...body, force: true };
          continue;
        }

        const choice = await askNoOrderChoice(blid, response.title);
        if (!choice) {
          return { message: "Boka ble ikke delt ut." };
        }
        noOrderTitle = response.title;
        body = { ...body, branchId: choice.branchId, deadline: choice.deadline };
        continue;
      }

      if (response.feedback) {
        return { message: response.feedback };
      }

      if ("handedOutWithoutOrder" in response && response.handedOutWithoutOrder) {
        // The orders poll will never list a book that was handed out without an order, so it is
        // recorded directly. A second no-order copy of the same title gets a blid-suffixed id so
        // the rows do not collide.
        const title = noOrderTitle ?? "";
        const { itemId } = response;
        setItemStatuses((previousState) => [
          ...previousState,
          {
            id: previousState.some((itemStatus) => itemStatus.id === itemId)
              ? `${itemId}:${blid}`
              : itemId,
            title,
            fulfilled: true,
          },
        ]);
      }
      return;
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
    <Stack gap="lg">
      {nothingToShow && <InfoAlert>Denne kunden har for øyeblikket ingen bestilte bøker</InfoAlert>}

      {bookRows.length > 0 && (
        <ItemStatusTable itemStatuses={bookRows} isSender renderAction={renderCancelAction} />
      )}

      <Box>
        <Button
          color="green"
          leftSection={<IconObjectScan />}
          onClick={open}
          disabled={signatureStatus?.signatureRequired}
        >
          Scan bøker
        </Button>
      </Box>

      <Modal
        opened={opened}
        onClose={() => {
          close();
          setPendingBlid(null);
        }}
        title="Skann bøker"
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
          {bookRows.length === 0 ? (
            <InfoAlert mt="xs">
              Denne kunden har ingen bestilte bøker. Bøker du skanner blir delt ut uten bestilling.
            </InfoAlert>
          ) : (
            <StandScannerProgress itemStatuses={bookRows} />
          )}
        </ScannerPanel>
      </Modal>

      <NoOrderHandoutModal
        request={noOrderRequest}
        customer={customer}
        zIndex={CONFIRM_Z_INDEX}
        onClose={(choice) => {
          noOrderRequest?.resolve(choice);
          setNoOrderRequest(null);
        }}
      />
    </Stack>
  );
}
