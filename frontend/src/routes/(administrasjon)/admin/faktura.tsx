import { createFileRoute } from "@tanstack/react-router";

import AuthGuard from "@/features/auth/AuthGuard";
import InvoiceManager from "@/features/invoices/InvoiceManager";
import { validateInvoiceSearch } from "@/features/invoices/invoiceParams";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/faktura")({
  validateSearch: validateInvoiceSearch,
  head: () =>
    seo({
      title: "Faktura | bl-admin",
    }),
  component: InvoicesPage,
});

function InvoicesPage() {
  return (
    <AuthGuard requiredPermission="admin">
      <InvoiceManager />
    </AuthGuard>
  );
}
