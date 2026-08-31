import type { SendoutStatsDto } from "@boklisten/backend/shared/message-log";
import { Container, Stack, Tabs, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import LiveFeed from "@/features/message-log/LiveFeed";
import MessageLogStatistics from "@/features/message-log/MessageLogStatistics";
import { TYPE_LABELS } from "@/features/message-log/meta";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/kommunikasjon/logg")({
  head: () =>
    seo({
      title: "Meldingslogg | bl-admin",
    }),
  component: MessageLogPage,
});

function MessageLogPage() {
  const [activeTab, setActiveTab] = useState<"logg" | "statistikk">("logg");
  const [sendoutFilter, setSendoutFilter] = useState<{ id: number; name: string } | null>(null);

  function showSendoutInLog(sendout: SendoutStatsDto) {
    setSendoutFilter({ id: sendout.id, name: sendout.name ?? TYPE_LABELS[sendout.kind] });
    setActiveTab("logg");
  }

  return (
    <Container size={"md"}>
      <Stack>
        <Title>Meldingslogg</Title>
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value === "statistikk" ? "statistikk" : "logg")}
          keepMounted={false}
        >
          <Tabs.List mb={"md"}>
            <Tabs.Tab value={"logg"}>Sanntidslogg</Tabs.Tab>
            <Tabs.Tab value={"statistikk"}>Statistikk</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={"logg"}>
            <LiveFeed
              sendoutFilter={sendoutFilter}
              onClearSendoutFilter={() => setSendoutFilter(null)}
            />
          </Tabs.Panel>
          <Tabs.Panel value={"statistikk"}>
            <MessageLogStatistics onShowSendoutInLog={showSendoutInLog} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
