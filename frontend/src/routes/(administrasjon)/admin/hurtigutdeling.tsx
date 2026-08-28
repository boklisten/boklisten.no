import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Container, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import CustomerActionBar from "@/features/rapid-handout/CustomerActionBar";
import CustomerPicker from "@/features/rapid-handout/CustomerPicker";
import CustomerSearchSpotlight from "@/features/rapid-handout/CustomerSearchSpotlight";
import EmailConfirmationWarning from "@/features/rapid-handout/EmailConfirmationWarning";
import RapidHandoutTabs, {
  RAPID_HANDOUT_TABS,
  type RapidHandoutTab,
} from "@/features/rapid-handout/RapidHandoutTabs";
import SelectedCustomerCard from "@/features/rapid-handout/SelectedCustomerCard";
import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { seo } from "@/shared/utils/seo";

type RapidHandoutSearch = {
  kunde?: string;
  visning?: RapidHandoutTab;
};

function parseTab(value: unknown): RapidHandoutTab | undefined {
  return RAPID_HANDOUT_TABS.find((tab) => tab === value);
}

export const Route = createFileRoute("/(administrasjon)/admin/hurtigutdeling")({
  validateSearch: (search: Record<string, unknown>): RapidHandoutSearch => ({
    kunde:
      typeof search["kunde"] === "string" && search["kunde"] !== "" ? search["kunde"] : undefined,
    visning: parseTab(search["visning"]),
  }),
  head: () =>
    seo({
      title: "Hurtigutdeling | bl-admin",
    }),
  component: RapidHandoutPage,
});

function RapidHandoutPage() {
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
  const selectTab = (tab: RapidHandoutTab) =>
    void navigate({
      search: (previous) => ({ ...previous, visning: tab === "bestillinger" ? undefined : tab }),
      replace: true,
    });

  const loading = kunde !== undefined && !isError && isPending;
  const notFound = kunde !== undefined && !isPending && (isError || !customer);

  return (
    <Container>
      <Stack>
        <Title>Hurtigutdeling</Title>
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
            <RapidHandoutTabs
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
