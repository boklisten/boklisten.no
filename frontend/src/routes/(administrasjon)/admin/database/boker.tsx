import { createFileRoute } from "@tanstack/react-router";
import RedirectToBlAdmin from "@/features/auth-linker/RedirectToBlAdmin";

export const Route = createFileRoute("/(administrasjon)/admin/database/boker")({
  component: DatabaseBooksPage,
});

function DatabaseBooksPage() {
  return <RedirectToBlAdmin path="database/books" />;
}
