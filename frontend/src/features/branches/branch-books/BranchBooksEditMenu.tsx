import { ActionIcon, Menu } from "@mantine/core";
import {
  IconArrowsExchange,
  IconCalendarTime,
  IconCircleX,
  IconDotsVertical,
} from "@tabler/icons-react";

import { BranchBooksEditKind } from "@/features/branches/branch-books/types";

export default function BranchBooksEditMenu({
  label,
  allowCancel,
  onEdit,
}: {
  label: string;
  /** Adds the destructive "Avbestill" entry; only ordered books can be cancelled */
  allowCancel?: boolean;
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
        {allowCancel && (
          <>
            <Menu.Divider />
            <Menu.Item
              color={"red"}
              leftSection={<IconCircleX size={16} />}
              onClick={() => onEdit("cancel")}
            >
              Avbestill
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
