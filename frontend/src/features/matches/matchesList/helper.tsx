import { Group, Text } from "@mantine/core";
import { IconChevronsRight, IconSwitchHorizontal } from "@tabler/icons-react";

import { partyName } from "@/features/matches/forViewer";
import type { ViewerMatch } from "@/features/matches/forViewer";

export function formatActionsString(handoffItems: number, pickupItems: number) {
  const hasHandoffItems = handoffItems > 0;
  const hasPickupItems = pickupItems > 0;
  const stringBuilder: string[] = ["Du skal "];

  if (hasHandoffItems) {
    stringBuilder.push("levere ");
    if (handoffItems === 1) {
      stringBuilder.push("én");
      if (!hasPickupItems) {
        stringBuilder.push(" bok");
      }
    } else {
      stringBuilder.push(`${handoffItems}`);
      if (!hasPickupItems) {
        stringBuilder.push(" bøker");
      }
    }
    if (hasPickupItems) {
      stringBuilder.push(" og ");
    }
  }
  if (hasPickupItems) {
    stringBuilder.push("motta ");
    if (pickupItems === 1) {
      stringBuilder.push("én bok");
    } else {
      stringBuilder.push(`${pickupItems} bøker`);
    }
  }
  return stringBuilder.join("");
}

export function FormattedDatetime({ date }: { date: Date }) {
  const dateString = date.toLocaleDateString("no", {
    timeZone: "Europe/Oslo",
    dateStyle: "long",
  });
  const timeString = date.toLocaleTimeString("no", {
    timeZone: "Europe/Oslo",
    timeStyle: "short",
  });
  return (
    <Group gap={0}>
      <Text>{timeString}</Text>
      <Text c="dimmed">, {dateString}</Text>
    </Group>
  );
}

export function MatchTitle({ viewerMatch }: { viewerMatch: ViewerMatch }) {
  const other = viewerMatch.counterparty ? partyName(viewerMatch.counterparty) : "stand";
  const otherLabel = other === "stand" ? "Stand" : other;
  const delivers = viewerMatch.toDeliver.length > 0;
  const receives = viewerMatch.toReceive.length > 0;

  const me = (
    <Text c="dimmed" fz="inherit">
      Meg
    </Text>
  );
  const them = (
    <Text fw="bold" fz="inherit">
      {otherLabel}
    </Text>
  );

  if (delivers && !receives) {
    return (
      <Group gap={2}>
        {me}
        <IconChevronsRight />
        {them}
      </Group>
    );
  }
  if (receives && !delivers) {
    return (
      <Group gap={2}>
        {them}
        <IconChevronsRight />
        {me}
      </Group>
    );
  }
  return (
    <Group gap={2}>
      {me}
      <IconSwitchHorizontal size={20} />
      {them}
    </Group>
  );
}
