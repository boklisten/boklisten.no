import { Indicator } from "@mantine/core";
import type { ReactNode } from "react";

import useAuth from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";

export default function TasksIndicator({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const taskCount = countPendingTasks(user);

  if (taskCount === 0) {
    return children;
  }
  return (
    <Indicator color="red" disabled={taskCount === 0}>
      {children}
    </Indicator>
  );
}
