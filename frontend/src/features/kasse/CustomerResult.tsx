import { Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import CustomerSearchTabs from "@/features/customer-search/CustomerSearchTabs";
import type { CustomerSearchTab } from "@/features/customer-search/CustomerSearchTabs";
import EmailConfirmationWarning from "@/features/customer-search/EmailConfirmationWarning";
import SelectedCustomerCard from "@/features/customer-search/SelectedCustomerCard";
import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";

/** The customer half of a Kasse lookup: who they are, what needs attention, and their books. */
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
    <Stack>
      <Stack gap={6}>
        <Text fz="sm" fw={500} c="dimmed">
          Valgt kunde
        </Text>
        <SelectedCustomerCard customer={customer} onDeselect={onDeselect} onMerged={onMerged} />
      </Stack>
      <EmailConfirmationWarning customer={customer} />
      <SignatureStatusBanner userDetail={customer} />
      <CustomerSearchTabs
        key={customer.id}
        customer={customer}
        activeTab={tab}
        onTabChange={onTabChange}
      />
    </Stack>
  );
}
