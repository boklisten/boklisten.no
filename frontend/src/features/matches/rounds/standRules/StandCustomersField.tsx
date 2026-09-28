import { Button, Group, Loader, Paper, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import CustomerAvatar from "@/features/customer-search/CustomerAvatar";
import { StandRuleGroup, StandRuleRow } from "@/features/matches/rounds/standRules/StandRuleGroup";
import { api, apiClient } from "@/shared/utils/apiClient";

const MIN_SEARCH_LENGTH = 3;

function StandCustomerRow({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { data: detail, isPending } = useQuery(
    api.users.show.queryOptions({ params: { userId: id } }),
  );
  const name = isPending ? "Laster…" : (detail?.name ?? "Fant ikke eleven");

  return (
    <StandRuleRow
      leading={<CustomerAvatar userId={id} />}
      title={name}
      description={detail?.email}
      removeLabel={`Fjern ${name}`}
      onRemove={onRemove}
    />
  );
}

/**
 * Search-and-add list of students who get no student matches. Holds only their ids; names are
 * read through the same per-id query the rest of admin uses, primed from the search result on add
 * so a freshly added student never flashes a loading state.
 */
export default function StandCustomersField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue.trim(), 250);
  const trimmedSearch = searchValue.trim();
  const searchActive =
    trimmedSearch.length >= MIN_SEARCH_LENGTH && debouncedSearch.length >= MIN_SEARCH_LENGTH;

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["users", "search", debouncedSearch] as const,
    queryFn: async () =>
      (await apiClient.api.users.search({ query: { q: debouncedSearch } })) ?? [],
    enabled: searchActive,
  });

  // Mounted eagerly so every row's name is in flight before the rows render one by one.
  useQueries({
    queries: value.map((id) => api.users.show.queryOptions({ params: { userId: id } })),
  });

  const candidates = searchActive
    ? (searchResults ?? []).filter((result) => !value.includes(result.id))
    : [];

  const add = (user: (typeof candidates)[number]) => {
    queryClient.setQueryData(api.users.show.queryKey({ params: { userId: user.id } }), user);
    onChange([...value, user.id]);
    setSearchValue("");
  };

  const addControl = (
    <Stack gap="xs">
      <TextInput
        aria-label="Søk etter elev som skal via stand"
        placeholder="Søk etter elev"
        value={searchValue}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
        leftSection={<IconSearch size={16} aria-hidden />}
        rightSection={isFetching ? <Loader size="xs" /> : undefined}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
      />

      {searchActive && (
        <Paper withBorder>
          <ScrollArea.Autosize mah={260}>
            {candidates.map((result) => (
              <Button
                key={result.id}
                variant="subtle"
                color="gray"
                fullWidth
                justify="flex-start"
                h="auto"
                py="xs"
                onClick={() => add(result)}
              >
                <Group gap="sm" wrap="nowrap">
                  <CustomerAvatar userId={result.id} />
                  <Stack gap={0} align="flex-start">
                    <Text fw={500}>{result.name}</Text>
                    <Text size="sm" c="dimmed">
                      {[result.phone, result.email].filter(Boolean).join(" · ")}
                    </Text>
                  </Stack>
                </Group>
              </Button>
            ))}
            {candidates.length === 0 && !isFetching && (
              <Text size="sm" c="dimmed" p="sm">
                Fant ingen elever for «{debouncedSearch}».
              </Text>
            )}
          </ScrollArea.Autosize>
        </Paper>
      )}
    </Stack>
  );

  return (
    <StandRuleGroup title="Elever" count={value.length} addControl={addControl}>
      {value.map((id) => (
        <StandCustomerRow
          key={id}
          id={id}
          onRemove={() => onChange(value.filter((existing) => existing !== id))}
        />
      ))}
    </StandRuleGroup>
  );
}
