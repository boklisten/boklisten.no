import { Button, Skeleton, Stack, Tabs } from "@mantine/core";
import { IconChartHistogram, IconListSearch, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import AdminMatchDetail from "@/features/matches/adminOverview/AdminMatchDetail";
import AdminMatchOverview from "@/features/matches/adminOverview/AdminMatchOverview";
import MatchStatistics from "@/features/matches/insights/MatchStatistics";
import PlanRoundModal from "@/features/matches/rounds/PlanRoundModal";
import PlannedRoundCard from "@/features/matches/rounds/PlannedRoundCard";
import RoundToolbar from "@/features/matches/rounds/RoundToolbar";
import { isPlanned, useRefreshRounds, useRounds } from "@/features/matches/rounds/useRounds";
import type { Round } from "@/features/matches/rounds/useRounds";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import EntityLink from "@/shared/components/EntityLink";
import { api, apiClient } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const route = getRouteApi("/(administrasjon)/admin/database/filialer");

function TabSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={64} radius="md" />
      <Skeleton height={36} width={280} />
      <Skeleton height={300} radius="md" />
    </Stack>
  );
}

/** One match, in place of the list, with a way back to where the admin was. */
function MatchDetailPanel({ matchId }: { matchId: string }) {
  const {
    data: match,
    error,
    isLoading,
  } = useQuery(api.matches.show.queryOptions({ params: { matchId } }, { staleTime: 30_000 }));

  return (
    <Stack gap="lg">
      <EntityLink
        to="/admin/database/filialer"
        search={(previous) => ({ ...previous, overlevering: undefined })}
      >
        ← Alle overleveringer
      </EntityLink>
      {isLoading ? (
        <Skeleton height={200} />
      ) : error ? (
        <ErrorAlert title="Klarte ikke laste inn overleveringen" />
      ) : match ? (
        <AdminMatchDetail match={match} />
      ) : (
        <InfoAlert title="Fant ikke overleveringen" />
      )}
    </Stack>
  );
}

/**
 * The branch's match rounds: plan one, generate it, then follow it up. A round covers the branch
 * and everything below it, so only rounds created on this very branch are listed here.
 */
export default function BranchRounds({ branchId }: { branchId: string }) {
  const { runde, rundeFane, overlevering } = route.useSearch();
  const navigate = route.useNavigate();
  const refreshRounds = useRefreshRounds();
  const { data, isLoading, error } = useRounds(branchId);
  const [planning, setPlanning] = useState<{ round?: Round } | null>(null);
  const rounds = data ?? [];

  const fallbackRoundId =
    (rounds.find((round) => round.status === "active") ?? rounds[0])?.id ?? null;
  const selectedRoundId = rounds.find((round) => round.id === runde)?.id ?? fallbackRoundId;
  const activeTab = rundeFane ?? "innsikt";
  const selectedRound = rounds.find((round) => round.id === selectedRoundId);

  const generateMutation = useMutation({
    mutationFn: async (roundId: string) =>
      apiClient.api.matchRounds.generate({ params: { id: roundId }, timeout: 300_000 }),
    onSuccess: (result) => {
      showSuccessNotification(
        `Laget ${result.userMatchCount} elevoverleveringer og ${result.standMatchCount} standoverleveringer. Runden er et utkast – skru den på når den ser riktig ut.`,
      );
      refreshRounds();
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

  if (overlevering) {
    return <MatchDetailPanel matchId={overlevering} />;
  }

  return (
    <>
      {isLoading ? (
        <TabSkeleton />
      ) : error ? (
        <ErrorAlert title="Klarte ikke laste inn rundene" />
      ) : rounds.length === 0 ? (
        <Button leftSection={<IconPlus size={16} />} onClick={() => setPlanning({})}>
          Planlegg ny runde
        </Button>
      ) : (
        <Stack gap="lg">
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
                    rundeFane: value === "liste" ? "liste" : undefined,
                  }),
                  replace: true,
                })
              }
            >
              <Tabs.List mb="md">
                <Tabs.Tab value="innsikt" leftSection={<IconChartHistogram size={16} />}>
                  Innsikt
                </Tabs.Tab>
                <Tabs.Tab value="liste" leftSection={<IconListSearch size={16} />}>
                  Alle overleveringer
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="innsikt">
                {selectedRoundId !== null && <MatchStatistics roundId={selectedRoundId} />}
              </Tabs.Panel>
              <Tabs.Panel value="liste">
                {selectedRoundId !== null && <AdminMatchOverview roundId={selectedRoundId} />}
              </Tabs.Panel>
            </Tabs>
          )}
        </Stack>
      )}

      {planning && (
        <PlanRoundModal
          branchId={branchId}
          round={planning.round}
          onClose={() => setPlanning(null)}
          onSaved={selectRound}
        />
      )}
    </>
  );
}
