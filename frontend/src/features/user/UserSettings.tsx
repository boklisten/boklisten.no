import { Skeleton, Stack, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";

import { authQueryOptions } from "@/features/auth/authQuery";
import ColorSchemeSelector from "@/features/user/ColorSchemeSelector";
import FormSectionTitle from "@/features/user/FormSectionTitle";
import LogoutButton from "@/features/user/LogoutButton";
import SecuritySection from "@/features/user/SecuritySection";
import UserSettingsForm from "@/features/user/UserSettingsForm";

/**
 * The user's own settings, the same on both sites: the details, how they may log in, the theme,
 * and the way out last.
 * Who is logged in is already in the menu's "Din bruker" row, so the page does not repeat it.
 */
export default function UserSettings() {
  const navigate = useNavigate();
  const { data: user, isLoading, isError } = useQuery(authQueryOptions());

  if (isLoading) {
    return (
      <Stack gap="xs" py="lg">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton height={40} key={`s-${index}`} />
        ))}
      </Stack>
    );
  }

  if (isError || !user) {
    void navigate({ to: "/auth/login", search: { redirect: "user-settings" } });
    return null;
  }

  return (
    <Stack gap="xl" py="lg">
      <Title>Brukerinnstillinger</Title>
      <UserSettingsForm user={user} />
      <SecuritySection user={user} />
      <AppearanceSection />
      <LogoutButton />
    </Stack>
  );
}

function AppearanceSection() {
  const titleId = useId();
  return (
    <Stack gap="xs">
      <FormSectionTitle id={titleId}>Utseende</FormSectionTitle>
      <ColorSchemeSelector fullWidth labelledBy={titleId} />
    </Stack>
  );
}
