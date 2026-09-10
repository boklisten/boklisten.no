import type { OrderManagerDetail } from "@boklisten/backend/shared/order_manager";
import { Badge, Button, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { IconArrowLeft, IconBasketPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import CustomerHeader from "@/features/customer-search/CustomerHeader";
import HandoutBooksTable from "@/features/customer-search/HandoutBooksTable";
import { openOrderRows } from "@/features/order-manager/openOrderRows";
import { describeOrderTime } from "@/features/order-manager/orderTime";
import { DeliverySection, PaymentsSection } from "@/features/order-history/OrderHistoryCard";
import { DeliveryBadge, PaymentStatusBadge } from "@/features/order-history/OrderStatusBadges";
import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import StandCartBar from "@/features/stand-cart/StandCartBar";
import StandCartDrawer from "@/features/stand-cart/StandCartDrawer";
import StandCartLinkModal from "@/features/stand-cart/StandCartLinkModal";
import StandCartScanButton, {
  closeStandCartScanner,
} from "@/features/stand-cart/StandCartScanButton";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import {
  showErrorNotification,
  showInfoNotification,
  showSuccessNotification,
} from "@/shared/utils/notifications";

/** The whole order goes in with one click; loans still wait for their scan before checkout. */
function AddAllButton({ cart, rows }: { cart: StandCart; rows: ReturnType<typeof openOrderRows> }) {
  const [adding, setAdding] = useState(false);
  const remaining = rows.filter((row) => !cart.has(row.key));

  async function addAll() {
    setAdding(true);
    try {
      const notices = [];
      for (const row of remaining) {
        if (row.cartSource !== null) {
          const notice = await cart.add(row.cartSource);
          if (notice) {
            notices.push(`${row.title}: ${notice.message}`);
          }
        }
      }
      if (notices.length > 0) {
        showErrorNotification({ title: "Noen bøker ble ikke lagt i", message: notices.join(" ") });
      } else {
        showSuccessNotification("Hele bestillingen er lagt i handlekurven");
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <Button
      variant="light"
      leftSection={<IconBasketPlus size={18} aria-hidden />}
      loading={adding}
      disabled={remaining.length === 0}
      onClick={() => void addAll()}
    >
      Legg alle i handlekurven
    </Button>
  );
}

/**
 * The selected order, packed on its own: the customer on top for the signature and contact
 * details, then how the order is to be delivered and paid, then the books still owed. Scans go
 * only to this order. Once it has nothing left to hand out, the page goes back to the queue.
 */
export default function OrderDetail({
  detail,
  cart,
  onBack,
  onRefresh,
}: {
  detail: OrderManagerDetail;
  cart: StandCart;
  onBack: () => void;
  /** Reloads the order; resolves to whether it still has a book to hand out. */
  onRefresh: () => Promise<boolean>;
}) {
  const { api } = useApiClient();
  const { order, customerId } = detail;
  const {
    data: customer,
    isPending,
    isError,
  } = useQuery(api.userDetail.getById.queryOptions({ params: { detailsId: customerId } }));
  const [cartOpen, setCartOpen] = useState(false);
  const rows = openOrderRows(order);

  async function closeCart() {
    setCartOpen(false);
    const stillOpen = await onRefresh();
    if (!stillOpen) {
      showInfoNotification("Bestillingen er ferdig utlevert");
      onBack();
    }
  }

  const backButton = (
    <Button
      variant="subtle"
      color="gray"
      size="compact-sm"
      leftSection={<IconArrowLeft size={16} aria-hidden />}
      onClick={onBack}
      style={{ alignSelf: "flex-start" }}
    >
      Tilbake til listen
    </Button>
  );

  if (isPending) {
    return (
      <Stack>
        {backButton}
        <Skeleton height={110} radius="md" />
        <Skeleton height={200} radius="md" />
      </Stack>
    );
  }
  if (isError || !customer) {
    return (
      <Stack>
        {backButton}
        <ErrorAlert>Fant ikke kunden bestillingen tilhører.</ErrorAlert>
      </Stack>
    );
  }

  return (
    // Room under the card for the floating cart bar, so the last rows are never hidden behind it
    <Stack gap="xs" pb={cart.isEmpty ? 0 : 80}>
      {backButton}
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <CustomerHeader
            customer={customer}
            withDeselect={false}
            linkToKasse
            onDeselect={onBack}
            onMerged={onBack}
          />
          <SignatureStatusBanner userDetail={customer} />
          <Stack gap={6}>
            <Group gap="xs" align="baseline" wrap="wrap">
              <Text fw={600}>Bestilt {describeOrderTime(order.creationTime)}</Text>
              <Badge variant="light" color="gray" tt="none" size="sm">
                {order.branch.name}
              </Badge>
              <DeliveryBadge order={order} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </Group>
            <DeliverySection order={order} />
            <PaymentsSection order={order} variant="admin" />
          </Stack>
          <Group gap="sm" wrap="wrap">
            <StandCartScanButton cart={cart} customerId={customer.id} orderId={order.id} />
            <AddAllButton cart={cart} rows={rows} />
          </Group>
          {rows.length === 0 ? (
            <InfoAlert>Alle bøkene på bestillingen er delt ut.</InfoAlert>
          ) : (
            // Beside the queue the table only fits on a wide desk; cards until then
            <HandoutBooksTable
              customerId={customer.id}
              rows={rows}
              onChanged={() => void onRefresh()}
              tableFrom="xl"
            />
          )}
        </Stack>
      </Paper>
      <StandCartBar
        cart={cart}
        onOpen={() => {
          // The bar floats above the scanner; the drawer must not open behind it
          closeStandCartScanner();
          setCartOpen(true);
        }}
      />
      <StandCartDrawer
        cart={cart}
        customer={customer}
        opened={cartOpen}
        onClose={() => void closeCart()}
      />
      <StandCartLinkModal cart={cart} />
    </Stack>
  );
}
