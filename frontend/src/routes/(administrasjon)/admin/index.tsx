import { createFileRoute } from "@tanstack/react-router";

import AdminDashboard from "@/features/layout/AdminDashboard";

export const Route = createFileRoute("/(administrasjon)/admin/")({
  head: () => ({
    meta: [{ title: "bl-admin" }],
  }),
  component: AdminDashboard,
});
