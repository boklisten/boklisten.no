import { Accordion, Alert, Badge, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import {
  IconAlertTriangle,
  IconBook2,
  IconCalendarDue,
  IconClockExclamation,
} from "@tabler/icons-react";
import { ReactNode, useState } from "react";

import BranchBooksCountBadges from "@/features/branches/branch-books/BranchBooksCountBadges";
import BranchBooksEditMenu from "@/features/branches/branch-books/BranchBooksEditMenu";
import {
  BranchBooksEditKind,
  BranchBooksEditTarget,
  BranchBooksGroup,
  BranchBooksSummary,
  BranchBooksTitle,
} from "@/features/branches/branch-books/types";
import { norwegianTime } from "@/shared/utils/dayjs";

function formatDeadlineLabel(deadlineISO: string) {
  return norwegianTime(deadlineISO).format("D. MMMM YYYY");
}

function deadlineHasExpired(deadlineISO: string) {
  return norwegianTime(deadlineISO).isBefore(norwegianTime(), "day");
}

function groupTarget(group: BranchBooksGroup): BranchBooksEditTarget {
  return {
    description: `bøker med frist ${formatDeadlineLabel(group.deadline)}`,
    filter: { deadlines: group.deadlines },
    direct: group.direct,
    total: group.total,
    allowDescendants: true,
  };
}

function titleTarget(group: BranchBooksGroup, title: BranchBooksTitle): BranchBooksEditTarget {
  return {
    description: `«${title.title}» med frist ${formatDeadlineLabel(group.deadline)}`,
    filter: { deadlines: group.deadlines, itemId: title.itemId },
    direct: title.direct,
    total: title.total,
    allowDescendants: true,
  };
}

/**
 * The deadline → title levels of the branch-books tree. The leaf level (individual books) is
 * supplied by the page through renderDetails so active and ordered books can load and present
 * their own rows, and is only fetched once its title has been expanded.
 */
export default function BranchBooksTree({
  summary,
  isLoading,
  isError,
  treeLabel,
  emptyLabel,
  allowCancel,
  onEdit,
  renderDetails,
}: {
  summary: BranchBooksSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  /** e.g. "Aktive bøker etter frist" — names what the expandable top level is grouped by */
  treeLabel: string;
  emptyLabel: string;
  /** Adds the destructive "Avbestill" entry to every edit menu; only ordered books can be cancelled */
  allowCancel?: boolean;
  onEdit: (kind: BranchBooksEditKind, target: BranchBooksEditTarget) => void;
  renderDetails: (deadlines: string[], itemId: string, enabled: boolean) => ReactNode;
}) {
  const [openTitles, setOpenTitles] = useState<Record<string, string[]>>({});

  const header = (
    <Group gap={"xs"}>
      <IconCalendarDue size={20} />
      <Title order={3} size={"h4"}>
        {treeLabel}
      </Title>
    </Group>
  );
  if (isLoading) {
    return (
      <Stack gap={"xs"}>
        {header}
        <Skeleton h={50} />
        <Skeleton h={50} />
        <Skeleton h={50} />
      </Stack>
    );
  }
  if (isError) {
    return (
      <Stack gap={"xs"}>
        {header}
        <Alert color={"red"} icon={<IconAlertTriangle />}>
          Klarte ikke laste inn bøkene. Last siden på nytt for å prøve igjen.
        </Alert>
      </Stack>
    );
  }
  if (!summary || summary.groups.length === 0) {
    return (
      <Stack gap={"xs"}>
        {header}
        <Alert color={"gray"} icon={<IconBook2 />}>
          {emptyLabel}
        </Alert>
      </Stack>
    );
  }
  const showScopeSplit = summary.indirect > 0;
  return (
    <Stack gap={"xs"}>
      {header}
      <Accordion multiple variant={"separated"} chevronPosition={"left"}>
        {summary.groups.map((group) => (
          <Accordion.Item key={group.deadline} value={group.deadline}>
            <Group wrap={"nowrap"} gap={0} pr={"xs"}>
              <Accordion.Control>
                <Group justify={"space-between"} pr={"xs"}>
                  <Group gap={"xs"}>
                    <Group gap={"xs"} wrap={"nowrap"}>
                      <IconCalendarDue size={18} />
                      <Text fw={"bold"}>{formatDeadlineLabel(group.deadline)}</Text>
                    </Group>
                    {deadlineHasExpired(group.deadline) && (
                      <>
                        <Badge
                          visibleFrom={"sm"}
                          variant={"light"}
                          color={"red"}
                          leftSection={<IconClockExclamation size={12} />}
                        >
                          Fristen har utløpt
                        </Badge>
                        <Badge
                          hiddenFrom={"sm"}
                          variant={"light"}
                          color={"red"}
                          leftSection={<IconClockExclamation size={12} />}
                        >
                          Utløpt
                        </Badge>
                      </>
                    )}
                  </Group>
                  <BranchBooksCountBadges
                    direct={group.direct}
                    indirect={group.indirect}
                    total={group.total}
                    showScopeSplit={showScopeSplit}
                  />
                </Group>
              </Accordion.Control>
              <BranchBooksEditMenu
                label={`Endre bøker med frist ${formatDeadlineLabel(group.deadline)}`}
                allowCancel={allowCancel}
                onEdit={(kind) => onEdit(kind, groupTarget(group))}
              />
            </Group>
            <Accordion.Panel>
              <Accordion
                multiple
                variant={"contained"}
                chevronPosition={"left"}
                value={openTitles[group.deadline] ?? []}
                onChange={(value) =>
                  setOpenTitles((previous) => ({ ...previous, [group.deadline]: value }))
                }
              >
                {group.titles.map((title) => (
                  <Accordion.Item key={title.itemId} value={title.itemId}>
                    <Group wrap={"nowrap"} gap={0} pr={"xs"}>
                      <Accordion.Control>
                        <Group justify={"space-between"} pr={"xs"}>
                          <Group gap={"xs"} wrap={"nowrap"}>
                            <IconBook2 size={18} />
                            <Text>{title.title}</Text>
                          </Group>
                          <BranchBooksCountBadges
                            direct={title.direct}
                            indirect={title.indirect}
                            total={title.total}
                            showScopeSplit={showScopeSplit}
                          />
                        </Group>
                      </Accordion.Control>
                      <BranchBooksEditMenu
                        label={`Endre ${title.title}`}
                        allowCancel={allowCancel}
                        onEdit={(kind) => onEdit(kind, titleTarget(group, title))}
                      />
                    </Group>
                    <Accordion.Panel>
                      {renderDetails(
                        group.deadlines,
                        title.itemId,
                        (openTitles[group.deadline] ?? []).includes(title.itemId),
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
