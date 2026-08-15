import { ActionIcon, Menu } from "@mantine/core";
import { IconArrowsExchange, IconCalendarTime, IconDotsVertical } from "@tabler/icons-react";

import { BranchBooksEditKind } from "@/features/branches/branch-books/types";

export default function BranchBooksEditMenu({
  label,
  onEdit,
}: {
  label: string;
  onEdit: (kind: BranchBooksEditKind) => void;
}) {
  return (
    <Menu position={"bottom-end"} withinPortal>
      <Menu.Target>
        <ActionIcon variant={"subtle"} color={"gray"} aria-label={label}>
          <IconDotsVertical size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconCalendarTime size={16} />} onClick={() => onEdit("deadline")}>
          Endre frist
        </Menu.Item>
        <Menu.Item leftSection={<IconArrowsExchange size={16} />} onClick={() => onEdit("branch")}>
          Flytt til annen filial
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
