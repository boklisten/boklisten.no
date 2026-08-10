import { Card, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconInbox, IconSearchOff } from "@tabler/icons-react";

export default function OverviewEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card withBorder radius={"md"} padding={"xl"}>
      <Stack align={"center"} gap={"sm"} py={"xl"}>
        <ThemeIcon size={56} radius={"xl"} variant={"light"} color={filtered ? "blue" : "gray"}>
          {filtered ? <IconSearchOff size={30} /> : <IconInbox size={30} />}
        </ThemeIcon>
        <Title order={3}>{filtered ? "Ingen treff" : "Ingen overleveringer enda"}</Title>
        <Text c={"dimmed"} ta={"center"} maw={440}>
          {filtered
            ? "Ingen overleveringer passer søket eller filteret. Prøv et annet navn, telefonnummer eller e-post — eller sett filteret til Begge."
            : "Når overleveringer genereres, dukker de opp her."}
        </Text>
      </Stack>
    </Card>
  );
}
