import type { CartItem } from "@boklisten/backend/shared/cart_item";
import { Loader, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { use, useEffect, useRef } from "react";
import { browser } from "react-dom";

import { authQueryKey } from "@/features/auth/authQuery";
import useCart from "@/shared/hooks/useCart";
import { api, apiClient } from "@/shared/utils/apiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

/** Shown while the checkout starts, and by the server while the cart is still only in the browser. */
export function CheckoutPending() {
  return (
    <>
      <Title>Ett øyeblikk...</Title>
      <Loader />
    </>
  );
}

/**
 * The cart lives in the browser, so the checkout can only start there. Books to borrow need a
 * signed agreement first, so the customer is sent to the signing step before any order exists.
 * An order with nothing to pay is placed at once, since the cart was its summary; the rest go on
 * to payment.
 */
export default function CheckoutHandler() {
  use(browser());
  const cart = useCart({ immediately: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const started = useRef(false);
  // Always fresh: the customer may have signed seconds ago on the signing step
  const { data: signature, isPending: signaturePending } = useQuery({
    ...api.signatures.me.queryOptions(),
    staleTime: 0,
  });

  const { mutate: confirmOrder } = useMutation(
    api.checkout.confirm.mutationOptions({
      onSuccess: async (_, { params: { orderId } }) => {
        cart.clear();
        // The placed order may change the customer's tasks (the backend reconciles the signature
        // demand on placement), so refresh them before navigating rather than let AuthGuard read
        // a pre-order cache
        await queryClient.invalidateQueries({ queryKey: authQueryKey() });
        void queryClient.invalidateQueries({ queryKey: api.orders.openItemsMe.pathKey() });
        void queryClient.invalidateQueries({ queryKey: api.customerItems.me.pathKey() });
        void navigate({ to: "/order-history", search: { bestilt: String(orderId) } });
      },
      onError: () => {
        showErrorNotification("Klarte ikke bekrefte bestillingen!");
        void navigate({ to: "/handlekurv" });
      },
    }),
  );

  const { mutate: initializeCheckout } = useMutation({
    mutationFn: async (cartItems: CartItem[]) =>
      apiClient.api.checkout.initialize({
        body: {
          cartItems: cartItems.map((cartItem) => {
            const selectedOption = cart.getSelectedOption(cartItem);
            return {
              id: cartItem.id,
              branchId: cartItem.branchId,
              type: selectedOption.type,
              price: selectedOption.price,
              to: selectedOption.to,
            };
          }),
        },
      }),
    onSuccess: async ({ nextStep, orderId, token, checkoutFrontendUrl }) => {
      switch (nextStep) {
        case "confirm": {
          confirmOrder({ params: { orderId } });
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

  // Once, as soon as the signature status is known: the cart is a new object every render, hence the ref
  useEffect(() => {
    if (started.current || signaturePending) {
      return;
    }
    started.current = true;
    if (cart.isEmpty()) {
      void navigate({ to: "/handlekurv" });
      return;
    }
    // A failed status lookup also lands on the signing step, which shows the error and retries
    if (cart.requiresSignature() && signature?.isSignatureValid !== true) {
      void navigate({ to: "/kasse/signering", replace: true });
      return;
    }
    initializeCheckout(cart.get());
  }, [cart, initializeCheckout, navigate, signature, signaturePending]);

  return <CheckoutPending />;
}
