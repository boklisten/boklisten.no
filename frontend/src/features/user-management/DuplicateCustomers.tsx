import { Accordion, Badge, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";

import DuplicatePairCard from "@/features/user-management/DuplicatePairCard";
import { duplicatePairKey } from "@/features/user-management/duplicateTypes";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const IGNORED_PAIRS_STORAGE_KEY = "bl-ignored-duplicate-pairs";

export default function DuplicateCustomers() {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery(api.userManagement.duplicates.queryOptions());
  const [ignoredKeys, setIgnoredKeys] = useLocalStorage<string[]>({
    key: IGNORED_PAIRS_STORAGE_KEY,
    defaultValue: [],
  });

  const pairs = data?.pairs;
  const visiblePairs = pairs?.filter((pair) => !ignoredKeys.includes(duplicatePairKey(pair))) ?? [];
  const ignoredPairs = pairs?.filter((pair) => ignoredKeys.includes(duplicatePairKey(pair))) ?? [];

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Group gap="xs">
          <Title order={2} size="h3">
            Mulige duplikater
          </Title>
          {data && visiblePairs.length > 0 && (
            <Badge variant="light" color="orange">
              {visiblePairs.length}
              {data.totalPairCount > data.pairs.length ? "+" : ""}
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          Kunder som ligner på hverandre i navn, fødselsdato, foresatt eller adresse. Ignorerte par
          lagres kun i denne nettleseren.
        </Text>
      </Stack>
      {isError && (
        <ErrorAlert title="Kunne ikke lete etter duplikater">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
      )}
      {isPending && <Skeleton height={160} radius="md" />}
      {pairs && visiblePairs.length === 0 && (
        <Text c="dimmed" fs="italic">
          Ingen mulige duplikater å vise.
        </Text>
      )}
      {visiblePairs.map((pair) => (
        <DuplicatePairCard
          key={duplicatePairKey(pair)}
          pair={pair}
          onIgnore={() => setIgnoredKeys([...ignoredKeys, duplicatePairKey(pair)])}
        />
      ))}
      {ignoredPairs.length > 0 && (
        <Accordion variant="contained">
          <Accordion.Item value="ignored">
            <Accordion.Control>Ignorerte par ({ignoredPairs.length})</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {ignoredPairs.map((pair) => (
                  <DuplicatePairCard
                    key={duplicatePairKey(pair)}
                    pair={pair}
                    ignored
                    onUnignore={() =>
                      setIgnoredKeys(ignoredKeys.filter((key) => key !== duplicatePairKey(pair)))
                    }
                  />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </Stack>
  );
}
