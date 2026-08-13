import { Badge, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { ResourcesDayView } from "@mantine/schedule";
import { IconCalendarEvent, IconEdit, IconSparkles } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import type { Round } from "@/features/matches/rounds/useRounds";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";
// The month and weekday names below read Norwegian only because the shared dayjs setup registered
// the locale. Imported here so the card carries that dependency itself rather than relying on
// whatever else happened to load it. The dates are plain `YYYY-MM-DD` calendar days, so they are
// read as written rather than through `norwegianTime` — a zone conversion could only push a
// date-only value off the day it names.
import "@/shared/utils/dayjs";

/**
 * The whole hours bracketing everything the round does, so the axis covers the day without
 * starting or ending mid-hour. Times are zero-padded `HH:MM`, so they sort as plain strings.
 */
function axisBounds(round: Round) {
  const opens = round.userMeetingFrom < round.standFrom ? round.userMeetingFrom : round.standFrom;
  const closes = round.userMeetingTo > round.standTo ? round.userMeetingTo : round.standTo;
  const lastHour = Number(closes.slice(0, 2)) + (closes.endsWith(":00") ? 0 : 1);

  return {
    startTime: `${opens.slice(0, 2)}:00:00`,
    // A window ending 23:10–23:50 needs the axis to run to end of day; the view's own time math
    // is plain seconds arithmetic, so "24:00:00" is a valid axis end.
    endTime: `${String(Math.min(lastHour, 24)).padStart(2, "0")}:00:00`,
  };
}

/**
 * The day drawn to scale.
 *
 * Two windows written out as text — 12:00–14:00 and 12:00–16:00 — read as four unrelated numbers.
 * Laid against a shared hour axis they answer the question an admin actually has: do the students
 * turn up while the stand is open, and how much of the stand's day is left over.
 *
 * The axis is cropped to the hours the round actually uses rather than a full day, so a two-hour
 * round does not render as a sliver of empty grid.
 */
function DayTimeline({ round }: { round: Round }) {
  const day = round.meetingDate;
  const at = (time: string) => `${day} ${time}:00`;

  return (
    <ResourcesDayView
      mode={"static"}
      date={day}
      // The card already states the date above, and there is nothing to navigate to from a plan.
      withHeader={false}
      labels={{ resources: "Når" }}
      {...axisBounds(round)}
      intervalMinutes={60}
      rowHeight={56}
      withCurrentTimeIndicator={false}
      // Hours shrink on a narrow screen so the whole round stays on screen. At a fixed slot width a
      // phone shows the first hour or two and the student row reads as empty until you scroll it.
      style={
        { "--resources-day-view-slot-width": "clamp(42px, 11vw, 80px)" } as React.CSSProperties
      }
      resources={[
        { id: "elever", label: "Elever", color: "blue" },
        { id: "stand", label: "Stand", color: "teal" },
      ]}
      events={[
        {
          id: "elever",
          resourceId: "elever",
          title: `${round.userMeetingFrom}–${round.userMeetingTo}`,
          start: at(round.userMeetingFrom),
          end: at(round.userMeetingTo),
          color: "blue",
        },
        {
          id: "stand",
          resourceId: "stand",
          title: `${round.standFrom}–${round.standTo}`,
          start: at(round.standFrom),
          end: at(round.standTo),
          color: "teal",
        },
      ]}
    />
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={4} style={{ minWidth: 0 }}>
      <Text size={"xs"} c={"dimmed"} tt={"uppercase"} fw={600} lh={1.4}>
        {label}
      </Text>
      {children}
    </Stack>
  );
}

/**
 * What an admin sees instead of a match list while a round is still only planned.
 *
 * It has one job: let someone confirm the plan is right before committing to it, since generating
 * is the point of no return short of deleting the matches again.
 */
export default function PlannedRoundCard({
  round,
  onEdit,
  onGenerate,
  generating,
}: {
  round: Round;
  onEdit: () => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  const { api } = useApiClient();
  const { isAdmin } = useAuth();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());

  const meetingDay = dayjs(round.meetingDate);

  return (
    <Card withBorder radius={"md"} padding={"lg"}>
      <Stack gap={"lg"}>
        <Stack gap={4}>
          <Badge variant={"light"} color={"gray"} leftSection={<IconCalendarEvent size={12} />}>
            Planlagt
          </Badge>
          <Title order={2}>{round.name}</Title>
          <Text c={"dimmed"} size={"sm"}>
            Ingen overleveringer er laget ennå. Se over planen, og generer når den stemmer.
          </Text>
        </Stack>

        {/* Sized to the timeline: the hour axis has a fixed scale, so a full-width card would
            leave the schedule stranded against its left edge on a wide screen. */}
        <Card
          withBorder
          radius={"sm"}
          padding={"md"}
          bg={"var(--mantine-color-body)"}
          w={"fit-content"}
          maw={"100%"}
        >
          <Stack gap={"md"}>
            <Group gap={"xs"} align={"baseline"}>
              <Text fw={700} size={"lg"}>
                {meetingDay.format("D. MMMM YYYY")}
              </Text>
              <Text c={"dimmed"} size={"sm"}>
                {meetingDay.format("dddd")}
              </Text>
            </Group>
            <DayTimeline round={round} />
          </Stack>
        </Card>

        <Group gap={"xl"} align={"flex-start"} wrap={"wrap"}>
          <Detail label={"Frist på bøkene"}>
            <Text fw={500}>{dayjs(round.deadline).format("D. MMMM YYYY")}</Text>
          </Detail>

          <Detail label={"Stand"}>
            <Text fw={500}>{round.standLocation}</Text>
          </Detail>

          <Detail label={"Møtesteder for elever"}>
            <Group gap={6}>
              {round.userMatchLocations.map((location) => (
                <Badge key={location} variant={"default"} radius={"sm"}>
                  {location}
                </Badge>
              ))}
            </Group>
          </Detail>

          <Detail label={"Filialer"}>
            <Group gap={6}>
              {round.branches.map((id) => (
                <Badge key={id} variant={"default"} radius={"sm"}>
                  {branches?.find((branch) => branch.id === id)?.name ?? "Ukjent filial"}
                </Badge>
              ))}
            </Group>
            {round.includeCustomerItemsFromOtherBranches && (
              <Text size={"xs"} c={"dimmed"}>
                Tar også med bøker delt ut ved andre filialer
              </Text>
            )}
          </Detail>
        </Group>

        {isAdmin && (
          <Group justify={"flex-end"} gap={"sm"}>
            <Button
              variant={"default"}
              leftSection={<IconEdit size={16} />}
              onClick={onEdit}
              disabled={generating}
            >
              Rediger planen
            </Button>
            <Button
              leftSection={<IconSparkles size={16} />}
              onClick={onGenerate}
              loading={generating}
            >
              Generer overleveringer
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
