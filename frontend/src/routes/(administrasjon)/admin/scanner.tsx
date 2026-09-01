import RedirectToBlAdmin from "@/features/auth-linker/RedirectToBlAdmin";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(administrasjon)/admin/scanner")({
  component: ScannerPage,
});

function ScannerPage() {
  return <RedirectToBlAdmin path="scanner" />;
}
