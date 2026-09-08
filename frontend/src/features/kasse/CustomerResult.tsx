import { Paper, Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import CustomerSearchTabs from "@/features/customer-search/CustomerSearchTabs";
import type { CustomerSearchTab } from "@/features/customer-search/customerSearchTab";
import EmailConfirmationWarning from "@/features/customer-search/EmailConfirmationWarning";
import CustomerHeader from "@/features/customer-search/CustomerHeader";
import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import StandCartBar from "@/features/stand-cart/StandCartBar";
import StandCartDrawer from "@/features/stand-cart/StandCartDrawer";
import StandCartLinkModal from "@/features/stand-cart/StandCartLinkModal";
import StandCartScanButton, {
  closeStandCartScanner,
} from "@/features/stand-cart/StandCartScanButton";
import useStandCart from "@/features/stand-cart/useStandCart";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";

/** The customer half of a Kasse lookup: who they are, what needs attention, their books, and the cart. */
export default function CustomerResult({
  detailsId,
  tab,
  onTabChange,
  onDeselect,
  onMerged,
}: {
  detailsId: string;
  tab: CustomerSearchTab;
  onTabChange: (tab: CustomerSearchTab) => void;
  onDeselect: () => void;
  onMerged: (toDetailsId: string) => void;
}) {
  const { api } = useApiClient();
  const {
    data: customer,
    isPending,
    isError,
  } = useQuery(api.userDetail.getById.queryOptions({ params: { detailsId } }));
  const cart = useStandCart(detailsId);
  const [cartOpen, setCartOpen] = useState(false);

  if (isPending) {
    return (
      <Stack>
        <Skeleton height={110} radius="md" />
        <Skeleton height={200} radius="md" />
      </Stack>
    );
  }
  if (isError || !customer) {
    return <ErrorAlert>Fant ikke kunden. Skann eller søk opp en annen kunde.</ErrorAlert>;
  }

  return (
    // Room under the card for the floating cart bar, so the last rows are never hidden behind it
    <Stack gap={6} pb={cart.isEmpty ? 0 : 80}>
      <Text fz="sm" fw={500} c="dimmed">
        Valgt kunde
      </Text>
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <CustomerHeader customer={customer} onDeselect={onDeselect} onMerged={onMerged} />
          <EmailConfirmationWarning customer={customer} />
          <SignatureStatusBanner userDetail={customer} />
          <StandCartScanButton cart={cart} customerId={customer.id} />
          <CustomerSearchTabs
            key={customer.id}
            customer={customer}
            activeTab={tab}
            onTabChange={onTabChange}
          />
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
        onClose={() => setCartOpen(false)}
      />
      <StandCartLinkModal cart={cart} />
    </Stack>
  );
}
