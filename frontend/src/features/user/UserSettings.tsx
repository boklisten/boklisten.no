import { Skeleton, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import UserSettingsForm from "@/features/user/UserSettingsForm";
import { useNavigate } from "@tanstack/react-router";
import { authQueryOptions } from "@/features/auth/authQuery";

function UserSettings() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery(authQueryOptions());

  if (isLoading) {
    return (
      <Stack>
        <Skeleton height={60} />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton height={40} key={`s-${index}`} />
        ))}
      </Stack>
    );
  }

  if (isError || !data) {
    void navigate({ to: "/auth/login", search: { redirect: "user-settings" } });
    return null;
  }

  return <UserSettingsForm userDetail={data} />;
}

export default UserSettings;
