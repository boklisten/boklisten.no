import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import AuthGuard from "@/features/auth/AuthGuard";
import { Container, Loader, Stack, Title } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { showErrorNotification } from "@/shared/utils/notifications";
import { norwegianTime } from "@/shared/utils/dayjs";
import type { CartItem } from "@boklisten/backend/shared/cart_item";
import useCart from "@/shared/hooks/useCart";
import useApiClient from "@/shared/hooks/useApiClient";
import { useMounted } from "@mantine/hooks";
import { useState } from "react";

export const Route = createFileRoute("/(offentlig)/kasse/v2")({
  head: () =>
    seo({
      title: "Kasse | Boklisten.no",
    }),
  component: RouteComponent,
});

function RouteComponent() {
  const cart = useCart();
  const { client } = useApiClient();
  const mounted = useMounted();
  const navigate = Route.useNavigate();
  const [hasStarted, setHasStarted] = useState(false);

  const initializeCheckoutMutation = useMutation({
    mutationFn: async (cartItems: CartItem[]) =>
      client.api.kustomCheckout.initializeCheckout({
        body: {
          cartItems: cartItems.map((cartItem) => {
            const selectedOption = cart.getSelectedOption(cartItem);
            return {
              id: cartItem.id,
              branchId: cartItem.branchId,
              type: selectedOption.type,
              price: selectedOption.price,
              to: norwegianTime(selectedOption.to).format("YYYY-MM-DD"),
            };
          }),
        },
      }),
    onSuccess: async ({ nextStep, orderId }) => {
      switch (nextStep) {
        case "confirm": {
          void navigate({ to: "/kasse/bekreft", search: { orderId } });
          break;
        }
        case "payment":
          void navigate({
            to: "/kasse/betaling/v2/$orderId",
            params: {
              orderId: orderId ?? "",
            },
          });
          break;
        default:
          throw new Error("Unknown checkout step");
      }
    },
    onError: () => {
      showErrorNotification("Noe gikk galt under genererering av betaling!");
      void navigate({ to: "/handlekurv" });
    },
  });

  function initializeCheckout() {
    if (hasStarted) return;
    setHasStarted(true);
    initializeCheckoutMutation.mutate(cart.get());
  }

  if (!mounted) {
    return null;
  }

  if (cart.isEmpty()) {
    void navigate({ to: "/handlekurv" });
    return null;
  }

  initializeCheckout();

  return (
    <AuthGuard>
      <Container size={"md"}>
        <Stack align={"center"} gap={"xs"}>
          <Title>Ett øyeblikk...</Title>
          <Loader />
        </Stack>
      </Container>
    </AuthGuard>
  );
}
