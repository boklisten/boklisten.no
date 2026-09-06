import { BLID_SEARCH_PATTERN } from "@boklisten/backend/shared/blid_search";
import { Badge, Group, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Spotlight } from "@mantine/spotlight";
import type { createSpotlight } from "@mantine/spotlight";
import { IconBook2, IconMail, IconPhone, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import PermissionBadge from "@/features/customer-search/PermissionBadge";
import type { AdminPage } from "@/features/layout/adminNavigation";
import { searchPages } from "@/features/search/searchPages";
import useApiClient from "@/shared/hooks/useApiClient";

const MIN_SEARCH_LENGTH = 3;

type SpotlightStore = ReturnType<typeof createSpotlight>[0];

const customerQueryKey = (searchTerm: string) => ["userDetail", "search", searchTerm] as const;
/** Prefix of the book search cache, so a delivery can invalidate every cached term at once. */
export const BLID_SEARCH_QUERY_KEY = ["blidSearch", "search"] as const;
const blidQueryKey = (searchTerm: string) => [...BLID_SEARCH_QUERY_KEY, searchTerm] as const;

// Results for "pett" are still relevant while the user types "petter" (or backspaces), but when
// the term is replaced entirely the old results must not show while the new fetch is in flight.
const isRelatedSearch = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

// Mantine preselects the first action on every keystroke, but that runs before our async results
// have rendered, so the imperative data-selected attribute lands on stale DOM and Enter usually
// does nothing. Its selectAction helper is not exported, so mirror its DOM contract
// (data-action/data-selected) through the public store once the fresh list is in the DOM.
function selectFirstResult(store: SpotlightStore) {
  const { listId } = store.getState();
  // oxlint-disable-next-line unicorn/prefer-query-selector -- Mantine useId() ids contain colons, which are invalid in querySelector syntax
  const list = listId ? document.getElementById(listId) : null;
  if (!list) {
    return;
  }
  const selected = list.querySelector<HTMLElement>("[data-selected]");
  if (selected) {
    delete selected.dataset["selected"];
  }
  const first = list.querySelector<HTMLElement>("[data-action]");
  if (first) {
    first.dataset["selected"] = "true";
  }
  store.updateState((state) => ({ ...state, selected: first ? 0 : -1 }));
}

const PLACEHOLDERS = {
  customers: "Navn, telefon, e-post eller adresse",
  books: "Bokas unike ID",
  all: "Kunde eller bokas unike ID",
  withPages: "Side, kunde eller bokas unike ID",
} as const;

/**
 * The manual way in: customers match on name, phone, e-mail and address; books match on any part
 * of their unique ID. Searches one kind or both, and hands a pick's code (the customer's id or the
 * book's unique ID) to the caller. Given a list of pages it also matches those on title and
 * description from the first character, and lists them above everything else. Keyboard shortcuts
 * are bound elsewhere, so that a page can put its own instance in front of the global one.
 */
export default function SearchSpotlight({
  store,
  kinds,
  pages,
  onSelectCustomer,
  onSelectBook,
  onSelectPage,
}: {
  store: SpotlightStore;
  kinds: { customers: boolean; books: boolean };
  pages?: AdminPage[];
  onSelectCustomer?: (detailsId: string) => void;
  onSelectBook?: (blid: string) => void;
  onSelectPage?: (page: AdminPage) => void;
}) {
  const { api, client } = useApiClient();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue.trim(), 250);
  const trimmedSearch = searchValue.trim();
  // Gate on the raw value too, so clearing the query hides results instantly instead of after the
  // debounce delay.
  const searchActive =
    trimmedSearch.length >= MIN_SEARCH_LENGTH &&
    debouncedSearch.length >= MIN_SEARCH_LENGTH &&
    isRelatedSearch(trimmedSearch, debouncedSearch);
  const customerSearchActive = searchActive && kinds.customers;
  const blidSearchActive = searchActive && kinds.books && BLID_SEARCH_PATTERN.test(debouncedSearch);

  const { data: customers, isFetching: fetchingCustomers } = useQuery({
    queryKey: customerQueryKey(debouncedSearch),
    queryFn: async () =>
      (await client.api.userDetail.search({ body: { searchStr: debouncedSearch } })) ?? [],
    enabled: customerSearchActive,
    placeholderData: (previousData, previousQuery) => {
      const previousSearch = previousQuery?.queryKey.at(-1);
      return typeof previousSearch === "string" && isRelatedSearch(previousSearch, debouncedSearch)
        ? previousData
        : undefined;
    },
  });
  const { data: bookSearch, isFetching: fetchingBooks } = useQuery({
    queryKey: blidQueryKey(debouncedSearch),
    queryFn: () => client.api.blidSearch.search({ query: { q: debouncedSearch } }),
    enabled: blidSearchActive,
    placeholderData: (previousData, previousQuery) => {
      const previousSearch = previousQuery?.queryKey.at(-1);
      return typeof previousSearch === "string" && isRelatedSearch(previousSearch, debouncedSearch)
        ? previousData
        : undefined;
    },
  });
  const isFetching = fetchingCustomers || fetchingBooks;

  const { data: branches } = useQuery({
    ...api.branches.getAll.queryOptions(),
    enabled: kinds.customers,
  });
  const branchNames = new Map((branches ?? []).map((branch) => [branch.id, branch.name]));

  // Pages are local data, so they match on every keystroke without the debounce or the length gate.
  const pageHits = useMemo(
    () => (pages ? searchPages(pages, trimmedSearch) : []),
    [pages, trimmedSearch],
  );
  const customerHits = customerSearchActive ? (customers ?? []) : [];
  const bookHits = blidSearchActive ? (bookSearch?.hits ?? []) : [];
  const moreBooks = blidSearchActive && bookSearch?.hasMore === true;
  const nothingFound =
    searchActive &&
    !isFetching &&
    pageHits.length === 0 &&
    customerHits.length === 0 &&
    bookHits.length === 0;
  const searchedForKinds = [
    ...(pages ? ["sider"] : []),
    ...(kinds.customers ? ["kunder"] : []),
    ...(kinds.books ? ["bøker"] : []),
  ];
  const searchedFor =
    searchedForKinds.length > 1
      ? `${searchedForKinds.slice(0, -1).join(", ")} eller ${searchedForKinds.at(-1)}`
      : searchedForKinds[0];

  useEffect(() => {
    if (pageHits.length > 0 || (customers?.length ?? 0) > 0 || (bookSearch?.hits.length ?? 0) > 0) {
      selectFirstResult(store);
    }
  }, [pageHits, customers, bookSearch, store]);

  // The modal's exit transition is interrupted by the navigation a pick triggers, so Mantine's
  // clearQueryOnClose (which runs onExited) never fires — clear ourselves.
  const pickCustomer = (detailsId: string) => {
    setSearchValue("");
    onSelectCustomer?.(detailsId);
  };
  const pickBook = (blid: string) => {
    setSearchValue("");
    onSelectBook?.(blid);
  };
  const pickPage = (page: AdminPage) => {
    setSearchValue("");
    onSelectPage?.(page);
  };

  const pageActions = pageHits.map((page) => {
    const PageIcon = page.icon;
    return (
      <Spotlight.Action key={page.to} onClick={() => pickPage(page)}>
        <Group gap="sm" wrap="nowrap" w="100%">
          <ThemeIcon variant="light" radius="xl" size="lg">
            <PageIcon size={18} aria-hidden />
          </ThemeIcon>
          <Stack gap={2} miw={0} style={{ flex: 1 }}>
            <Text fw={600} lineClamp={1}>
              {page.label}
            </Text>
            <Text size="sm" opacity={0.7} lineClamp={1}>
              {page.description}
            </Text>
          </Stack>
          {page.group && (
            <Badge variant="light" color="gray" tt="none" visibleFrom="xs">
              {page.group}
            </Badge>
          )}
        </Group>
      </Spotlight.Action>
    );
  });

  const customerActions = customerHits.map((userDetail) => (
    <Spotlight.Action key={userDetail.id} onClick={() => pickCustomer(userDetail.id)}>
      <Stack gap={4} w="100%">
        <Group gap="xs" justify="space-between">
          <Text fw={600}>{userDetail.name}</Text>
          <Group gap={6}>
            <PermissionBadge permission={userDetail.permission} size="sm" />
            {userDetail.branchMembership && branchNames.has(userDetail.branchMembership) && (
              <Badge variant="light" size="sm">
                {branchNames.get(userDetail.branchMembership)}
              </Badge>
            )}
          </Group>
        </Group>
        <Group gap="md" fz="sm" opacity={0.7}>
          {userDetail.phone && (
            <Group gap={4}>
              <IconPhone size={16} aria-hidden />
              <Text size="sm">{userDetail.phone}</Text>
            </Group>
          )}
          {userDetail.email && (
            <Group gap={4}>
              <IconMail size={16} aria-hidden />
              <Text size="sm">{userDetail.email}</Text>
            </Group>
          )}
        </Group>
      </Stack>
    </Spotlight.Action>
  ));
  // Plain text, not an action, so the arrow keys skip it.
  const moreBooksHint = moreBooks && (
    <Text key="more-books" size="sm" opacity={0.7} px="md" py="xs">
      Viser de {bookHits.length} første treffene. Skriv mer av IDen for å snevre inn.
    </Text>
  );
  const bookActions = bookHits.map((book) => (
    <Spotlight.Action key={book.blid} onClick={() => pickBook(book.blid)}>
      <Group gap="sm" wrap="nowrap" w="100%">
        <ThemeIcon variant="light" radius="xl" size="lg">
          <IconBook2 size={18} aria-hidden />
        </ThemeIcon>
        <Stack gap={2} miw={0} style={{ flex: 1 }}>
          <Text fw={600} lineClamp={1}>
            {book.title}
          </Text>
          <Text size="sm" ff="monospace" opacity={0.7}>
            {book.blid}
          </Text>
        </Stack>
        <Badge variant="light" color={book.holder ? "green" : "gray"} tt="none">
          {book.holder ? `Hos ${book.holder.name}` : "Ikke utdelt"}
        </Badge>
      </Group>
    </Spotlight.Action>
  ));
  // Group labels only earn their place when the list can mix kinds.
  const grouped = pages !== undefined || (kinds.customers && kinds.books);
  const placeholder = pages
    ? PLACEHOLDERS.withPages
    : grouped
      ? PLACEHOLDERS.all
      : kinds.customers
        ? PLACEHOLDERS.customers
        : PLACEHOLDERS.books;

  return (
    <Spotlight.Root
      store={store}
      query={searchValue}
      onQueryChange={setSearchValue}
      shortcut={null}
      scrollable
      maxHeight="60vh"
    >
      <Spotlight.Search
        placeholder={placeholder}
        leftSection={<IconSearch size={20} aria-hidden />}
        rightSection={isFetching ? <Loader size="xs" /> : undefined}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
      />
      <Spotlight.ActionsList>
        {trimmedSearch.length < MIN_SEARCH_LENGTH && pageHits.length === 0 && (
          <Spotlight.Empty>Skriv minst {MIN_SEARCH_LENGTH} tegn for å søke.</Spotlight.Empty>
        )}
        {nothingFound && (
          <Spotlight.Empty>
            Fant ingen {searchedFor} for «{debouncedSearch}».
          </Spotlight.Empty>
        )}
        {grouped ? (
          <>
            {pageActions.length > 0 && (
              <Spotlight.ActionsGroup label="Sider">{pageActions}</Spotlight.ActionsGroup>
            )}
            {customerActions.length > 0 && (
              <Spotlight.ActionsGroup label="Kunder">{customerActions}</Spotlight.ActionsGroup>
            )}
            {bookActions.length > 0 && (
              <Spotlight.ActionsGroup label="Bøker">
                {bookActions}
                {moreBooksHint}
              </Spotlight.ActionsGroup>
            )}
          </>
        ) : (
          <>
            {customerActions}
            {bookActions}
            {moreBooksHint}
          </>
        )}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  );
}
