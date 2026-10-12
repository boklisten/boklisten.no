import { createFileRoute } from "@tanstack/react-router";

import BookManager from "@/features/book-management/BookManager";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/(administrator)/database/boker")({
  head: () =>
    seo({
      title: "Bøker | bl-admin",
    }),
  component: DatabaseBooksPage,
});

function DatabaseBooksPage() {
  return <BookManager />;
}
