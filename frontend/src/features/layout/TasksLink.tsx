import { Badge, NavLink } from "@mantine/core";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

import useAuth from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";

export default function TasksLink() {
  const { user } = useAuth();
  const taskCount = countPendingTasks(user);

  if (taskCount === 0) {
    return null;
  }
  return (
    <NavLink
      label="Oppgaver"
      description={`Du har ${taskCount} ${taskCount === 1 ? "oppgave" : "oppgaver"} som må fullføres.`}
      to="/oppgaver"
      leftSection={
        <Badge color="red" circle>
          {taskCount}
        </Badge>
      }
      component={TanStackAnchor}
      color="red"
      active
      variant="subtle"
      onClick={close}
    />
  );
}
