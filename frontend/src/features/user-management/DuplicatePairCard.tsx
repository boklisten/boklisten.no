import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconArrowsJoin, IconExternalLink, IconEyeOff } from "@tabler/icons-react";
import { useState } from "react";

import type {
  DuplicatePair,
  DuplicateUserSummary,
} from "@/features/user-management/duplicateTypes";
import MergeCustomersModal from "@/features/user-management/MergeCustomersModal";
import PermissionBadge from "@/features/customer-search/PermissionBadge";
import TanStackButton from "@/shared/components/TanStackButton";
import useBranchNames from "@/features/user-management/useBranchNames";
import { norwegianTime } from "@/shared/utils/dayjs";

function CountsLine({ user }: { user: DuplicateUserSummary }) {
  const counts = [
    `${user.activeBooks} aktive bøker`,
    `${user.orderedItems} bestilte bøker`,
    `${user.activeMatches} aktive overleveringer`,
  ];
  return (
    <Text size="sm" c="dimmed">
      {counts.join(" · ")}
    </Text>
  );
}

function UserSummary({ user, branchName }: { user: DuplicateUserSummary; branchName?: string }) {
  return (
    <Stack gap={4} miw={0}>
      <Group gap="xs">
        <Text fw={600}>{user.name || "Uten navn"}</Text>
        <PermissionBadge permission={user.permission} size="sm" />
        {branchName && (
          <Badge variant="light" size="sm">
            {branchName}
          </Badge>
        )}
      </Group>
      <Text size="sm" style={{ overflowWrap: "anywhere" }}>
        {user.email}
      </Text>
      {user.phone && <Text size="sm">{user.phone}</Text>}
      <Tooltip
        label={
          user.lastActive
            ? norwegianTime(user.lastActive).format("DD.MM.YYYY HH:mm")
            : "Har aldri logget inn"
        }
      >
        <Text size="sm" c="dimmed" w="fit-content">
          Sist aktiv: {user.lastActive ? norwegianTime(user.lastActive).fromNow() : "aldri"}
        </Text>
      </Tooltip>
      <CountsLine user={user} />
      <TanStackButton
        to="/admin/kundesok"
        search={{ kunde: user.detailsId }}
        variant="subtle"
        size="compact-sm"
        leftSection={<IconExternalLink size={16} />}
        w="fit-content"
        px={0}
      >
        Åpne i kundesøk
      </TanStackButton>
    </Stack>
  );
}

export default function DuplicatePairCard({
  pair,
  ignored,
  onIgnore,
  onUnignore,
}: {
  pair: DuplicatePair;
  ignored?: boolean;
  onIgnore?: () => void;
  onUnignore?: () => void;
}) {
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const branchNames = useBranchNames();
  const [first, second] = pair.users;
  if (!first || !second) {
    return null;
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group gap={6}>
          {pair.reasons.map((reason) => (
            <Badge key={reason} variant="light" color="orange">
              {reason}
            </Badge>
          ))}
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <UserSummary user={first} branchName={branchNames.get(first.branchMembership ?? "")} />
          <UserSummary user={second} branchName={branchNames.get(second.branchMembership ?? "")} />
        </SimpleGrid>
        <Divider />
        <Group justify="flex-end" gap="xs">
          {ignored ? (
            <Button variant="default" leftSection={<IconEyeOff size={16} />} onClick={onUnignore}>
              Fjern fra ignorerte
            </Button>
          ) : (
            <Button variant="default" leftSection={<IconEyeOff size={16} />} onClick={onIgnore}>
              Ignorer
            </Button>
          )}
          <Button
            leftSection={<IconArrowsJoin size={16} />}
            onClick={() => setMergeModalOpen(true)}
          >
            Slå sammen
          </Button>
        </Group>
      </Stack>
      <MergeCustomersModal
        pair={pair}
        opened={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
      />
    </Paper>
  );
}
