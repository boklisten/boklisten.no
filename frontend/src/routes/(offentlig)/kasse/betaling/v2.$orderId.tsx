import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import KustomCheckout from "@/features/checkout/KustomCheckout";

export const Route = createFileRoute("/(offentlig)/kasse/betaling/v2/$orderId")({
  head: () =>
    seo({
      title: "Betaling | Boklisten.no",
    }),
  component: RouteComponent,
});

function RouteComponent() {
  const { orderId } = Route.useParams();

  return <KustomCheckout orderId={orderId ?? ""} />;
}
