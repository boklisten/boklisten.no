import { Badge, UnstyledButton } from "@mantine/core";
import { IconMenu2 } from "@tabler/icons-react";

import classes from "@/features/layout/public-nav/PublicNav.module.css";
import useAuth from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";

/**
 * The button that opens the menu sheet, with the count of tasks the visitor must finish. The
 * same control on the phone tab bar and top right on desktop; `className` gives it the bar's look.
 */
export default function MenuButton({
  className,
  iconClassName,
  opened,
  onOpen,
}: {
  className: string;
  iconClassName: string;
  opened: boolean;
  onOpen: () => void;
}) {
  const { user } = useAuth();
  const taskCount = countPendingTasks(user);
  return (
    <UnstyledButton
      className={className}
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={opened}
    >
      <span className={iconClassName}>
        <IconMenu2 size={24} stroke={1.6} aria-hidden />
        {taskCount > 0 && (
          <Badge
            className={classes.tabBadge}
            color="red"
            size="xs"
            circle
            aria-label={`${taskCount} ${taskCount === 1 ? "oppgave" : "oppgaver"}`}
          >
            {taskCount}
          </Badge>
        )}
      </span>
      Meny
    </UnstyledButton>
  );
}
