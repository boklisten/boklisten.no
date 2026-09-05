import { createFileRoute } from "@tanstack/react-router";

import AuthGuard from "@/features/auth/AuthGuard";
import BookManager from "@/features/book-management/BookManager";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/database/boker")({
  head: () =>
    seo({
      title: "Bøker | bl-admin",
    }),
  component: DatabaseBooksPage,
});

function DatabaseBooksPage() {
  return (
    <AuthGuard requiredPermission="admin">
      <BookManager />
    </AuthGuard>
  );
}
