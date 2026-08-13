import { Button, Container, Group, Skeleton, Stack, Tabs, Title } from "@mantine/core";
import { IconChartHistogram, IconListSearch, IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { seo } from "@/shared/utils/seo";

import AdminMatchOverview from "@/features/matches/adminOverview/AdminMatchOverview";
import { validateAdminMatchListSearch } from "@/features/matches/adminOverview/adminMatchListSearch";
import OverviewEmptyState from "@/features/matches/adminOverview/OverviewEmptyState";
import MatchStatistics from "@/features/matches/insights/MatchStatistics";
import PlanRoundModal from "@/features/matches/rounds/PlanRoundModal";
import PlannedRoundCard from "@/features/matches/rounds/PlannedRoundCard";
import RoundToolbar from "@/features/matches/rounds/RoundToolbar";
import { isPlanned, useRounds, type Round } from "@/features/matches/rounds/useRounds";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export const Route = createFileRoute("/(administrasjon)/admin/overleveringer/")({
  validateSearch: validateAdminMatchListSearch,
  head: () =>
    seo({
      title: "Overleveringer | bl-admin",
    }),
  component: AdminMatchesPage,
});

function PageSkeleton() {
  return (
    <Stack gap={"lg"}>
      <Skeleton height={64} radius={"md"} />
      <Skeleton height={36} width={280} />
      <Skeleton height={300} radius={"md"} />
    </Stack>
  );
}

function AdminMatchesPage() {
  const { runde, fane } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { client, api } = useApiClient();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useRounds();
  const [planning, setPlanning] = useState<{ round?: Round } | null>(null);
  const rounds = data ?? [];

  const fallbackRoundId =
    (rounds.find((round) => round.status === "active") ?? rounds[0])?.id ?? null;
  const selectedRoundId = rounds.some((round) => round.id === runde)
    ? (runde as string)
    : fallbackRoundId;
  const activeTab = fane ?? "innsikt";
  const selectedRound = rounds.find((round) => round.id === selectedRoundId);

  const generateMutation = useMutation({
    mutationFn: async (roundId: string) =>
      client.api.matchRounds.generate({ params: { id: roundId }, timeout: 300_000 }),
    onSuccess: (result) => {
      showSuccessNotification(
        `Laget ${result.userMatchCount} elevoverleveringer og ${result.standMatchCount} standoverleveringer. Runden er et utkast – skru den på når den ser riktig ut.`,
      );
      void queryClient.invalidateQueries({ queryKey: api.matchRounds.index.queryKey() });
    },
    onError: (mutationError: Error) =>
      showErrorNotification(mutationError.message || "Klarte ikke generere overleveringene"),
  });

  function selectRound(roundId: string | null) {
    void navigate({
      search: (previous) => ({ ...previous, runde: roundId ?? undefined }),
      replace: true,
    });
  }

  return (
    <Container size={"lg"} py={"lg"}>
      <Stack gap={"lg"}>
        <Title order={1}>Overleveringer</Title>
        {isLoading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorAlert title={"Klarte ikke laste inn runder"} />
        ) : rounds.length === 0 ? (
          <Stack gap={"lg"}>
            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setPlanning({})}>
                Ny runde
              </Button>
            </Group>
            <OverviewEmptyState filtered={false} />
          </Stack>
        ) : (
          <Stack gap={"lg"}>
            <RoundToolbar
              rounds={rounds}
              selectedRoundId={selectedRoundId}
              onSelect={selectRound}
              onNewRound={() => setPlanning({})}
              onEditPlan={() => selectedRound && setPlanning({ round: selectedRound })}
            />
            {selectedRound && isPlanned(selectedRound) ? (
              <PlannedRoundCard
                round={selectedRound}
                onEdit={() => setPlanning({ round: selectedRound })}
                onGenerate={() => generateMutation.mutate(selectedRound.id)}
                generating={generateMutation.isPending}
              />
            ) : (
              <Tabs
                value={activeTab}
                keepMounted={false}
                onChange={(value) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      fane: value === "liste" ? "liste" : undefined,
                    }),
                    replace: true,
                  })
                }
              >
                <Tabs.List mb={"md"}>
                  <Tabs.Tab value={"innsikt"} leftSection={<IconChartHistogram size={16} />}>
                    Innsikt
                  </Tabs.Tab>
                  <Tabs.Tab value={"liste"} leftSection={<IconListSearch size={16} />}>
                    Alle overleveringer
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value={"innsikt"}>
                  {selectedRoundId !== null && <MatchStatistics roundId={selectedRoundId} />}
                </Tabs.Panel>
                <Tabs.Panel value={"liste"}>
                  {selectedRoundId !== null && <AdminMatchOverview roundId={selectedRoundId} />}
                </Tabs.Panel>
              </Tabs>
            )}
          </Stack>
        )}
      </Stack>

      {planning && (
        <PlanRoundModal
          round={planning.round}
          onClose={() => setPlanning(null)}
          onSaved={selectRound}
        />
      )}
    </Container>
  );
}
