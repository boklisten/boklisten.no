import { Container, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import AdminBlidSearchResult from "@/features/blid-search/AdminBlidSearchResult";
import CollectionView from "@/features/bulk-collection/CollectionView";
import useCollectionSession from "@/features/bulk-collection/useCollectionSession";
import type { CustomerSearchTab } from "@/features/customer-search/customerSearchTab";
import CustomerResult from "@/features/kasse/CustomerResult";
import KasseControls from "@/features/kasse/KasseControls";
import KasseModeControl from "@/features/kasse/KasseModeControl";
import SearchSpotlight from "@/features/kasse/SearchSpotlight";
import { KASSE_DESCRIPTION, KASSE_TITLE } from "@/features/kasse/kasseDescription";
import { KASSE_MODE_CONFIG } from "@/features/kasse/kasseModes";
import type { KasseMode } from "@/features/kasse/kasseModes";
import {
  showBookSearch,
  showCustomerSearch,
  validateKasseSearch,
} from "@/features/kasse/kasseParams";
import useKasseScanner from "@/features/kasse/useKasseScanner";
import type { CodeHandler } from "@/features/kasse/useKasseScanner";
import { seo } from "@/shared/utils/seo";
import { showSuccessNotification } from "@/shared/utils/notifications";

export const Route = createFileRoute("/(administrasjon)/admin/kasse")({
  validateSearch: validateKasseSearch,
  head: () =>
    seo({
      title: `${KASSE_TITLE} | bl-admin`,
    }),
  component: KassePage,
});

/**
 * The mode and each mode's result live in the URL, so the browser's back button retraces the
 * employee's steps (customer → one of their books → back to the customer), links from elsewhere
 * open straight into the right mode, and the legacy bl-admin can deep-link into Innsamling. A
 * mode's result stays in the URL while another mode is active, so it is back on screen the moment
 * the employee returns.
 */
function KassePage() {
  const { kunde, blid, visning, modus: mode } = Route.useSearch();
  const navigate = Route.useNavigate();
  const collection = useCollectionSession();
  const config = KASSE_MODE_CONFIG[mode];

  const selectMode = (next: KasseMode) =>
    void navigate({ search: (previous) => ({ ...previous, modus: next }) });
  const showCustomer = (detailsId: string) =>
    void navigate({ search: showCustomerSearch(detailsId) });
  const showBlid = (scanned: string) => void navigate({ search: showBookSearch(scanned) });
  const clearCustomer = () =>
    void navigate({
      search: (previous) => ({ ...previous, kunde: undefined, visning: undefined }),
    });
  const clearBlid = () =>
    void navigate({ search: (previous) => ({ ...previous, blid: undefined }) });
  const selectTab = (tab: CustomerSearchTab) =>
    void navigate({
      search: (previous) => ({ ...previous, visning: tab === "bestillinger" ? undefined : tab }),
      replace: true,
    });

  const addToCollection: CodeHandler = async (scanned) => {
    const notice = await collection.registerBlid(scanned);
    if (notice === undefined) {
      showSuccessNotification("Boka er lagt i listen");
    }
    return notice;
  };
  const codeHandlers: Record<KasseMode, CodeHandler> = {
    kunde: showCustomer,
    boksok: showBlid,
    innsamling: addToCollection,
  };
  const scanner = useKasseScanner(mode, codeHandlers[mode]);

  const compact: Record<KasseMode, boolean> = {
    kunde: kunde !== undefined,
    boksok: blid !== undefined,
    innsamling: collection.scannedBooks.length > 0 || collection.receipt !== null,
  };

  return (
    <Container>
      <Stack>
        <Stack gap={4}>
          <Title>{KASSE_TITLE}</Title>
          <Text c="dimmed">{KASSE_DESCRIPTION}</Text>
        </Stack>
        <KasseModeControl value={mode} onChange={selectMode} />
        <SearchSpotlight kind={config.search} onSelect={(code) => void scanner.submitCode(code)} />
        <KasseControls
          compact={compact[mode]}
          icon={config.icon}
          instruction={config.description}
          scanLabel={config.scanLabel}
          onScan={scanner.openScanner}
        />
        {mode === "kunde" && kunde !== undefined && (
          <CustomerResult
            detailsId={kunde}
            tab={visning ?? "bestillinger"}
            onTabChange={selectTab}
            onDeselect={clearCustomer}
            onMerged={showCustomer}
          />
        )}
        {mode === "boksok" && blid !== undefined && (
          <AdminBlidSearchResult blid={blid} onClear={clearBlid} />
        )}
        {mode === "innsamling" && <CollectionView session={collection} />}
      </Stack>
    </Container>
  );
}
