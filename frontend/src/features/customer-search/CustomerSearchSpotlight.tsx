import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Badge, Group, Loader, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { Spotlight, createSpotlight } from "@mantine/spotlight";
import { IconMail, IconPhone, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import PermissionBadge from "@/features/customer-search/PermissionBadge";
import useApiClient from "@/shared/hooks/useApiClient";

const MIN_SEARCH_LENGTH = 3;

const [searchStore, customerSearch] = createSpotlight();

export { customerSearch };

// iOS Safari only shows the keyboard when focus() runs synchronously inside the tap's call stack,
// but the Spotlight input mounts async after the modal opens. Focus a throwaway input during the
// tap and let Mantine's focus trap take over — iOS keeps the keyboard up when focus moves between
// text inputs. Touch devices only: with the decoy focused at open time, Mantine's focus trap
// would try to return focus to it (removed by then) on close instead of the triggering button.
export function openCustomerSearch() {
  if (!window.matchMedia("(pointer: coarse)").matches) {
    customerSearch.open();
    return;
  }
  const decoy = document.createElement("input");
  decoy.setAttribute("type", "text");
  decoy.style.position = "fixed";
  decoy.style.top = "0";
  decoy.style.left = "0";
  decoy.style.height = "1px";
  decoy.style.width = "1px";
  decoy.style.opacity = "0";
  // Anything below 16px makes iOS zoom the page when the decoy gains focus.
  decoy.style.fontSize = "16px";
  document.body.append(decoy);
  const remove = () => decoy.remove();
  decoy.addEventListener("blur", remove, { once: true });
  decoy.focus({ preventScroll: true });
  customerSearch.open();
  // Fallback in case nothing ever steals focus from the decoy (e.g. the spotlight failed to open).
  setTimeout(remove, 2000);
}

const searchQueryKey = (searchTerm: string) => ["userDetail", "search", searchTerm] as const;

// Results for "pett" are still relevant while the user types "petter" (or backspaces), but when
// the term is replaced entirely the old results must not show while the new fetch is in flight.
const isRelatedSearch = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

// Mantine preselects the first action on every keystroke, but that runs before our async results
// have rendered, so the imperative data-selected attribute lands on stale DOM and Enter usually
// does nothing. Its selectAction helper is not exported, so mirror its DOM contract
// (data-action/data-selected) through the public store once the fresh list is in the DOM.
function selectFirstResult() {
  const { listId } = searchStore.getState();
  const list = listId ? document.getElementById(listId) : null;
  if (!list) {
    return;
  }
  list.querySelector("[data-selected]")?.removeAttribute("data-selected");
  const first = list.querySelector("[data-action]");
  first?.setAttribute("data-selected", "true");
  searchStore.updateState((state) => ({ ...state, selected: first ? 0 : -1 }));
}

export default function CustomerSearchSpotlight({
  onSelect,
}: {
  onSelect: (userDetail: UserDetail) => void;
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

  const { data: searchResults, isFetching } = useQuery({
    queryKey: searchQueryKey(debouncedSearch),
    queryFn: async () =>
      (await client.api.userDetail.search({ body: { searchStr: debouncedSearch } })) ?? [],
    enabled: searchActive,
    placeholderData: (previousData, previousQuery) => {
      const previousSearch = previousQuery?.queryKey.at(-1);
      return typeof previousSearch === "string" && isRelatedSearch(previousSearch, debouncedSearch)
        ? previousData
        : undefined;
    },
  });

  const { data: branches } = useQuery(api.branches.getAll.queryOptions());
  const branchNames = new Map((branches ?? []).map((branch) => [branch.id, branch.name]));

  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      selectFirstResult();
    }
  }, [searchResults]);

  return (
    <Spotlight.Root
      store={searchStore}
      query={searchValue}
      onQueryChange={setSearchValue}
      shortcut={["mod + K"]}
      scrollable
      maxHeight="60vh"
    >
      <Spotlight.Search
        placeholder="Telefonnummer, e-post, navn eller adresse"
        leftSection={<IconSearch size={20} aria-hidden />}
        rightSection={isFetching ? <Loader size="xs" /> : undefined}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
      />
      <Spotlight.ActionsList>
        {trimmedSearch.length < MIN_SEARCH_LENGTH && (
          <Spotlight.Empty>Skriv minst {MIN_SEARCH_LENGTH} tegn for å søke.</Spotlight.Empty>
        )}
        {searchActive && searchResults && searchResults.length === 0 && !isFetching && (
          <Spotlight.Empty>Fant ingen kunder for «{debouncedSearch}».</Spotlight.Empty>
        )}
        {searchActive &&
          searchResults?.map((userDetail) => (
            <Spotlight.Action
              key={userDetail.id}
              onClick={() => {
                // The modal's exit transition is interrupted by the navigation this triggers, so
                // Mantine's clearQueryOnClose (which runs onExited) never fires — clear ourselves.
                setSearchValue("");
                onSelect(userDetail);
              }}
            >
              <Stack gap={4} w="100%">
                <Group gap="xs" justify="space-between">
                  <Text fw={600}>{userDetail.name}</Text>
                  <Group gap={6}>
                    <PermissionBadge permission={userDetail.permission} size="sm" />
                    {userDetail.branchMembership &&
                      branchNames.has(userDetail.branchMembership) && (
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
          ))}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  );
}
