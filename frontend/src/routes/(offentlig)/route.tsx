import PublicLayout from "@/features/PublicLayout";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)")({
  component: PublicPageLayout,
});

function PublicPageLayout() {
  return (
    <PublicLayout padding="md" withBorder>
      <Outlet />
    </PublicLayout>
  );
}
