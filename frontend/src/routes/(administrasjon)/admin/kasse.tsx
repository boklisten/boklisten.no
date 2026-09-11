import { Container, Group, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import LegacyAppLink from "@/features/auth-linker/LegacyAppLink";
import AdminBlidSearchResult from "@/features/blid-search/AdminBlidSearchResult";
import CollectionView from "@/features/bulk-collection/CollectionView";
import {
  clearReceipt,
  clearScannedBooks,
  getCollection,
} from "@/features/bulk-collection/collectionStore";
import confirmDiscardBatch from "@/features/bulk-collection/confirmDiscardBatch";
import confirmDropBatch from "@/features/bulk-collection/confirmDropBatch";
import useCollectionSession from "@/features/bulk-collection/useCollectionSession";
import type { CustomerSearchTab } from "@/features/customer-search/customerSearchTab";
import CustomerResult from "@/features/kasse/CustomerResult";
import KasseControls from "@/features/kasse/KasseControls";
import KasseListBar from "@/features/kasse/KasseListBar";
import KasseScannerModal from "@/features/kasse/KasseScannerModal";
import KasseSearch from "@/features/kasse/KasseSearch";
import { KASSE_DESCRIPTION, KASSE_TITLE } from "@/features/kasse/kasseDescription";
import {
  resolveKasseView,
  showBlid,
  showCustomer,
  showInnsamling,
  validateKasseSearch,
} from "@/features/kasse/kasseParams";
import { KASSE_ACCEPTS, KASSE_VIEW_CONFIG } from "@/features/kasse/kasseViews";
import useKasseScanner from "@/features/kasse/useKasseScanner";
import type { CodeChannel, CodeHandler } from "@/features/kasse/useKasseScanner";
import StandCartBar from "@/features/stand-cart/StandCartBar";
import StandCartGuard from "@/features/stand-cart/StandCartGuard";
import confirmDropCart, { confirmDiscardCart } from "@/features/stand-cart/confirmDropCart";
import { forget, useWaitingStandCart } from "@/features/stand-cart/standCartStore";
import useStandCart from "@/features/stand-cart/useStandCart";
import { seo } from "@/shared/utils/seo";
import { showSuccessNotification } from "@/shared/utils/notifications";
import { describeRejectedScan, determineScanCodeType } from "@/shared/utils/scanCodes";

export const Route = createFileRoute("/(administrasjon)/admin/kasse")({
  validateSearch: validateKasseSearch,
  head: () =>
    seo({
      title: `${KASSE_TITLE} | bl-admin`,
    }),
  component: KassePage,
});

/** The camera opens by itself only where there is no barcode reader: on touch devices. */
const coarsePointer = () => window.matchMedia("(pointer: coarse)").matches;

/**
 * Kasse holds at most one list with something in it: a customer's cart or the Innsamling batch. A
 * book about to go into a cart while the batch has books asks first; yes throws the batch away.
 * Reads the store directly, so it can wrap the page and reach every add inside it.
 */
async function dropBatchBeforeAdd(): Promise<boolean> {
  const scanned = getCollection().scannedBooks.length;
  if (scanned === 0) {
    return true;
  }
  const confirmed = await confirmDropBatch(scanned);
  if (confirmed) {
    clearScannedBooks();
  }
  return confirmed;
}

function KassePage() {
  return (
    <StandCartGuard beforeAdd={dropBatchBeforeAdd}>
      <KasseContent />
    </StandCartGuard>
  );
}

/**
 * The URL says which view is open — nothing, a customer, a book's history or the Innsamling — so
 * the browser's back button retraces the employee's steps and links from elsewhere (including the
 * legacy bl-admin) open straight into the right one. What a scanned or picked code does is decided
 * by the open view, never by a control: a customer ID opens the customer, a book opens its history,
 * goes into the open customer's cart, or joins the batch.
 */
function KasseContent() {
  const search = Route.useSearch();
  const { kunde, blid, visning } = search;
  const view = resolveKasseView(search);
  const navigate = Route.useNavigate();
  const collection = useCollectionSession();
  const cart = useStandCart(kunde ?? null);
  const waitingCart = useWaitingStandCart();
  // The cart follows the employee: whoever it belongs to, the bar shows it and can open it
  const waitingStandCart = useStandCart(waitingCart?.customerId ?? null);
  const [cartOpen, setCartOpen] = useState(false);

  // The start screen holds nothing: whoever arrives there, by any route, starts afresh. The
  // receipt belongs to the Innsamling view: leaving it, by any route, is done reading it.
  useEffect(() => {
    if (view === "empty") {
      forget();
      clearScannedBooks();
    }
    if (view !== "innsamling") {
      clearReceipt();
    }
  }, [view]);

  // Leaving or returning to the hero animates (the buttons glide into the sticky row, the
  // Innsamling entry grows into its card); between the other views a cut is calmer.
  const viewTransition = view === "empty";
  const openCustomer = (detailsId: string) =>
    void navigate({ search: showCustomer(detailsId), viewTransition });
  const openBlid = (scanned: string) =>
    void navigate({ search: showBlid(scanned), viewTransition });
  // The types let the stylesheet hide the Innsamling button while its box is card-sized
  const openInnsamling = () =>
    void navigate({
      search: showInnsamling(),
      viewTransition: viewTransition ? { types: ["kasse-grow"] } : false,
    });
  const openEmpty = () =>
    void navigate({
      search: {},
      viewTransition: view === "innsamling" ? { types: ["kasse-shrink"] } : true,
    });
  const selectTab = (tab: CustomerSearchTab) =>
    void navigate({
      search: (previous) => ({ ...previous, visning: tab === "bestillinger" ? undefined : tab }),
      replace: true,
    });

  /** Every view's cross: back to the start screen, which empties every list, so it asks first. */
  const leaveToStart = async () => {
    if (waitingCart !== null) {
      const { customerName, lines } = waitingCart.cart;
      if (!(await confirmDiscardCart(customerName, lines.length))) {
        return;
      }
    }
    const scanned = getCollection().scannedBooks.length;
    if (scanned > 0 && !(await confirmDiscardBatch(scanned))) {
      return;
    }
    openEmpty();
  };

  /** Brings the cart's customer on screen, then the cart on top of them. */
  const openCart = () => {
    if (waitingCart !== null && waitingCart.customerId !== kunde) {
      openCustomer(waitingCart.customerId);
    }
    // The drawer must not open behind the camera
    scanner.closeScanner();
    setCartOpen(true);
  };

  const routeCode: CodeHandler = async (code, via) => {
    const type = determineScanCodeType(code);
    if (type === "customerId") {
      scanner.closeScanner();
      openCustomer(code);
      return undefined;
    }
    if (type !== "blid") {
      return describeRejectedScan(type, KASSE_ACCEPTS);
    }
    switch (view) {
      case "kunde": {
        return cart.addBlid(code, via === "wedge" ? "wedge" : "camera");
      }
      case "innsamling": {
        // One list at a time: a cart with unpaid lines gives way, but only knowingly
        if (waitingCart !== null) {
          const { customerName, lines } = waitingCart.cart;
          const confirmed = await confirmDropCart({
            customerName,
            lineCount: lines.length,
            destination: "batch",
          });
          if (!confirmed) {
            return { message: "Boka ble ikke lagt i listen." };
          }
          forget();
        }
        const notice = await collection.registerBlid(code);
        if (notice === undefined) {
          showSuccessNotification("Boka er lagt i listen");
        }
        return notice;
      }
      default: {
        scanner.closeScanner();
        openBlid(code);
        return undefined;
      }
    }
  };
  const camera: CodeChannel = { accepts: KASSE_ACCEPTS, onCode: routeCode };
  // The physical scanner reads barcodes only: a book in every view, and the ISBN while a sticker
  // it scanned is waiting to be linked to one.
  const wedge: CodeChannel =
    view === "kunde" && cart.cart.linking?.via === "wedge"
      ? { accepts: ["isbn"], onCode: cart.proposeLink }
      : { accepts: ["blid"], onCode: routeCode };
  const scanner = useKasseScanner(camera, wedge);

  // A link step the camera is to finish is shown in the camera, however the sticker arrived: a
  // search pick starts one while the camera is closed.
  const cameraLinking = view === "kunde" && cart.cart.linking?.via === "camera";
  const { openScanner } = scanner;
  useEffect(() => {
    if (cameraLinking) {
      openScanner();
    }
  }, [cameraLinking, openScanner]);

  // The camera opens by itself only as the result of this press, and only where there is no reader
  const startInnsamling = () => {
    openInnsamling();
    if (coarsePointer()) {
      scanner.openScanner();
    }
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
        <KasseSearch onCode={(code) => void scanner.submitCode(code)} />
        <KasseControls view={view} onScan={scanner.openScanner} onOpenInnsamling={startInnsamling}>
          <KasseListBar
            view={view}
            cart={waitingStandCart}
            cartCustomerId={waitingCart?.customerId ?? null}
            onOpenCart={openCart}
            onOpenInnsamling={openInnsamling}
          />
        </KasseControls>
        {view === "kunde" && kunde !== undefined && (
          <CustomerResult
            detailsId={kunde}
            cart={cart}
            tab={visning ?? "bestillinger"}
            onTabChange={selectTab}
            onDeselect={() => void leaveToStart()}
            // The merged-away customer is gone, so their cart goes with them without a question
            onMerged={(toDetailsId) => {
              forget();
              openCustomer(toDetailsId);
            }}
            cartOpened={cartOpen}
            onCartClose={() => setCartOpen(false)}
          />
        )}
        {view === "blid" && blid !== undefined && (
          <AdminBlidSearchResult blid={blid} onClear={() => void leaveToStart()} />
        )}
        {view === "innsamling" && (
          <CollectionView session={collection} onClose={() => void leaveToStart()} />
        )}
      </Stack>
      <KasseScannerModal
        opened={scanner.opened}
        defaultType={KASSE_VIEW_CONFIG[view].defaultScanType}
        onClose={scanner.closeScanner}
        onCode={routeCode}
        cart={view === "kunde" ? cart : null}
        footer={
          waitingCart === null ? null : (
            <StandCartBar
              cart={waitingStandCart}
              customer={{
                detailsId: waitingCart.customerId,
                name: waitingStandCart.cart.customerName,
                // Following the name leaves the camera behind
                onFollow: scanner.closeScanner,
              }}
              onOpen={openCart}
            />
          )
        }
      />
    </Container>
  );
}
