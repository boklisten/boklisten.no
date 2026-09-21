import { Badge, NavLink } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

import useApiClient from "@/shared/hooks/useApiClient";
import { hasAccessToken } from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";

export default function TasksLink() {
  const { api } = useApiClient();

  const {
    data: userDetail,
    isLoading: isLoadingUserDetail,
    isError: isErrorUserDetail,
  } = useQuery({ ...api.users.me.queryOptions(), enabled: hasAccessToken });

  const taskCount = isLoadingUserDetail || isErrorUserDetail ? 0 : countPendingTasks(userDetail);

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
