import { createFileRoute } from "@tanstack/react-router";
import RedirectToBlAdmin from "@/features/auth-linker/RedirectToBlAdmin";

export const Route = createFileRoute("/(administrasjon)/admin/handlekurv")({
  component: LegacyCartPage,
});

function LegacyCartPage() {
  return <RedirectToBlAdmin path="cart" />;
}
