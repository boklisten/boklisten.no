import { Badge, NavLink } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

import useApiClient from "@/shared/hooks/useApiClient";

export default function TasksLink() {
  const { api } = useApiClient();

  const {
    data: userDetail,
    isLoading: isLoadingUserDetail,
    isError: isErrorUserDetail,
  } = useQuery(api.userDetail.getMyDetails.queryOptions());

  const taskCount =
    isLoadingUserDetail || isErrorUserDetail || !userDetail?.tasks
      ? 0
      : (userDetail.tasks.confirmDetails ? 1 : 0) + (userDetail.tasks.signAgreement ? 1 : 0);

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
