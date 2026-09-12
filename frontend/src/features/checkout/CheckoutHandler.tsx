import type { CartItem } from "@boklisten/backend/shared/cart_item";
import { Loader, Title } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { use, useEffect, useRef } from "react";
import { browser } from "react-dom";

import useApiClient from "@/shared/hooks/useApiClient";
import useCart from "@/shared/hooks/useCart";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";
import { norwegianTime } from "@/shared/utils/dayjs";
import { useNavigate } from "@tanstack/react-router";

/** Shown while the checkout starts, and by the server while the cart is still only in the browser. */
export function CheckoutPending() {
  return (
    <>
      <Title>Ett øyeblikk...</Title>
      <Loader />
    </>
  );
}

/** The cart lives in the browser, so the checkout can only start there. */
export default function CheckoutHandler() {
  use(browser());
  const cart = useCart({ immediately: true });
  const { client } = useApiClient();
  const navigate = useNavigate();
  const started = useRef(false);

  const { mutate: initializeCheckout } = useMutation({
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
        case "payment": {
          void navigate({
            to: "/kasse/betaling",
            search: { token, checkoutFrontendUrl },
          });
          break;
        }
        default: {
          throw new Error("Unknown checkout step");
        }
      }
    },
    onError: (error) => {
      showErrorNotification(errorMessage(error, "Noe gikk galt under genererering av betaling!"));
      void navigate({ to: "/handlekurv" });
    },
  });

  // Once, after the first render: the cart is a new object every render, hence the ref
  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    if (cart.isEmpty()) {
      void navigate({ to: "/handlekurv" });
      return;
    }
    initializeCheckout(cart.get());
  }, [cart, initializeCheckout, navigate]);

  return <CheckoutPending />;
}
