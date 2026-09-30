import { Container, Stack, Tabs, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import LiveFeed from "@/features/message-log/LiveFeed";
import { validateMessageLogSearch } from "@/features/message-log/messageLogParams";
import type { MessageLogSearchParams } from "@/features/message-log/messageLogParams";
import MessageLogStatistics from "@/features/message-log/MessageLogStatistics";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/kommunikasjon/logg")({
  validateSearch: validateMessageLogSearch,
  head: () =>
    seo({
      title: "Meldingslogg | bl-admin",
    }),
  component: MessageLogPage,
});

function MessageLogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab = search.loggFane ?? "logg";

  /** Filter changes replace the history entry, so the back button leaves the page, not a filter. */
  function updateFilters(patch: Partial<MessageLogSearchParams>) {
    void navigate({
      search: (previous) => validateMessageLogSearch({ ...previous, ...patch }),
      replace: true,
    });
  }

  return (
    <Container size="md">
      <Stack>
        <Title>Meldingslogg</Title>
        <Tabs
          value={activeTab}
          onChange={(value) =>
            void navigate({
              search: (previous) =>
                validateMessageLogSearch({
                  ...previous,
                  loggFane: value === "statistikk" ? "statistikk" : "logg",
                }),
            })
          }
          keepMounted={false}
        >
          <Tabs.List mb="md">
            <Tabs.Tab value="logg">Sanntidslogg</Tabs.Tab>
            <Tabs.Tab value="statistikk">Statistikk</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="logg">
            <LiveFeed filters={search} onChange={updateFilters} />
          </Tabs.Panel>
          <Tabs.Panel value="statistikk">
            <MessageLogStatistics
              onShowSendoutInLog={(sendout) =>
                void navigate({ search: { loggFane: "logg", utsendelse: sendout.id } })
              }
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
