import { isFailureStatus } from "@boklisten/backend/shared/message-log";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Badge, Group, Indicator, Tabs, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import CustomerMessagesView from "@/features/message-log/CustomerMessagesView";
import ActiveBooksView, { isOverdue } from "@/features/customer-search/ActiveBooksView";
import CustomerMatchesView, { peerMatches } from "@/features/customer-search/CustomerMatchesView";
import { countStandBooksToHandOut } from "@/features/customer-search/handoutBooks";
import HandoutView from "@/features/customer-search/HandoutView";
import useApiClient from "@/shared/hooks/useApiClient";

export const CUSTOMER_SEARCH_TABS = [
  "bestillinger",
  "boker",
  "overleveringer",
  "meldinger",
] as const;
export type CustomerSearchTab = (typeof CUSTOMER_SEARCH_TABS)[number];

const POLL_INTERVAL_MS = 5000;

/** Full labels are too wide for a phone tab row, so each tab also carries a short one. */
const TAB_LABELS: Record<CustomerSearchTab, { short: string; full: string }> = {
  bestillinger: { short: "Bestillinger", full: "Bestillinger" },
  boker: { short: "Bøker", full: "Kundens bøker" },
  overleveringer: { short: "Overleveringer", full: "Overleveringer" },
  meldinger: { short: "Meldinger", full: "Meldinger" },
};

function TabLabel({
  tab,
  count,
  alert,
}: {
  tab: CustomerSearchTab;
  count: number;
  alert?: boolean;
}) {
  return (
    <Group gap={6} wrap="nowrap" component="span" display="inline-flex">
      <Text span hiddenFrom="sm" fz="inherit">
        {TAB_LABELS[tab].short}
      </Text>
      <Text span visibleFrom="sm" fz="inherit">
        {TAB_LABELS[tab].full}
      </Text>
      {count > 0 && (
        // The count stays gray — it is a total, not a problem count. Overdue books get a red dot.
        <Indicator color="red" size={7} offset={1} disabled={!alert}>
          <Badge size="sm" variant="light" color="gray" circle={count < 10}>
            {count}
          </Badge>
        </Indicator>
      )}
    </Group>
  );
}

export default function CustomerSearchTabs({
  customer,
  activeTab,
  onTabChange,
}: {
  customer: UserDetail;
  activeTab: CustomerSearchTab;
  onTabChange: (tab: CustomerSearchTab) => void;
}) {
  const { api } = useApiClient();
  // The panels below fetch these same queries, so reading them here shares the React Query cache.
  // Polling lives here rather than only in the panels so the counts stay live on every tab.
  const { data: orders } = useQuery(
    api.orders.getPlacedOrders.queryOptions(
      { params: { detailsId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: matches } = useQuery(
    api.matches.getMatchesForCustomer.queryOptions(
      { params: { customerId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: activeBooks } = useQuery(
    api.customerItems.getActiveCustomerItemsForCustomer.queryOptions(
      { params: { detailsId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: messageLog } = useQuery(
    api.messageLogs.customerLog.queryOptions(
      { params: { detailsId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );

  const toHandOut = countStandBooksToHandOut(orders, matches, customer.id);
  const matchCount = peerMatches(matches).length;
  const bookCount = activeBooks?.length ?? 0;
  const hasOverdue = (activeBooks ?? []).some((book) => isOverdue(book.deadline));
  // The badge counts problems, not traffic: a full message count would always be noise here.
  const failedMessages = (messageLog?.entries ?? []).filter((entry) =>
    isFailureStatus(entry.status),
  ).length;

  // Most customers have no peer exchanges at all; an empty tab is just noise for them.
  const showMatches = matchCount > 0;
  const currentTab = activeTab === "overleveringer" && !showMatches ? "bestillinger" : activeTab;

  return (
    <Tabs
      value={currentTab}
      keepMounted={false}
      onChange={(value) =>
        onTabChange(CUSTOMER_SEARCH_TABS.find((tab) => tab === value) ?? "bestillinger")
      }
    >
      <Tabs.List mb="md">
        <Tabs.Tab value="bestillinger" px={{ base: 8, sm: "md" }}>
          <TabLabel tab="bestillinger" count={toHandOut} />
        </Tabs.Tab>
        <Tabs.Tab value="boker" px={{ base: 8, sm: "md" }}>
          <TabLabel tab="boker" count={bookCount} alert={hasOverdue} />
        </Tabs.Tab>
        {showMatches && (
          <Tabs.Tab value="overleveringer" px={{ base: 8, sm: "md" }}>
            <TabLabel tab="overleveringer" count={matchCount} />
          </Tabs.Tab>
        )}
        <Tabs.Tab value="meldinger" px={{ base: 8, sm: "md" }}>
          <TabLabel tab="meldinger" count={failedMessages} alert={failedMessages > 0} />
        </Tabs.Tab>
      </Tabs.List>

      {/* Kept mounted so the scan-progress ticks survive a visit to another tab. */}
      <Tabs.Panel value="bestillinger" keepMounted>
        <HandoutView customer={customer} />
      </Tabs.Panel>
      <Tabs.Panel value="boker">
        <ActiveBooksView customerId={customer.id} />
      </Tabs.Panel>
      <Tabs.Panel value="overleveringer">
        <CustomerMatchesView customerId={customer.id} />
      </Tabs.Panel>
      <Tabs.Panel value="meldinger">
        <CustomerMessagesView customer={customer} />
      </Tabs.Panel>
    </Tabs>
  );
}
