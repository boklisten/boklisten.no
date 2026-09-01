import type {
  CustomerCollectionReceipt,
  ScannedBook,
} from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import type { IScannerError } from "@yudiel/react-qr-scanner";
import { Box, Button, Container, InputLabel, Stack, Switch, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { IconForms, IconPackageImport } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import CollectionReceipt from "@/features/bulk-collection/CollectionReceipt";
import { isOverdue } from "@/features/bulk-collection/deadline";
import ScannedBooksList from "@/features/bulk-collection/ScannedBooksList";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import CameraErrorAlert from "@/shared/components/scanner/CameraErrorAlert";
import CameraScanner from "@/shared/components/scanner/CameraScanner";
import ManualCodeEntry from "@/shared/components/scanner/ManualCodeEntry";
import useApiClient from "@/shared/hooks/useApiClient";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showInfoNotification } from "@/shared/utils/notifications";

const manualModalId = "bulk-collection-manual";

function bookCountLabel(count: number): string {
  return `${count} ${count === 1 ? "bok" : "bøker"}`;
}

export default function BulkCollectionPage() {
  const { client } = useApiClient();
  const [showCamera, { toggle: toggleCamera }] = useDisclosure(true);
  const [scannedBooks, setScannedBooks] = useState<ScannedBook[]>([]);
  const [receipt, setReceipt] = useState<CustomerCollectionReceipt[] | null>(null);
  const [cameraError, setCameraError] = useState<IScannerError | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  const overdueBooks = scannedBooks.filter((book) => isOverdue(book.deadline));

  const addBook = (book: ScannedBook) => {
    setScannedBooks((previous) =>
      previous.some((existing) => existing.blid === book.blid) ? previous : [book, ...previous],
    );
  };

  // A book the customer is supposed to give to another student may still be collected here, but
  // only after the employee has confirmed it.
  const confirmPeerBook = (book: ScannedBook) => {
    modals.openConfirmModal({
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
      labels: { confirm: "Ta imot likevel", cancel: "Avbryt" },
      confirmProps: { color: "red" },
      onConfirm: () => addBook(book),
    });
  };

  const lookupMutation = useMutation({
    mutationFn: (blid: string) => client.api.bulkCollection.lookup({ params: { blid } }),
    onSuccess: (result) => {
      if (!result.success) {
        showErrorNotification(result.feedback);
        return;
      }
      if (result.book.deliverToName !== undefined) {
        confirmPeerBook(result.book);
        return;
      }
      addBook(result.book);
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
    await lookupMutation.mutateAsync(blid).catch(() => {});
  };

  const openManualEntry = () => {
    modals.open({
      modalId: manualModalId,
      title: "Manuell registrering",
      children: (
        <ManualCodeEntry
          accepts={["blid"]}
          onSubmit={(blid) => {
            modals.close(manualModalId);
            void registerBlid(blid);
          }}
        />
      ),
    });
  };

  const deliver = () => {
    collectMutation.mutate(scannedBooks.map((book) => book.customerItemId));
  };

  const handleDeliverClick = () => {
    if (overdueBooks.length > 0) {
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
    setScannedBooks([]);
    setReceipt(null);
  };

  if (receipt) {
    return (
      <Container>
        <CollectionReceipt receipt={receipt} onScanMore={scanMore} />
      </Container>
    );
  }

  return (
    <Container>
      <Stack>
        <Title>Hurtiginnsamling</Title>

        <Switch checked={showCamera} onChange={toggleCamera} label="Vis kamera" />
        {showCamera && (
          <Box maw={420} w="100%" mx="auto">
            {cameraError === null ? (
              <CameraScanner
                key={cameraAttempt}
                accepts={["blid"]}
                onCode={registerBlid}
                onCameraError={setCameraError}
              />
            ) : (
              <CameraErrorAlert
                error={cameraError}
                onRetry={() => {
                  setCameraError(null);
                  setCameraAttempt((attempt) => attempt + 1);
                }}
              />
            )}
          </Box>
        )}

        <Button variant="outline" leftSection={<IconForms />} onClick={openManualEntry}>
          Skriv inn BL-ID manuelt
        </Button>

        {scannedBooks.length === 0 ? (
          <InfoAlert>Skann bøker for å legge dem til i listen.</InfoAlert>
        ) : (
          <Stack>
            <InputLabel>Bøker som skal leveres</InputLabel>
            <ScannedBooksList books={scannedBooks} onRemove={removeBook} />
          </Stack>
        )}

        {overdueBooks.length > 0 && (
          <WarningAlert title="Sjekk bøkene før levering">
            <Text>{bookCountLabel(overdueBooks.length)} har utløpt frist.</Text>
          </WarningAlert>
        )}

        <Button
          color="green"
          leftSection={<IconPackageImport />}
          disabled={scannedBooks.length === 0}
          loading={collectMutation.isPending}
          onClick={handleDeliverClick}
        >
          Lever {scannedBooks.length} bøker
        </Button>
      </Stack>
    </Container>
  );
}
