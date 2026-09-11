import { BLID_SEARCH_PATTERN } from "@boklisten/backend/shared/blid_search";
import { ActionIcon, Badge, Group, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Spotlight } from "@mantine/spotlight";
import type { createSpotlight } from "@mantine/spotlight";
import { IconAbc, IconBook2, IconNumber123, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import CustomerContactRow from "@/features/customer-search/CustomerContactRow";
import PermissionBadge from "@/features/customer-search/PermissionBadge";
import useDisplayName from "@/features/customer-search/useDisplayName";
import { visibleAdminPages } from "@/features/layout/adminNavigation";
import type { AdminPage } from "@/features/layout/adminNavigation";
import { createKeyboardDecoy, requestedSearchKeyboard } from "@/features/search/openSearch";
import { searchPages } from "@/features/search/searchPages";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";

const MIN_SEARCH_LENGTH = 3;

type SpotlightStore = ReturnType<typeof createSpotlight>[0];

const customerQueryKey = (searchTerm: string) => ["userDetail", "search", searchTerm] as const;
/** Prefix of the book search cache, so a delivery can invalidate every cached term at once. */
export const BLID_SEARCH_QUERY_KEY = ["blidSearch", "search"] as const;
const blidQueryKey = (searchTerm: string) => [...BLID_SEARCH_QUERY_KEY, searchTerm] as const;

// Results for "pett" are still relevant while the user types "petter" (or backspaces), but when
// the term is replaced entirely the old results must not show while the new fetch is in flight.
const isRelatedSearch = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

/**
 * The search input, with a way back to letters when it opened on the number pad (which has none).
 * Lives inside the spotlight, so every open mounts it afresh on the keyboard that open asked for.
 */
function SearchField({ placeholder, isFetching }: { placeholder: string; isFetching: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyboard, setKeyboard] = useState(requestedSearchKeyboard);
  const switchable = requestedSearchKeyboard() === "numeric";

  const switchKeyboard = () => {
    const next = keyboard === "numeric" ? "text" : "numeric";
    setKeyboard(next);
    const input = inputRef.current;
    if (!input) {
      return;
    }
    // iOS ignores a changed inputmode on the focused input, and a blur/focus of the same element.
    // It does honour focus moving to another input, so hop through a decoy with the new layout.
    // The decoy sits next to the input so the modal's focus trap sees nothing leave; the state
    // update above has reached the DOM by the time the frame comes.
    const decoy = createKeyboardDecoy(next);
    input.after(decoy);
    decoy.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      decoy.remove();
    });
  };

  const toggle = switchable && (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="lg"
      aria-label={keyboard === "numeric" ? "Bytt til bokstaver" : "Bytt til tall"}
      // Keep focus (and the keyboard) on the input while the button is tapped.
      onMouseDown={(event) => event.preventDefault()}
      onClick={switchKeyboard}
    >
      {keyboard === "numeric" ? (
        <IconAbc size={22} aria-hidden />
      ) : (
        <IconNumber123 size={22} aria-hidden />
      )}
    </ActionIcon>
  );

  return (
    <Spotlight.Search
      ref={inputRef}
      placeholder={placeholder}
      inputMode={keyboard}
      leftSection={<IconSearch size={20} aria-hidden />}
      rightSection={
        <Group gap={4} wrap="nowrap">
          {isFetching && <Loader size="xs" />}
          {toggle}
        </Group>
      }
      rightSectionWidth={switchable ? (isFetching ? 72 : 48) : undefined}
      rightSectionPointerEvents={switchable ? "all" : "none"}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      autoComplete="off"
    />
  );
}

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
 * book's unique ID) to the caller. With pages on, it also finds the admin pages the user may open,
 * by the same names as the sidebar, on title and description from the first character, listed
 * above everything else; a pick opens the page. Keyboard shortcuts are bound elsewhere, so that a
 * page can put its own instance in front of the global one.
 */
export default function SearchSpotlight({
  store,
  kinds,
  onSelectCustomer,
  onSelectBook,
}: {
  store: SpotlightStore;
  kinds: { customers: boolean; books: boolean; pages: boolean };
  onSelectCustomer?: (detailsId: string) => void;
  onSelectBook?: (blid: string) => void;
}) {
  const { api, client } = useApiClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
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
    () => (kinds.pages ? searchPages(visibleAdminPages(isAdmin), trimmedSearch) : []),
    [kinds.pages, isAdmin, trimmedSearch],
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
    ...(kinds.pages ? ["sider"] : []),
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
    void navigate({ to: page.to });
  };

  const displayName = useDisplayName();

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
      {/* The list sizes to its widest row's minimum width; a no-wrap e-mail must not set it. */}
      <Stack gap={4} w="100%" style={{ contain: "inline-size" }}>
        <Group gap="xs" justify="space-between">
          <Text fw={600}>{displayName(userDetail.name)}</Text>
          <Group gap={6}>
            <PermissionBadge permission={userDetail.permission} size="sm" />
            {userDetail.branchMembership && branchNames.has(userDetail.branchMembership) && (
              <Badge variant="light" size="sm">
                {branchNames.get(userDetail.branchMembership)}
              </Badge>
            )}
          </Group>
        </Group>
        <CustomerContactRow customer={userDetail} inheritColor />
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
          {book.holder ? `Hos ${displayName(book.holder.name)}` : "Ikke utdelt"}
        </Badge>
      </Group>
    </Spotlight.Action>
  ));
  // Group labels only earn their place when the list can mix kinds.
  const grouped = kinds.pages || (kinds.customers && kinds.books);
  const placeholder = kinds.pages
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
      <SearchField placeholder={placeholder} isFetching={isFetching} />
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
