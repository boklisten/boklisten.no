import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(administrasjon)/admin/overleveringer")({
  component: AdminMatchPagesLayout,
});

function AdminMatchPagesLayout() {
  return <Outlet />;
}
