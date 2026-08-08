import type { CartItem } from "@boklisten/backend/shared/cart_item";
import { Loader, Title } from "@mantine/core";
import { useMounted } from "@mantine/hooks";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import useApiClient from "@/shared/hooks/useApiClient";
import useCart from "@/shared/hooks/useCart";
import { showErrorNotification } from "@/shared/utils/notifications";
import { norwegianTime } from "@/shared/utils/dayjs";
import { useNavigate } from "@tanstack/react-router";

export default function CheckoutHandler() {
  const cart = useCart();
  const { client } = useApiClient();
  const mounted = useMounted();
  const navigate = useNavigate();
  const [hasStarted, setHasStarted] = useState(false);

  const initializeCheckoutMutation = useMutation({
    mutationFn: async (cartItems: CartItem[]) =>
      client.api.checkout.initializeCheckout({
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
    onSuccess: async ({ nextStep, orderId, token, checkoutFrontendUrl }) => {
      switch (nextStep) {
        case "confirm": {
          void navigate({ to: "/kasse/bekreft", search: { orderId } });
          break;
        }
        case "payment":
          void navigate({
            to: "/kasse/betaling",
            search: { token, checkoutFrontendUrl },
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
    <>
      <Title>Ett øyeblikk...</Title>
      <Loader />
    </>
  );
}
