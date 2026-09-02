import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, InputLabel, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconKeyboard, IconPackageImport } from "@tabler/icons-react";

import CollectionReceipt from "@/features/bulk-collection/CollectionReceipt";
import ScannedBooksList from "@/features/bulk-collection/ScannedBooksList";
import type { CollectionSession } from "@/features/bulk-collection/useCollectionSession";
import { KASSE_CODE_TYPES } from "@/features/kasse/codeTypes";
import KasseControls from "@/features/kasse/KasseControls";
import useCodeResolver from "@/features/kasse/useCodeResolver";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import ManualCodeEntry from "@/shared/components/scanner/ManualCodeEntry";
import openScannerModal, { closeScannerModal } from "@/shared/components/scanner/openScannerModal";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { showSuccessNotification } from "@/shared/utils/notifications";

const MANUAL_MODAL_ID = "bulk-collection-manual";
const ADDED_MESSAGE = "Boka er lagt i listen";

function bookCountLabel(count: number): string {
  return `${count} ${count === 1 ? "bok" : "bøker"}`;
}

/**
 * Samle inn: every scanned book joins the list until the employee delivers them all in one go.
 * The camera modal stays open between scans. A customer's QR code scanned here opens that customer
 * instead — the list is kept, so the employee can come straight back to it.
 */
export default function CollectionView({
  session,
  onCustomer,
}: {
  session: CollectionSession;
  onCustomer: (customer: UserDetail) => void;
}) {
  const { resolveCode, resolveCodeOrNotify } = useCodeResolver({
    // The toast is the only visible change while the camera modal stays open, so it lives here
    // rather than on the scanner, which would also fire it for a scanned customer.
    onBlid: async (blid) => {
      const notice = await session.registerBlid(blid);
      if (notice === undefined) {
        showSuccessNotification(ADDED_MESSAGE);
      }
      return notice;
    },
    onCustomer: (customer) => {
      closeScannerModal();
      onCustomer(customer);
    },
  });
  useWedgeScanner({
    accepts: KASSE_CODE_TYPES,
    onScan: (code) => void resolveCodeOrNotify(code),
  });

  const { scannedBooks, overdueBooks, receipt } = session;

  const openScanner = () =>
    openScannerModal({
      title: "Skann bøker som leveres inn",
      keepOpen: true,
      accepts: KASSE_CODE_TYPES,
      instruction: { text: "Bokas unike ID (klistremerke)", illustrate: "blid" },
      onScan: resolveCode,
    });

  const openManualEntry = () => {
    modals.open({
      modalId: MANUAL_MODAL_ID,
      title: "Legg til bok manuelt",
      children: (
        <ManualCodeEntry
          // Typing a 24-character customer ID by hand is not a real workflow; keep the form about books.
          accepts={["blid"]}
          submitLabel="Legg til i listen"
          onSubmit={(code) => {
            modals.close(MANUAL_MODAL_ID);
            void resolveCodeOrNotify(code);
          }}
        />
      ),
    });
  };

  if (receipt) {
    return <CollectionReceipt receipt={receipt} onScanMore={session.scanMore} />;
  }

  return (
    <Stack>
      <KasseControls
        compact={scannedBooks.length > 0}
        icons={[IconPackageImport]}
        instruction="Skann bøkene som leveres inn"
        onScan={openScanner}
        secondary={{ label: "Skriv inn manuelt", icon: IconKeyboard, onClick: openManualEntry }}
        tips={["scanner"]}
      />

      {scannedBooks.length > 0 && (
        <>
          <Stack>
            <InputLabel>Bøker som skal leveres</InputLabel>
            <ScannedBooksList books={scannedBooks} onRemove={session.removeBook} />
          </Stack>

          {overdueBooks.length > 0 && (
            <WarningAlert title="Sjekk bøkene før levering">
              <Text>{bookCountLabel(overdueBooks.length)} har utløpt frist.</Text>
            </WarningAlert>
          )}

          <Button
            color="green"
            leftSection={<IconPackageImport />}
            disabled={scannedBooks.length === 0}
            loading={session.isDelivering}
            onClick={session.deliver}
          >
            Lever {scannedBooks.length} bøker
          </Button>
        </>
      )}
    </Stack>
  );
}
