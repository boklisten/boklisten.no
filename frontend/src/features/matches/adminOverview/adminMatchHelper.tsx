import type {
  AdminStandMatchWithDetails,
  UserMatchWithDetails,
} from "@boklisten/backend/shared/match/match-dtos";
import { Group, Text } from "@mantine/core";
import { IconChevronsRight, IconSwitchHorizontal } from "@tabler/icons-react";

export const AdminUserMatchTitle = ({ userMatch }: { userMatch: UserMatchWithDetails }) => {
  const hasAToB = userMatch.expectedAToBItems.length > 0;
  const hasBToA = userMatch.expectedBToAItems.length > 0;
  const nameA = userMatch.customerADetails.name;
  const nameB = userMatch.customerBDetails.name;

  const isExchange = hasAToB && hasBToA;
  const receivesFirst = !hasAToB && hasBToA;
  const leftName = receivesFirst ? nameB : nameA;
  const rightName = receivesFirst ? nameA : nameB;

  return (
    <Group gap={2}>
      <Text fw={"bold"} fz={"inherit"}>
        {leftName}
      </Text>
      {isExchange ? <IconSwitchHorizontal size={20} /> : <IconChevronsRight />}
      <Text fw={"bold"} fz={"inherit"}>
        {rightName}
      </Text>
    </Group>
  );
};

export const AdminStandMatchTitle = ({
  standMatch,
}: {
  standMatch: AdminStandMatchWithDetails;
}) => {
  const hasHandoff = standMatch.expectedHandoffItems.length > 0;
  const hasPickup = standMatch.expectedPickupItems.length > 0;
  const name = standMatch.customerDetails.name;

  const isExchange = hasHandoff && hasPickup;
  const picksUpOnly = !hasHandoff && hasPickup;
  const leftLabel = picksUpOnly ? "Stand" : name;
  const rightLabel = picksUpOnly ? name : "Stand";

  return (
    <Group gap={2}>
      <Text fw={"bold"} fz={"inherit"}>
        {leftLabel}
      </Text>
      {isExchange ? <IconSwitchHorizontal size={20} /> : <IconChevronsRight />}
      <Text fw={"bold"} fz={"inherit"}>
        {rightLabel}
      </Text>
    </Group>
  );
};
