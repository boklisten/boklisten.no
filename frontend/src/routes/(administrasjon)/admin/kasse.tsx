import { Container, Group, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import LegacyAppLink from "@/features/auth-linker/LegacyAppLink";
import AdminBlidSearchResult from "@/features/blid-search/AdminBlidSearchResult";
import CollectionSearch from "@/features/bulk-collection/CollectionSearch";
import CollectionView from "@/features/bulk-collection/CollectionView";
import useCollectionSession from "@/features/bulk-collection/useCollectionSession";
import type { CustomerSearchTab } from "@/features/customer-search/customerSearchTab";
import CustomerResult from "@/features/kasse/CustomerResult";
import KasseControls from "@/features/kasse/KasseControls";
import KasseModeControl from "@/features/kasse/KasseModeControl";
import { KASSE_DESCRIPTION, KASSE_TITLE } from "@/features/kasse/kasseDescription";
import { KASSE_MODE_CONFIG } from "@/features/kasse/kasseModes";
import type { KasseMode } from "@/features/kasse/kasseModes";
import {
  showBookSearch,
  showCustomerSearch,
  validateKasseSearch,
} from "@/features/kasse/kasseParams";
import useKasseScanner from "@/features/kasse/useKasseScanner";
import type { CodeChannel, CodeHandler } from "@/features/kasse/useKasseScanner";
import useStandCart from "@/features/stand-cart/useStandCart";
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
  const cart = useStandCart(kunde ?? null);
  const config = KASSE_MODE_CONFIG[mode];

  const selectMode = (next: KasseMode) =>
    void navigate({ search: (previous) => ({ ...previous, modus: next }) });
  const showCustomer = (detailsId: string) =>
    void navigate({ search: showCustomerSearch(detailsId) });
  const showBlid = (scanned: string) => void navigate({ search: showBookSearch(scanned) });
  // Deselecting the customer ends the visit: whatever was in their cart is dropped with them
  const clearCustomer = () => {
    cart.clear();
    void navigate({
      search: (previous) => ({ ...previous, kunde: undefined, visning: undefined }),
    });
  };
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
  // The physical scanner reads barcodes only, so in Kunde mode a book is the most it can offer:
  // it goes into the customer's cart, or looks the book up while no customer is on screen. A
  // sticker it scanned that is on no book yet makes it an ISBN reader until the link is done.
  const wedgeInKunde = (): CodeChannel => {
    if (kunde === undefined) {
      return { accepts: ["blid"], onCode: showBlid };
    }
    if (cart.cart.linking?.via === "wedge") {
      return { accepts: ["isbn"], onCode: cart.proposeLink };
    }
    return { accepts: ["blid"], onCode: (scanned) => cart.addBlid(scanned, "wedge") };
  };
  const wedge: Record<KasseMode, CodeChannel | undefined> = {
    kunde: wedgeInKunde(),
    boksok: undefined,
    innsamling: undefined,
  };
  const scanner = useKasseScanner(config, codeHandlers[mode], wedge[mode]);

  const compact: Record<KasseMode, boolean> = {
    kunde: kunde !== undefined,
    boksok: blid !== undefined,
    innsamling: collection.scannedBooks.length > 0 || collection.receipt !== null,
  };

  return (
    <Container>
      <Stack>
        <Stack gap={4}>
          <Group gap="xs">
            <Title>{KASSE_TITLE}</Title>
            <LegacyAppLink path="cart" label="Gå til gammel handlekurv" />
          </Group>
          <Text c="dimmed">{KASSE_DESCRIPTION}</Text>
        </Stack>
        <KasseModeControl value={mode} onChange={selectMode} />
        {mode === "innsamling" && (
          <CollectionSearch onSelectBook={(scanned) => void scanner.submitCode(scanned)} />
        )}
        <KasseControls
          compact={compact[mode]}
          icon={config.icon}
          instruction={config.description}
          scanLabel={config.scanLabel}
          accepts={config.accepts}
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
