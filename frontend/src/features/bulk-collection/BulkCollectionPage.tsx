import type {
  CustomerCollectionReceipt,
  ScannedBook,
} from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Button, Container, InputLabel, Stack, Switch, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { IconForms, IconObjectScan } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import CollectionReceipt from "@/features/bulk-collection/CollectionReceipt";
import { isOverdue } from "@/features/bulk-collection/deadline";
import ScannedBooksTable from "@/features/bulk-collection/ScannedBooksTable";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import BlidScanner from "@/shared/components/scanner/BlidScanner";
import ManualBlidSearchModal from "@/shared/components/scanner/ManualBlidSearchModal";
import useApiClient from "@/shared/hooks/useApiClient";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showInfoNotification } from "@/shared/utils/notifications";

const manualModalId = "bulk-collection-manual";

export default function BulkCollectionPage() {
  const { client } = useApiClient();
  const [showCamera, { toggle: toggleCamera }] = useDisclosure(true);
  const [scannedBooks, setScannedBooks] = useState<ScannedBook[]>([]);
  const [receipt, setReceipt] = useState<CustomerCollectionReceipt[] | null>(null);

  const unlockedBooks = scannedBooks.filter((book) => !book.lockedToMatch);

  const lookupMutation = useMutation({
    mutationFn: (blid: string) => client.api.bulkCollection.lookup({ params: { blid } }),
    onSuccess: (result) => {
      if (!result.success) {
        showErrorNotification(result.feedback);
        return;
      }
      setScannedBooks((previous) =>
        previous.some((book) => book.blid === result.book.blid)
          ? previous
          : [result.book, ...previous],
      );
    },
    onError: () => showErrorNotification(GENERIC_ERROR_TEXT),
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

  const registerBlid = async (blid: string) => {
    if (scannedBooks.some((book) => book.blid === blid)) {
      showInfoNotification("Boken er allerede registrert.");
      return;
    }
    // Errors are surfaced via the mutation's onError handler.
    await lookupMutation.mutateAsync(blid).catch(() => undefined);
  };

  const openManualEntry = () => {
    modals.open({
      modalId: manualModalId,
      title: "Manuell registrering",
      children: (
        <ManualBlidSearchModal
          onSubmit={(blid) => {
            modals.close(manualModalId);
            void registerBlid(blid);
          }}
        />
      ),
    });
  };

  const deliver = () => {
    collectMutation.mutate(unlockedBooks.map((book) => book.customerItemId));
  };

  const handleDeliverClick = () => {
    if (unlockedBooks.some((book) => isOverdue(book.deadline))) {
      modals.openConfirmModal({
        title: "Utløpt frist",
        children: "Noen av bøkene har utløpt frist! Er du sikker på at du vil levere?",
        labels: { confirm: "Lever", cancel: "Avbryt" },
        onConfirm: deliver,
      });
      return;
    }
    deliver();
  };

  const removeBook = (blid: string) => {
    setScannedBooks((previous) => previous.filter((book) => book.blid !== blid));
  };

  const scanMore = () => {
    // Keep books that are locked to a match — they could not be delivered here.
    setScannedBooks((previous) => previous.filter((book) => book.lockedToMatch));
    setReceipt(null);
  };

  if (receipt) {
    return (
      <Container>
        <CollectionReceipt
          receipt={receipt}
          skippedLockedBooks={scannedBooks.filter((book) => book.lockedToMatch)}
          onScanMore={scanMore}
        />
      </Container>
    );
  }

  return (
    <Container>
      <Stack>
        <Title>Hurtiginnsamling</Title>

        <Switch checked={showCamera} onChange={toggleCamera} label={"Vis kamera"} />
        {showCamera && <BlidScanner onResult={registerBlid} />}

        <Button variant={"outline"} leftSection={<IconForms />} onClick={openManualEntry}>
          Skriv inn BL-ID manuelt
        </Button>

        {scannedBooks.length === 0 ? (
          <InfoAlert>Skann bøker for å legge dem til i listen.</InfoAlert>
        ) : (
          <Stack>
            <InputLabel>Bøker som skal leveres</InputLabel>
            <ScannedBooksTable books={scannedBooks} onRemove={removeBook} />
          </Stack>
        )}

        <Button
          color={"green"}
          leftSection={<IconObjectScan />}
          disabled={unlockedBooks.length === 0}
          loading={collectMutation.isPending}
          onClick={handleDeliverClick}
        >
          Lever {unlockedBooks.length} bøker
        </Button>
      </Stack>
    </Container>
  );
}
