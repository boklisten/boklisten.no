import type { ScannedBook } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import {
  getCollection,
  updateCollection,
  useCollectionState,
} from "@/features/bulk-collection/collectionStore";
import type { StoredCollection } from "@/features/bulk-collection/collectionStore";
import { isOverdue } from "@/features/bulk-collection/deadline";
import useDisplayName from "@/features/customer-search/useDisplayName";
import { BLID_SEARCH_QUERY_KEY } from "@/features/search/SearchSpotlight";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import MonitoringNotice from "@/shared/components/MonitoringNotice";
import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal, { CONFIRM_OVER_SCANNER_Z_INDEX } from "@/shared/utils/asyncConfirmModal";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";
import { showErrorNotification } from "@/shared/utils/notifications";

export interface CollectionSession extends StoredCollection {
  overdueBooks: ScannedBook[];
  isDelivering: boolean;
  /** Resolves to a notice when the book did not join the list, so any scanner can show why. */
  registerBlid: (blid: string) => Promise<ScanNotice | undefined>;
  removeBook: (blid: string) => void;
  /** Asks for confirmation when a scanned book is past its deadline, then delivers. */
  deliver: () => void;
  /** Clears the receipt and the list, ready for the next batch. */
  scanMore: () => void;
}

/** Clears the receipt and the list, ready for the next batch. */
const scanMore = () => updateCollection(() => ({ scannedBooks: [], receipt: null }));

const addBook = (book: ScannedBook) => {
  updateCollection((current) =>
    current.scannedBooks.some((existing) => existing.blid === book.blid)
      ? current
      : { ...current, scannedBooks: [book, ...current.scannedBooks] },
  );
};

function PeerBookQuestion({ book }: { book: ScannedBook }) {
  const displayName = useDisplayName();
  return (
    <Text size="sm">
      Denne boka skal {displayName(book.customerName)} egentlig overlevere til{" "}
      <Text span fw={600}>
        {book.deliverToName === undefined ? "" : displayName(book.deliverToName)}
      </Text>
      . Er du sikker på at du vil ta den imot her?
    </Text>
  );
}

// A book the customer is supposed to give to another student may still be collected here, but
// only after the employee has confirmed it.
function confirmPeerBook(book: ScannedBook): Promise<boolean> {
  return asyncConfirmModal({
    title: "Skal overleveres til en annen elev",
    children: <PeerBookQuestion book={book} />,
    confirmLabel: "Ta imot likevel",
    confirmColor: "red",
    zIndex: CONFIRM_OVER_SCANNER_Z_INDEX,
  });
}

/**
 * One return-delivery batch: the books scanned so far, or the receipt of the delivery just made.
 * The batch itself lives in the collection store, so it waits while the employee opens a customer
 * or a book and survives a reload; this hook adds the lookups, the delivery and the questions.
 */
export default function useCollectionSession(): CollectionSession {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const { scannedBooks, receipt } = useCollectionState();

  const overdueBooks = scannedBooks.filter((book) => isOverdue(book.deadline));

  const lookupMutation = useMutation({
    mutationFn: (blid: string) => client.api.bulkCollection.lookup({ params: { blid } }),
  });

  const collectMutation = useMutation({
    mutationFn: (customerItemIds: string[]) =>
      client.api.bulkCollection.collect({ body: { customerItemIds } }),
    onSuccess: (result) => {
      if (!result.success) {
        modals.open({
          title: "Kan ikke levere",
          children: <WarningAlert>{result.feedback}</WarningAlert>,
        });
        return;
      }
      updateCollection(() => ({ scannedBooks: [], receipt: result.receipt }));
      // The books are no longer on loan, so a customer or book left open elsewhere on the page
      // (and the holder badge in the book search) must not keep showing them as such.
      for (const key of [
        api.customerItems.getActiveCustomerItemsForCustomer.pathKey(),
        api.matches.getMatchesForCustomer.pathKey(),
        api.orderHistory.getForCustomer.pathKey(),
        api.orders.getPlacedOrders.pathKey(),
        api.blidSearch.lookup.pathKey(),
        BLID_SEARCH_QUERY_KEY,
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: () => showErrorNotification(GENERIC_ERROR_TEXT),
  });

  // Scanners keep running across many scans, so every check reads the store rather than this render
  const registerBlid = async (blid: string): Promise<ScanNotice | undefined> => {
    // A scan on the receipt screen starts the next batch; the receipt has no button for it.
    if (getCollection().receipt !== null) {
      scanMore();
    }
    if (getCollection().scannedBooks.some((book) => book.blid === blid)) {
      return { title: "Allerede registrert", message: "Boka ligger allerede i listen." };
    }
    let result;
    try {
      result = await lookupMutation.mutateAsync(blid);
    } catch {
      return { message: GENERIC_ERROR_TEXT };
    }
    if (!result.success) {
      return { message: result.feedback };
    }
    if (result.book.deliverToName !== undefined && !(await confirmPeerBook(result.book))) {
      return { message: "Boka ble ikke lagt i listen." };
    }
    addBook(result.book);
    return undefined;
  };

  const deliverNow = () => {
    collectMutation.mutate(getCollection().scannedBooks.map((book) => book.customerItemId));
  };

  const deliver = () => {
    if (overdueBooks.length > 0) {
      modals.openConfirmModal({
        title: "Utløpt frist",
        children: (
          <Stack gap="xs">
            <Text>
              {bookCountLabel(overdueBooks.length)} har utløpt frist. Er du sikker på at du vil
              levere?
            </Text>
            <MonitoringNotice />
          </Stack>
        ),
        labels: { confirm: "Lever", cancel: "Avbryt" },
        onConfirm: deliverNow,
      });
      return;
    }
    deliverNow();
  };

  return {
    scannedBooks,
    overdueBooks,
    receipt,
    isDelivering: collectMutation.isPending,
    registerBlid,
    removeBook: (blid) =>
      updateCollection((current) => ({
        ...current,
        scannedBooks: current.scannedBooks.filter((book) => book.blid !== blid),
      })),
    deliver,
    scanMore,
  };
}
