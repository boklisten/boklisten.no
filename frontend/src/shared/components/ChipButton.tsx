import { Button } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import type { IconBuildingStore } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * A chip-shaped button for an editable fact: styled like a badge, with Mantine's hover and focus.
 * The pencil marks it as editable — hover alone would leave touch screens without a cue.
 */
export default function ChipButton({
  icon: Icon,
  color,
  title,
  onClick,
  children,
}: {
  icon: typeof IconBuildingStore;
  color: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="light"
      color={color}
      size="compact-xs"
      radius="xl"
      fw={500}
      title={title}
      leftSection={<Icon size={12} aria-hidden />}
      rightSection={<IconPencil size={12} aria-hidden />}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
