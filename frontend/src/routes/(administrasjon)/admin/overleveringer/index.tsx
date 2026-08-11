import { Container, Group, Skeleton, Stack, Tabs, Title } from "@mantine/core";
import { IconChartHistogram, IconListSearch } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

import AdminMatchOverview from "@/features/matches/adminOverview/AdminMatchOverview";
import { validateAdminMatchListSearch } from "@/features/matches/adminOverview/adminMatchListSearch";
import OverviewEmptyState from "@/features/matches/adminOverview/OverviewEmptyState";
import MatchStatistics from "@/features/matches/insights/MatchStatistics";
import GenerateRoundButton from "@/features/matches/rounds/GenerateRoundButton";
import RoundToolbar from "@/features/matches/rounds/RoundToolbar";
import { useRounds } from "@/features/matches/rounds/useRounds";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";

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
  const { data, isLoading, error } = useRounds();
  const rounds = data ?? [];

  const fallbackRoundId =
    (rounds.find((round) => round.status === "active") ?? rounds[0])?.id ?? null;
  const selectedRoundId = rounds.some((round) => round.id === runde)
    ? (runde as string)
    : fallbackRoundId;
  const activeTab = fane ?? "innsikt";

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
              <GenerateRoundButton onGenerated={selectRound} />
            </Group>
            <OverviewEmptyState filtered={false} />
          </Stack>
        ) : (
          <Stack gap={"lg"}>
            <RoundToolbar
              rounds={rounds}
              selectedRoundId={selectedRoundId}
              onSelect={selectRound}
            />
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
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
