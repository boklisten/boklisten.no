import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Container, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import CustomerActionBar from "@/features/customer-search/CustomerActionBar";
import CustomerPicker from "@/features/customer-search/CustomerPicker";
import CustomerSearchSpotlight from "@/features/customer-search/CustomerSearchSpotlight";
import EmailConfirmationWarning from "@/features/customer-search/EmailConfirmationWarning";
import CustomerSearchTabs, {
  CUSTOMER_SEARCH_TABS,
  type CustomerSearchTab,
} from "@/features/customer-search/CustomerSearchTabs";
import SelectedCustomerCard from "@/features/customer-search/SelectedCustomerCard";
import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { seo } from "@/shared/utils/seo";

type CustomerSearchParams = {
  kunde?: string;
  visning?: CustomerSearchTab;
};

function parseTab(value: unknown): CustomerSearchTab | undefined {
  return CUSTOMER_SEARCH_TABS.find((tab) => tab === value);
}

export const Route = createFileRoute("/(administrasjon)/admin/kundesok")({
  validateSearch: (search: Record<string, unknown>): CustomerSearchParams => ({
    kunde:
      typeof search["kunde"] === "string" && search["kunde"] !== "" ? search["kunde"] : undefined,
    visning: parseTab(search["visning"]),
  }),
  head: () =>
    seo({
      title: "Kundesøk | bl-admin",
    }),
  component: CustomerSearchPage,
});

function CustomerSearchPage() {
  const { kunde, visning } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { api } = useApiClient();
  const {
    data: customer,
    isPending,
    isError,
  } = useQuery(
    api.userDetail.getById.queryOptions(
      { params: { detailsId: kunde ?? "" } },
      { enabled: kunde !== undefined },
    ),
  );

  const deselect = () => void navigate({ search: {} });
  const selectCustomer = (userDetail: UserDetail) =>
    void navigate({ search: { kunde: userDetail.id } });
  const selectTab = (tab: CustomerSearchTab) =>
    void navigate({
      search: (previous) => ({ ...previous, visning: tab === "bestillinger" ? undefined : tab }),
      replace: true,
    });

  const loading = kunde !== undefined && !isError && isPending;
  const notFound = kunde !== undefined && !isPending && (isError || !customer);

  return (
    <Container>
      <Stack>
        <Title>Kundesøk</Title>
        <CustomerSearchSpotlight onSelect={selectCustomer} />
        {kunde === undefined && <CustomerPicker onSelect={selectCustomer} />}
        {loading && (
          <Stack>
            <Skeleton height={110} radius={"md"} />
            <Skeleton height={200} radius={"md"} />
          </Stack>
        )}
        {notFound && (
          <>
            <ErrorAlert>Fant ikke kunden. Velg en annen kunde for å fortsette.</ErrorAlert>
            <CustomerPicker onSelect={selectCustomer} />
          </>
        )}
        {kunde !== undefined && customer && (
          <Stack>
            <CustomerActionBar onSelect={selectCustomer} />
            <Stack gap={6}>
              <Text fz={"sm"} fw={500} c={"dimmed"}>
                Valgt kunde
              </Text>
              <SelectedCustomerCard customer={customer} onDeselect={deselect} />
            </Stack>
            <EmailConfirmationWarning customer={customer} />
            <SignatureStatusBanner userDetail={customer} />
            <CustomerSearchTabs
              key={customer.id}
              customer={customer}
              activeTab={visning ?? "bestillinger"}
              onTabChange={selectTab}
            />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
