import { createFileRoute } from "@tanstack/react-router";

import BulkCollectionPage from "@/features/bulk-collection/BulkCollectionPage";

export const Route = createFileRoute("/(administrasjon)/admin/hurtiginnsamling")({
  head: () => ({
    meta: [{ title: "Hurtiginnsamling | bl-admin" }],
  }),
  component: BulkCollectionPage,
});
