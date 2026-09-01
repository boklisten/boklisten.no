import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import {
  Alert,
  Button,
  Collapse,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconArrowDown, IconArrowMerge, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import MergeRoleCard from "@/features/user-management/MergeRoleCard";
import { PERMISSION_LABELS } from "@/features/user-management/permissionLabels";
import useBranchNames from "@/features/user-management/useBranchNames";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const MIN_SEARCH_LENGTH = 3;

/**
 * Merge flow inside the danger zone: pick the customer to keep, review both
 * accounts, and confirm by typing this customer's name. Inline (no modal) for
 * the same ModalsProvider reason as the delete flow.
 */
export default function MergeCustomerSection({
  userDetail,
  expanded,
  onExpand,
  onCollapse,
  onMerged,
}: {
  userDetail: UserDetail;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onMerged?: ((toDetailsId: string) => void) | undefined;
}) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const branchNames = useBranchNames();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue.trim(), 250);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const confirmPhrase = userDetail.name || userDetail.email;

  const searchActive =
    !targetId &&
    searchValue.trim().length >= MIN_SEARCH_LENGTH &&
    debouncedSearch.length >= MIN_SEARCH_LENGTH;

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["userDetail", "search", debouncedSearch] as const,
    queryFn: async () =>
      (await client.api.userDetail.search({ body: { searchStr: debouncedSearch } })) ?? [],
    enabled: searchActive,
  });
  const candidates = searchActive
    ? (searchResults ?? []).filter((result) => result.id !== userDetail.id)
    : [];

  const { data: preview, isPending: previewPending } = useQuery(
    api.userManagement.mergePreview.queryOptions(
      { params: { fromDetailsId: userDetail.id, toDetailsId: targetId ?? "" } },
      { enabled: Boolean(targetId) },
    ),
  );
  const targetIsCustomer = preview ? preview.to.permission === "customer" : true;

  const reset = () => {
    setSearchValue("");
    setTargetId(null);
    setConfirmText("");
  };

  const mergeMutation = useMutation({
    mutationFn: (input: { fromDetailsId: string; toDetailsId: string }) =>
      client.api.userManagement.merge({ body: input }),
    onSuccess: async (_, { toDetailsId }) => {
      showSuccessNotification("Kundene ble slått sammen");
      reset();
      // A merge re-points orders, books, payments and matches, so every
      // cached view of the target customer is stale. Mark stale without
      // refetching: refetching here would hit endpoints for the just-deleted
      // customer before onMerged navigates away from them.
      await queryClient.invalidateQueries({ refetchType: "none" });
      onMerged?.(toDetailsId);
    },
    onError: (error) =>
      showErrorNotification(errorMessage(error, "Klarte ikke å slå sammen kundene")),
  });

  return (
    <Stack gap="xs">
      <Text size="sm">
        Flytter bøker, bestillinger, betalinger og overleveringer til en annen kunde, og sletter
        denne kunden permanent.
      </Text>
      {!expanded && (
        <Button
          color="red"
          variant="outline"
          leftSection={<IconArrowMerge size={16} />}
          w="fit-content"
          onClick={onExpand}
        >
          Slå sammen med annen kunde
        </Button>
      )}
      <Collapse expanded={expanded}>
        <Stack gap="xs">
          {!targetId && (
            <>
              <TextInput
                label="Søk etter kunden som skal beholdes"
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
                        onClick={() => setTargetId(result.id)}
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
                        Fant ingen kunder for «{debouncedSearch}».
                      </Text>
                    )}
                  </ScrollArea.Autosize>
                </Paper>
              )}
            </>
          )}
          {targetId && previewPending && <Skeleton height={200} radius="md" />}
          {targetId && preview && (
            <>
              <MergeRoleCard
                user={preview.from}
                mergeRole="delete"
                branchName={branchNames.get(preview.from.branchMembership ?? "")}
              />
              <Group gap={6} c="dimmed">
                <IconArrowDown size={18} />
                <Text size="sm">Alt innhold flyttes til</Text>
              </Group>
              <MergeRoleCard
                user={preview.to}
                mergeRole="keep"
                branchName={branchNames.get(preview.to.branchMembership ?? "")}
              />
              <Button variant="default" w="fit-content" onClick={() => setTargetId(null)}>
                Velg en annen kunde
              </Button>
              {targetIsCustomer ? (
                <>
                  <Alert color="red">
                    Kontoen til «{preview.from.name || preview.from.email}» slettes permanent.
                    Bøker, bestillinger, betalinger og overleveringer flyttes til «
                    {preview.to.name || preview.to.email}». Dette kan ikke angres.
                  </Alert>
                  <TextInput
                    label={`Skriv «${confirmPhrase}» for å bekrefte sammenslåingen`}
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.currentTarget.value)}
                  />
                </>
              ) : (
                <Alert color="orange">
                  «{preview.to.name || preview.to.email}» er registrert som{" "}
                  {PERMISSION_LABELS[preview.to.permission].toLowerCase()} og kan ikke motta en
                  sammenslåing. Endre tilgangsnivået til kunde først.
                </Alert>
              )}
            </>
          )}
          <Group gap="xs">
            <Button
              variant="default"
              onClick={() => {
                reset();
                onCollapse();
              }}
            >
              Avbryt
            </Button>
            {targetId && preview && targetIsCustomer && (
              <Button
                color="red"
                leftSection={<IconArrowMerge size={16} />}
                disabled={confirmText.trim() !== confirmPhrase}
                loading={mergeMutation.isPending}
                onClick={() =>
                  mergeMutation.mutate({
                    fromDetailsId: userDetail.id,
                    toDetailsId: targetId,
                  })
                }
              >
                Slå sammen kundene
              </Button>
            )}
          </Group>
        </Stack>
      </Collapse>
    </Stack>
  );
}
