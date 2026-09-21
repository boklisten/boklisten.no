import { Indicator } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";
import { hasAccessToken } from "@/shared/hooks/useAuth";
import { countPendingTasks } from "@/shared/utils/tasks";
import type { ReactNode } from "react";

export default function TasksIndicator({ children }: { children: ReactNode }) {
  const { api } = useApiClient();
  const {
    data: userDetail,
    isLoading: isLoadingUserDetail,
    isError: isErrorUserDetail,
  } = useQuery({ ...api.users.me.queryOptions(), enabled: hasAccessToken });

  const taskCount = isLoadingUserDetail || isErrorUserDetail ? 0 : countPendingTasks(userDetail);

  if (taskCount === 0) {
    return children;
  }
  return (
    <Indicator color="red" disabled={taskCount === 0}>
      {children}
    </Indicator>
  );
}
