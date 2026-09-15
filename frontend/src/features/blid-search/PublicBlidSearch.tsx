import type {
  PublicBlidHandedOut,
  PublicBlidNotHandedOut,
} from "@boklisten/backend/shared/public_blid_lookup";
import {
  Badge,
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
import { IconClock, IconMail, IconPhone } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import BlidSearchControls from "@/features/blid-search/BlidSearchControls";
import BookCover from "@/features/book-cover/BookCover";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

/** Mirrors the backend's waiting period for new accounts, so the page can say so before a search. */
const LOOKUP_WAITING_PERIOD_HOURS = 24;

function formatMoment(date: Date | string): string {
  return norwegianTime(date).format("DD.MM.YYYY [kl.] HH:mm");
}

/** The customer-facing Boksøk: scan or type a blid and see who the book belongs to. */
export default function PublicBlidSearch() {
  const [blid, setBlid] = useState<string | null>(null);
  const { api } = useApiClient();
  const { data: userDetail } = useQuery(api.userDetails.me.queryOptions());

  const registeredAt = userDetail?.creationTime;
  const opensAt =
    registeredAt === undefined || registeredAt === null
      ? null
      : norwegianTime(registeredAt).add(LOOKUP_WAITING_PERIOD_HOURS, "hour");
  if (opensAt !== null && opensAt.isAfter(norwegianTime())) {
    return <LookupOpensLater opensAt={opensAt.toDate()} />;
  }

  return (
    <Stack>
      <BlidSearchControls compact={blid !== null} onSubmit={setBlid} />
      {blid !== null && <PublicBlidResult blid={blid} onClear={() => setBlid(null)} />}
    </Stack>
  );
}

/** Shown in place of the search while a new account waits out its first 24 hours. */
function LookupOpensLater({ opensAt }: { opensAt: Date }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <ThemeIcon variant="light" color="gray" size="xl" radius="xl">
          <IconClock aria-hidden />
        </ThemeIcon>
        <Stack gap={4} miw={0}>
          <Title order={2} size="h4" lh={1.2}>
            Kontoen din må være eldre enn {LOOKUP_WAITING_PERIOD_HOURS} timer
          </Title>
          <Text size="sm">
            Boksøk lar deg finne ut hvem en bok tilhører. Kontoen din må ha eksistert i over{" "}
            {LOOKUP_WAITING_PERIOD_HOURS} timer for at du skal få lov til å søke.
          </Text>
          <Text size="sm" fw={600}>
            Du får tilgang {formatMoment(opensAt)}.
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}

function PublicBlidResult({ blid, onClear }: { blid: string; onClear: () => void }) {
  const { api } = useApiClient();
  const { data, isPending, isError, error } = useQuery({
    ...api.publicBlidLookup.show.queryOptions({ params: { blid } }),
    // Every attempt counts against the daily budget, so a failed one is not retried behind the
    // customer's back.
    retry: false,
  });

  if (isPending) {
    return <Skeleton height={220} radius="md" />;
  }
  if (isError) {
    if (error.isStatus(429)) {
      const resetsAt = error.rawResponse?.headers.get("x-ratelimit-reset");
      return (
        <WarningAlert>
          Du har nådd grensen for antall søk per dag.
          {resetsAt === null || resetsAt === undefined
            ? " Prøv igjen i morgen."
            : ` Du kan søke igjen ${formatMoment(resetsAt)}.`}
        </WarningAlert>
      );
    }
    return <ErrorAlert>Kunne ikke søke opp boka. Prøv igjen.</ErrorAlert>;
  }

  switch (data.status) {
    case "notOpenYet": {
      return <LookupOpensLater opensAt={new Date(data.opensAt)} />;
    }
    case "suspended": {
      return (
        <WarningAlert>
          Du har søkt på for mange unike IDer som ikke er registrert, så Boksøk er sperret for
          kontoen din fram til {formatMoment(data.until)}.
        </WarningAlert>
      );
    }
    case "unregistered": {
      return <InfoAlert>Unik ID {blid} er ikke registrert hos Boklisten.</InfoAlert>;
    }
    case "notHandedOut": {
      return (
        <BookCard book={data} blid={blid} onClear={onClear}>
          <Stack gap={6}>
            <Badge variant="light" color="gray" tt="none" fw={600}>
              Ikke utdelt
            </Badge>
            <Text size="sm">
              Boka er registrert, men ikke utdelt til noen. Lever den til Boklisten.
            </Text>
          </Stack>
        </BookCard>
      );
    }
    case "handedOut": {
      return (
        <BookCard book={data} blid={blid} onClear={onClear}>
          <HolderDetails result={data} />
        </BookCard>
      );
    }
    default: {
      return <ErrorAlert>Kunne ikke søke opp boka. Prøv igjen.</ErrorAlert>;
    }
  }
}

/** The book itself, the same whether someone holds it or not; what follows says which. */
function BookCard({
  book,
  blid,
  onClear,
  children,
}: {
  book: Pick<PublicBlidHandedOut | PublicBlidNotHandedOut, "title" | "isbn">;
  blid: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Group gap="sm" align="center" wrap="nowrap" miw={0}>
            <BookCover isbn={book.isbn} title={book.title} />
            <Stack gap={4} miw={0}>
              <Title order={2} size="h4" lh={1.2}>
                {book.title}
              </Title>
              <Text size="sm" c="dimmed">
                ISBN {book.isbn} · Unik ID {blid}
              </Text>
            </Stack>
          </Group>
          <CloseButton aria-label="Lukk boksøket" onClick={onClear} />
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}

function HolderDetails({ result }: { result: PublicBlidHandedOut }) {
  return (
    <>
      <Stack gap={6}>
        <Text fz="sm" fw={500} c="dimmed">
          Tilhører
        </Text>
        <Text fw={700}>{result.name}</Text>
        <Group gap="md">
          <Group gap={5}>
            <IconPhone size={16} aria-hidden />
            <Text size="sm">{result.phone}</Text>
          </Group>
          <Group gap={5}>
            <IconMail size={16} aria-hidden />
            <Text size="sm">{result.email}</Text>
          </Group>
        </Group>
      </Stack>
      <Table verticalSpacing="xs" layout="fixed">
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
    </>
  );
}
