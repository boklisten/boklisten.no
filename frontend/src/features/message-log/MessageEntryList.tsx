import { isFailureStatus, type MessageLogEntryDto } from "@boklisten/backend/shared/message-log";
import {
  Badge,
  Box,
  Collapse,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconMail,
  IconMessage2,
  IconShieldHeart,
} from "@tabler/icons-react";
import { useState } from "react";

import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { eventLabel, STATUS_META, TYPE_LABELS } from "@/features/message-log/meta";
import { norwegianTime } from "@/shared/utils/dayjs";

function formatTime(iso: string) {
  return norwegianTime(iso).format("DD.MM.YYYY HH:mm");
}

function EventTrail({ entry }: { entry: MessageLogEntryDto }) {
  return (
    <Stack gap={4}>
      {entry.events.map((event) => (
        <Group key={event.id} gap={"xs"} wrap={"nowrap"} align={"baseline"}>
          <Text size={"xs"} c={"dimmed"} style={{ whiteSpace: "nowrap" }}>
            {norwegianTime(event.occurredAt).format("DD.MM HH:mm:ss")}
          </Text>
          <Text size={"xs"}>{eventLabel(event.event)}</Text>
          {(event.reason ?? event.errorCode) && (
            <Text size={"xs"} c={"red"}>
              {event.reason ?? `Feilkode ${event.errorCode}`}
            </Text>
          )}
        </Group>
      ))}
      {entry.events.length === 0 && (
        <Text size={"xs"} c={"dimmed"} fs={"italic"}>
          Ingen hendelser registrert ennå
        </Text>
      )}
    </Stack>
  );
}

function MessageEntry({
  entry,
  guardianRecipients,
  withCustomerLink,
}: {
  entry: MessageLogEntryDto;
  guardianRecipients?: ReadonlySet<string>;
  withCustomerLink?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const failure = isFailureStatus(entry.status);
  const status = STATUS_META[entry.status];
  const toGuardian = guardianRecipients?.has(entry.recipient) ?? false;

  return (
    <Paper
      withBorder
      p={"sm"}
      radius={"md"}
      bg={failure ? "var(--mantine-color-red-light)" : undefined}
    >
      <UnstyledButton
        onClick={() => setExpanded((previous) => !previous)}
        w={"100%"}
        aria-expanded={expanded}
      >
        <Group gap={"sm"} wrap={"nowrap"} align={"flex-start"}>
          <ThemeIcon
            variant={"light"}
            color={failure ? "red" : "gray"}
            size={"lg"}
            radius={"md"}
            mt={2}
          >
            {entry.channel === "sms" ? <IconMessage2 size={18} /> : <IconMail size={18} />}
          </ThemeIcon>
          <Box flex={1} miw={0}>
            <Group gap={6} wrap={"wrap"}>
              <Text size={"sm"} fw={600}>
                {TYPE_LABELS[entry.messageType]}
              </Text>
              <Badge size={"sm"} variant={"light"} color={status.color}>
                {status.label}
              </Badge>
              {toGuardian && (
                <Badge
                  size={"sm"}
                  variant={"outline"}
                  color={"grape"}
                  leftSection={<IconShieldHeart size={12} />}
                >
                  Foresatt
                </Badge>
              )}
            </Group>
            <Text size={"xs"} c={"dimmed"} truncate>
              {entry.recipient} · {formatTime(entry.createdAt)}
              {entry.sendoutName ? ` · ${entry.sendoutName}` : ""}
            </Text>
            {failure && entry.statusDetail && (
              <Text size={"xs"} c={"red"} truncate>
                {entry.statusDetail}
              </Text>
            )}
          </Box>
          {expanded ? (
            <IconChevronDown size={16} color={"var(--mantine-color-dimmed)"} />
          ) : (
            <IconChevronRight size={16} color={"var(--mantine-color-dimmed)"} />
          )}
        </Group>
      </UnstyledButton>
      <Collapse expanded={expanded}>
        <Stack gap={"xs"} mt={"sm"} pl={44}>
          {entry.subject && (
            <Text size={"sm"} fw={500}>
              {entry.subject}
            </Text>
          )}
          {entry.smsBody && (
            <Text size={"sm"} style={{ whiteSpace: "pre-wrap" }}>
              {entry.smsBody}
            </Text>
          )}
          {entry.channel === "email" && entry.templateId && (
            <Text size={"xs"} c={"dimmed"}>
              E-postmal: {entry.templateId}
            </Text>
          )}
          <EventTrail entry={entry} />
          {withCustomerLink && entry.regardingCustomerDetailsId && (
            <TanStackAnchor
              size={"sm"}
              to={"/admin/hurtigutdeling"}
              search={{ kunde: entry.regardingCustomerDetailsId, visning: "meldinger" }}
            >
              Åpne kunden i hurtigutdeling
            </TanStackAnchor>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}

export default function MessageEntryList({
  entries,
  guardianRecipients,
  withCustomerLink,
  emptyText,
}: {
  entries: MessageLogEntryDto[];
  guardianRecipients?: ReadonlySet<string>;
  withCustomerLink?: boolean;
  emptyText: string;
}) {
  if (entries.length === 0) {
    return (
      <Text c={"dimmed"} fs={"italic"} py={"lg"} ta={"center"}>
        {emptyText}
      </Text>
    );
  }
  return (
    <Stack gap={"xs"}>
      {entries.map((entry) => (
        <MessageEntry
          key={entry.id}
          entry={entry}
          guardianRecipients={guardianRecipients}
          withCustomerLink={withCustomerLink}
        />
      ))}
    </Stack>
  );
}
