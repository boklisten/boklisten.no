import {
  CloseButton,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconBook2, IconMail, IconPhone } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import BlidSearchControls from "@/features/blid-search/BlidSearchControls";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

/** The customer-facing Boksøk: scan or type a blid and see who the book belongs to. */
export default function PublicBlidSearch() {
  const [blid, setBlid] = useState<string | null>(null);
  return (
    <Stack>
      <BlidSearchControls compact={blid !== null} onSubmit={setBlid} />
      {blid !== null && <PublicBlidResult blid={blid} onClear={() => setBlid(null)} />}
    </Stack>
  );
}

function PublicBlidResult({ blid, onClear }: { blid: string; onClear: () => void }) {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery(
    api.publicBlidLookup.lookup.queryOptions({ params: { blid } }),
  );

  if (isPending) {
    return <Skeleton height={220} radius={"md"} />;
  }
  if (isError) {
    return <ErrorAlert>Kunne ikke søke opp boka. Prøv igjen.</ErrorAlert>;
  }
  const result = data[0];
  if (result === undefined) {
    return <InfoAlert>Boka med unik ID {blid} er ikke registrert som utdelt.</InfoAlert>;
  }

  return (
    <Paper withBorder radius={"md"} p={"md"}>
      <Stack gap={"sm"}>
        <Group justify={"space-between"} align={"flex-start"} wrap={"nowrap"} gap={"xs"}>
          <Group gap={"sm"} align={"center"} wrap={"nowrap"} miw={0}>
            <ThemeIcon variant={"light"} size={"xl"} radius={"xl"}>
              <IconBook2 aria-hidden />
            </ThemeIcon>
            <Stack gap={4} miw={0}>
              <Title order={2} size={"h4"} lh={1.2}>
                {result.title}
              </Title>
              <Text size={"sm"} c={"dimmed"}>
                ISBN {result.isbn} · Unik ID {blid}
              </Text>
            </Stack>
          </Group>
          <CloseButton aria-label={"Lukk boksøket"} onClick={onClear} />
        </Group>
        <Stack gap={6}>
          <Text fz={"sm"} fw={500} c={"dimmed"}>
            Tilhører
          </Text>
          <Text fw={700}>{result.name}</Text>
          <Group gap={"md"}>
            <Group gap={5}>
              <IconPhone size={16} aria-hidden />
              <Text size={"sm"}>{result.phone}</Text>
            </Group>
            <Group gap={5}>
              <IconMail size={16} aria-hidden />
              <Text size={"sm"}>{result.email}</Text>
            </Group>
          </Group>
        </Stack>
        <Table verticalSpacing={"xs"} layout={"fixed"}>
          <Table.Tbody>
            <Table.Tr>
              <Table.Th>Utdelt hos</Table.Th>
              <Table.Td>{result.handoutBranch}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>Utdelt den</Table.Th>
              <Table.Td>{norwegianTime(result.handoutTime).format("DD.MM.YYYY")}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>Frist</Table.Th>
              <Table.Td>{norwegianTime(result.deadline).format("DD.MM.YYYY")}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Stack>
    </Paper>
  );
}
