import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

import BulkCollectionPage from "@/features/bulk-collection/BulkCollectionPage";

export const Route = createFileRoute("/(administrasjon)/admin/hurtiginnsamling")({
  head: () =>
    seo({
      title: "Hurtiginnsamling | bl-admin",
    }),
  component: BulkCollectionPage,
});
