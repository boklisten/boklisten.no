import { createFileRoute } from "@tanstack/react-router";
import RedirectToBlAdmin from "@/features/auth-linker/RedirectToBlAdmin";

export const Route = createFileRoute("/(administrasjon)/admin/faktura")({
  component: InvoicesPage,
});

function InvoicesPage() {
  // apply auth guard once implemented       <AuthGuard requiredPermission={USER_PERMISSION.ADMIN} />
  return <RedirectToBlAdmin path="invoices" />;
}
