import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

import AdminDashboard from "@/features/layout/AdminDashboard";

export const Route = createFileRoute("/(administrasjon)/admin/")({
  head: () =>
    seo({
      title: "bl-admin",
    }),
  component: AdminDashboard,
});
