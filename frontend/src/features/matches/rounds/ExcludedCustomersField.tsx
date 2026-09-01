import {
  Button,
  Card,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch, IconTrash } from "@tabler/icons-react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import useApiClient from "@/shared/hooks/useApiClient";

const MIN_SEARCH_LENGTH = 3;

function ExcludedCustomerRow({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { api } = useApiClient();
  const { data: detail, isPending } = useQuery(
    api.userDetail.getById.queryOptions({ params: { detailsId: id } }),
  );

  return (
    <Card withBorder padding="xs">
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text fw={500} truncate>
            {isPending ? "Laster…" : (detail?.name ?? "Fant ikke eleven")}
          </Text>
          {detail?.email && (
            <Text size="sm" c="dimmed" truncate>
              {detail.email}
            </Text>
          )}
        </Stack>
        <Button
          variant="subtle"
          color="red"
          leftSection={<IconTrash size={16} />}
          style={{ flexShrink: 0 }}
          onClick={onRemove}
        >
          Fjern
        </Button>
      </Group>
    </Card>
  );
}

/**
 * Search-and-add list of students an admin keeps out of the round. Holds only their ids; names are
 * read through the same per-id query the rest of admin uses, primed from the search result on add
 * so a freshly added student never flashes a loading state.
 */
export default function ExcludedCustomersField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue.trim(), 250);
  const trimmedSearch = searchValue.trim();
  const searchActive =
    trimmedSearch.length >= MIN_SEARCH_LENGTH && debouncedSearch.length >= MIN_SEARCH_LENGTH;

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["userDetail", "search", debouncedSearch] as const,
    queryFn: async () =>
      (await client.api.userDetail.search({ body: { searchStr: debouncedSearch } })) ?? [],
    enabled: searchActive,
  });

  // Mounted eagerly so every row's name is in flight before the rows render one by one.
  useQueries({
    queries: value.map((id) => api.userDetail.getById.queryOptions({ params: { detailsId: id } })),
  });

  const candidates = searchActive
    ? (searchResults ?? []).filter((result) => !value.includes(result.id))
    : [];

  const add = (userDetail: (typeof candidates)[number]) => {
    queryClient.setQueryData(
      api.userDetail.getById.queryKey({ params: { detailsId: userDetail.id } }),
      userDetail,
    );
    onChange([...value, userDetail.id]);
    setSearchValue("");
  };

  return (
    <Stack>
      {value.map((id) => (
        <ExcludedCustomerRow
          key={id}
          id={id}
          onRemove={() => onChange(value.filter((existing) => existing !== id))}
        />
      ))}

      <TextInput
        label="Legg til elev"
        placeholder="Telefonnummer, e-post, navn eller adresse"
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
                <Stack gap={0} align="flex-start">
                  <Text fw={500}>{result.name}</Text>
                  <Text size="sm" c="dimmed">
                    {[result.phone, result.email].filter(Boolean).join(" · ")}
                  </Text>
                </Stack>
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
}
