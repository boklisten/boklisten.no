import { Container, Group, Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import AdminBlidSearchResult from "@/features/blid-search/AdminBlidSearchResult";
import CollectionView from "@/features/bulk-collection/CollectionView";
import useCollectionSession from "@/features/bulk-collection/useCollectionSession";
import type { CustomerSearchTab } from "@/features/customer-search/CustomerSearchTabs";
import CustomerResult from "@/features/kasse/CustomerResult";
import SearchControls from "@/features/kasse/SearchControls";
import KasseModeControl from "@/features/kasse/KasseModeControl";
import SearchSpotlight from "@/features/kasse/SearchSpotlight";
import { KASSE_DESCRIPTION, KASSE_TITLE } from "@/features/kasse/kasseDescription";
import { validateKasseSearch } from "@/features/kasse/kasseParams";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/kasse")({
  validateSearch: validateKasseSearch,
  head: () =>
    seo({
      title: `${KASSE_TITLE} | bl-admin`,
    }),
  component: KassePage,
});

/**
 * Every result is addressed by the URL, so the browser's back button retraces the employee's
 * steps: customer → one of their books → back to the customer, or collection → a customer → back
 * to the half-finished collection.
 */
function KassePage() {
  const { kunde, blid, visning, modus } = Route.useSearch();
  const navigate = Route.useNavigate();
  const collection = useCollectionSession();

  const showCustomer = (detailsId: string) => void navigate({ search: { kunde: detailsId } });
  const showBlid = (scanned: string) => void navigate({ search: { blid: scanned } });
  const clear = () => void navigate({ search: {} });
  const selectTab = (tab: CustomerSearchTab) =>
    void navigate({
      search: (previous) => ({ ...previous, visning: tab === "bestillinger" ? undefined : tab }),
      replace: true,
    });

  const mode = modus ?? "sok";
  const hasResult = kunde !== undefined || blid !== undefined;

  return (
    <Container>
      <Stack>
        <Stack gap={4}>
          <Title>{KASSE_TITLE}</Title>
          <Text c="dimmed">{KASSE_DESCRIPTION}</Text>
        </Stack>
        <Group>
          <KasseModeControl
            value={mode}
            // The open customer or book stays in the URL while collecting, so it is back on screen
            // the moment the employee returns to Søk.
            onChange={(next) =>
              void navigate({
                search: (previous) => ({
                  ...previous,
                  modus: next === "innsamling" ? "innsamling" : undefined,
                }),
              })
            }
          />
        </Group>
        <SearchSpotlight
          onSelectCustomer={(customer) => showCustomer(customer.id)}
          onSelectBlid={showBlid}
        />
        {mode === "innsamling" ? (
          <CollectionView
            session={collection}
            onCustomer={(customer) => showCustomer(customer.id)}
          />
        ) : (
          <>
            <SearchControls
              compact={hasResult}
              onBlid={showBlid}
              onCustomer={(customer) => showCustomer(customer.id)}
            />
            {kunde !== undefined && (
              <CustomerResult
                detailsId={kunde}
                tab={visning ?? "bestillinger"}
                onTabChange={selectTab}
                onDeselect={clear}
                onMerged={showCustomer}
              />
            )}
            {kunde === undefined && blid !== undefined && (
              <AdminBlidSearchResult blid={blid} onClear={clear} />
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
