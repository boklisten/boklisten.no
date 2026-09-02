import type {
  CustomerCollectionReceipt,
  ScannedBook,
} from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { isOverdue } from "@/features/bulk-collection/deadline";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";
import { showErrorNotification } from "@/shared/utils/notifications";

export interface CollectionSession {
  scannedBooks: ScannedBook[];
  overdueBooks: ScannedBook[];
  receipt: CustomerCollectionReceipt[] | null;
  isDelivering: boolean;
  /** Resolves to a notice when the book did not join the list, so any scanner can show why. */
  registerBlid: (blid: string) => Promise<ScanNotice | undefined>;
  removeBook: (blid: string) => void;
  /** Asks for confirmation when a scanned book is past its deadline, then delivers. */
  deliver: () => void;
  /** Clears the receipt and the list, ready for the next batch. */
  scanMore: () => void;
}

// A book the customer is supposed to give to another student may still be collected here, but
// only after the employee has confirmed it.
function confirmPeerBook(book: ScannedBook): Promise<boolean> {
  return asyncConfirmModal({
    title: "Skal overleveres til en annen elev",
    children: (
      <Text size="sm">
        Denne boka skal {book.customerName} egentlig overlevere til{" "}
        <Text span fw={600}>
          {book.deliverToName}
        </Text>{" "}
        Er du sikker på at du vil ta den imot her?
      </Text>
    ),
    confirmLabel: "Ta imot likevel",
    confirmColor: "red",
  });
}

/**
 * The state of one return-delivery batch. Lives on the Kasse page rather than in the collection view
 * so the list survives a detour into a customer's page and back.
 */
export default function useCollectionSession(): CollectionSession {
  const { client } = useApiClient();
  const [scannedBooks, setScannedBooks] = useState<ScannedBook[]>([]);
  const [receipt, setReceipt] = useState<CustomerCollectionReceipt[] | null>(null);
  // The scanner modal captures registerBlid when it opens and stays open across many scans, so
  // the duplicate check must read the current list rather than the one from that render.
  const scannedBooksRef = useRef(scannedBooks);
  useEffect(() => {
    scannedBooksRef.current = scannedBooks;
  }, [scannedBooks]);

  const overdueBooks = scannedBooks.filter((book) => isOverdue(book.deadline));

  const addBook = (book: ScannedBook) => {
    setScannedBooks((previous) =>
      previous.some((existing) => existing.blid === book.blid) ? previous : [book, ...previous],
    );
  };

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
      setReceipt(result.receipt);
    },
    onError: () => showErrorNotification(GENERIC_ERROR_TEXT),
  });

  const registerBlid = async (blid: string): Promise<ScanNotice | undefined> => {
    if (scannedBooksRef.current.some((book) => book.blid === blid)) {
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
    collectMutation.mutate(scannedBooks.map((book) => book.customerItemId));
  };

  const deliver = () => {
    if (overdueBooks.length > 0) {
      modals.openConfirmModal({
        title: "Utløpt frist",
        children: "Noen av bøkene har utløpt frist! Er du sikker på at du vil levere?",
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
      setScannedBooks((previous) => previous.filter((book) => book.blid !== blid)),
    deliver,
    scanMore: () => {
      setScannedBooks([]);
      setReceipt(null);
    },
  };
}
