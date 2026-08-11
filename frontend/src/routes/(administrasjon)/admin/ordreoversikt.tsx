import { createFileRoute } from "@tanstack/react-router";
import RedirectToBlAdmin from "@/features/auth-linker/RedirectToBlAdmin";

export const Route = createFileRoute("/(administrasjon)/admin/ordreoversikt")({
  component: OrderManagerPage,
});

function OrderManagerPage() {
  return <RedirectToBlAdmin path={"order-manager"} />;
}
