import { Container } from "@mantine/core";
import AuthGuard from "@/features/auth/AuthGuard";
import UserSettings from "@/features/user/UserSettings";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/user-settings")({
  head: () =>
    seo({
      title: "Brukerinnstillinger | Boklisten.no",
      description: "Endre din informasjon",
    }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Container size="xs">
      <AuthGuard>
        <UserSettings />
      </AuthGuard>
    </Container>
  );
}
