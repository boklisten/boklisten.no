import { isFailureStatus } from "@boklisten/backend/shared/message-log";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import {
  Badge,
  Box,
  Combobox,
  Group,
  Indicator,
  InputBase,
  Tabs,
  Text,
  useCombobox,
} from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import CustomerMessagesView from "@/features/message-log/CustomerMessagesView";
import ActiveBooksView from "@/features/customer-search/ActiveBooksView";
import CustomerMatchesView, { peerMatches } from "@/features/customer-search/CustomerMatchesView";
import {
  CUSTOMER_SEARCH_TAB_META,
  CUSTOMER_SEARCH_TABS,
} from "@/features/customer-search/customerSearchTab";
import type { CustomerSearchTab } from "@/features/customer-search/customerSearchTab";
import CustomerOrderHistoryView from "@/features/customer-search/CustomerOrderHistoryView";
import { countStandBooksToHandOut } from "@/features/customer-search/handoutBooks";
import { isOverdue } from "@/features/bulk-collection/deadline";
import HandoutView from "@/features/customer-search/HandoutView";
import useApiClient from "@/shared/hooks/useApiClient";

const POLL_INTERVAL_MS = 5000;

interface TabEntry {
  tab: CustomerSearchTab;
  count: number;
  /** Something in the tab needs attention (an overdue book, a failed message). */
  alert: boolean;
}

/** The count stays gray — it is a total, not a problem count. Problems get a red dot on it. */
function CountBadge({ count, alert }: { count: number; alert: boolean }) {
  if (count === 0) {
    return null;
  }
  return (
    <Indicator color="red" size={7} offset={1} disabled={!alert}>
      <Badge size="sm" variant="light" color="gray" circle={count < 10}>
        {count}
      </Badge>
    </Indicator>
  );
}

function TabLabel({ entry }: { entry: TabEntry }) {
  return (
    <Group gap={6} wrap="nowrap" component="span" display="inline-flex">
      <Text span fz="inherit" fw="inherit">
        {CUSTOMER_SEARCH_TAB_META[entry.tab].label}
      </Text>
      <CountBadge count={entry.count} alert={entry.alert} />
    </Group>
  );
}

/** The tab row on wide screens (from md: narrower ones lose 200px to the sidebar): glyph, name and count. */
function TabRow({ entries }: { entries: TabEntry[] }) {
  return (
    <Tabs.List mb="md" visibleFrom="md">
      {entries.map((entry) => {
        const Icon = CUSTOMER_SEARCH_TAB_META[entry.tab].icon;
        return (
          <Tabs.Tab key={entry.tab} value={entry.tab} leftSection={<Icon size={16} aria-hidden />}>
            <TabLabel entry={entry} />
          </Tabs.Tab>
        );
      })}
    </Tabs.List>
  );
}

/**
 * The same choice on a narrow screen, where the tabs never fit on one row: a select that shows the open
 * view with its glyph and count, and lists the others the same way when opened.
 */
function TabSelect({
  entries,
  current,
  onChange,
}: {
  entries: TabEntry[];
  current: CustomerSearchTab;
  onChange: (tab: CustomerSearchTab) => void;
}) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const currentEntry = entries.find((entry) => entry.tab === current) ?? entries[0];
  if (currentEntry === undefined) {
    return null;
  }
  const CurrentIcon = CUSTOMER_SEARCH_TAB_META[currentEntry.tab].icon;

  return (
    <Box hiddenFrom="md" mb="md">
      <Combobox
        store={combobox}
        onOptionSubmit={(value) => {
          onChange(CUSTOMER_SEARCH_TABS.find((tab) => tab === value) ?? "bestillinger");
          combobox.closeDropdown();
        }}
      >
        <Combobox.Target>
          <InputBase
            component="button"
            type="button"
            pointer
            size="md"
            aria-label="Visning"
            leftSection={<CurrentIcon size={18} aria-hidden />}
            rightSection={<Combobox.Chevron />}
            rightSectionPointerEvents="none"
            onClick={() => combobox.toggleDropdown()}
            fw={500}
          >
            <TabLabel entry={currentEntry} />
          </InputBase>
        </Combobox.Target>
        <Combobox.Dropdown>
          <Combobox.Options>
            {entries.map((entry) => {
              const Icon = CUSTOMER_SEARCH_TAB_META[entry.tab].icon;
              const active = entry.tab === currentEntry.tab;
              return (
                <Combobox.Option key={entry.tab} value={entry.tab} active={active} py="sm">
                  <Group gap="sm" wrap="nowrap">
                    <Icon size={18} aria-hidden />
                    <Box flex={1}>
                      <TabLabel entry={entry} />
                    </Box>
                    {active && <IconCheck size={16} aria-hidden />}
                  </Group>
                </Combobox.Option>
              );
            })}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </Box>
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
  const hasOverdue = (activeBooks ?? []).some((book) => isOverdue(String(book.deadline)));
  // The badge counts problems, not traffic: a full message count would always be noise here.
  const failedMessages = (messageLog?.entries ?? []).filter((entry) =>
    isFailureStatus(entry.status),
  ).length;

  // Most customers have no peer exchanges at all; an empty tab is just noise for them.
  const showMatches = matchCount > 0;
  const currentTab = activeTab === "overleveringer" && !showMatches ? "bestillinger" : activeTab;

  const entries: TabEntry[] = [
    { tab: "bestillinger", count: toHandOut, alert: false },
    { tab: "boker", count: bookCount, alert: hasOverdue },
    ...(showMatches ? [{ tab: "overleveringer" as const, count: matchCount, alert: false }] : []),
    { tab: "meldinger", count: failedMessages, alert: failedMessages > 0 },
    // No count: a history total is neither a task nor a problem.
    { tab: "ordrehistorikk", count: 0, alert: false },
  ];

  const changeTab = (value: string | null) =>
    onTabChange(CUSTOMER_SEARCH_TABS.find((tab) => tab === value) ?? "bestillinger");

  return (
    <Tabs value={currentTab} keepMounted={false} onChange={changeTab}>
      <TabRow entries={entries} />
      <TabSelect entries={entries} current={currentTab} onChange={changeTab} />

      {/* Kept mounted so the scan-progress ticks survive a visit to another tab. */}
      <Tabs.Panel value="bestillinger" keepMounted>
        <HandoutView customer={customer} />
      </Tabs.Panel>
      <Tabs.Panel value="boker">
        <ActiveBooksView customer={customer} />
      </Tabs.Panel>
      <Tabs.Panel value="overleveringer">
        <CustomerMatchesView customerId={customer.id} />
      </Tabs.Panel>
      <Tabs.Panel value="meldinger">
        <CustomerMessagesView customer={customer} />
      </Tabs.Panel>
      <Tabs.Panel value="ordrehistorikk">
        <CustomerOrderHistoryView customerId={customer.id} />
      </Tabs.Panel>
    </Tabs>
  );
}
