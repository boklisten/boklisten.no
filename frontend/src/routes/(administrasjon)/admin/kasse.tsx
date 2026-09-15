import { Container, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { ViewTransition, useDeferredValue, useEffect, useState } from "react";

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
import { KASSE_VIEW_CONFIG } from "@/features/kasse/kasseViews";
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
  // The router commits URL changes synchronously and <ViewTransition> only animates transitions,
  // so the page is drawn from a deferred copy of the view. Scans and store clean-up follow the URL.
  const shownView = useDeferredValue(view);
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

  const openCustomer = (detailsId: string) => void navigate({ search: showCustomer(detailsId) });
  const openBlid = (scanned: string) => void navigate({ search: showBlid(scanned) });
  const openInnsamling = () => void navigate({ search: showInnsamling() });
  const openEmpty = () => void navigate({ search: {} });
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

  const { scanTypes } = KASSE_VIEW_CONFIG[view];
  const routeCode: CodeHandler = async (code, via) => {
    const type = determineScanCodeType(code);
    if (type === "customerId") {
      scanner.closeScanner();
      openCustomer(code);
      return undefined;
    }
    if (view === "kunde") {
      // Every book code goes to the cart, which decides what it does and what it takes
      return cart.scan(code, via === "wedge" ? "wedge" : "camera");
    }
    if (type !== "blid") {
      return describeRejectedScan(type, scanTypes);
    }
    switch (view) {
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
  const camera: CodeChannel = { accepts: scanTypes, onCode: routeCode };
  // The physical scanner reads barcodes only: with a customer open whatever the cart takes right
  // now (the ISBN alone while a sticker it read waits to be linked), a sticker in every other view
  const wedge: CodeChannel = {
    accepts: view === "kunde" ? cart.scanTypes("wedge") : ["blid"],
    onCode: routeCode,
  };
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

  return (
    <Container>
      <Stack>
        <Stack gap={4}>
          <Title>{KASSE_TITLE}</Title>
          <Text c="dimmed">{KASSE_DESCRIPTION}</Text>
        </Stack>
        <KasseSearch onCode={(code) => void scanner.submitCode(code)} />
        <KasseControls
          view={shownView}
          onScan={scanner.openScanner}
          onOpenInnsamling={openInnsamling}
        >
          <KasseListBar
            view={shownView}
            cart={waitingStandCart}
            cartCustomerId={waitingCart?.customerId ?? null}
            onOpenCart={openCart}
            onOpenInnsamling={openInnsamling}
          />
        </KasseControls>
        {shownView === "kunde" && kunde !== undefined && (
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
        {shownView === "blid" && blid !== undefined && (
          <AdminBlidSearchResult blid={blid} onClear={() => void leaveToStart()} />
        )}
        {shownView === "innsamling" && (
          // Paired with the hero's Innsamling button, which grows into the card and shrinks back;
          // from any other view the card simply appears
          <ViewTransition
            name="kasse-innsamling"
            share="kasse-innsamling-card"
            enter="none"
            exit="none"
          >
            <CollectionView session={collection} onClose={() => void leaveToStart()} />
          </ViewTransition>
        )}
      </Stack>
      <KasseScannerModal
        opened={scanner.opened}
        view={view}
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
