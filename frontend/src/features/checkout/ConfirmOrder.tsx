import { Button, Table } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";
import useCart from "@/shared/hooks/useCart";
import { showErrorNotification } from "@/shared/utils/notifications";
import { useNavigate } from "@tanstack/react-router";

export default function ConfirmOrder({ orderId }: { orderId: string }) {
  const cart = useCart();
  const { api } = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const confirmCheckoutMutation = useMutation(
    api.checkout.confirmCheckout.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke bekrefte ordre!"),
      onSuccess: async () => {
        cart.clear();
        // Ordering a loan makes the backend demand a signature, so refresh the tasks before
        // navigating; otherwise AuthGuard reads a pre-order cache and skips the signing page
        await queryClient.invalidateQueries({
          queryKey: api.userDetail.getMyDetails.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: api.orders.getOpenOrders.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: api.customerItems.getCustomerItems.pathKey(),
        });
        void navigate({ to: "/order-history" });
      },
    }),
  );
  return (
    <>
      <Table
        data={{
          caption:
            "Du kan hente bøkene på stand i våre åpningstider. Dersom du går på VGS kan du kontakte en av våre kontakt-elever.",
          head: ["Tittel", "Handling"],
          body: cart
            .get()
            .map((cartItem) => [
              cartItem.title,
              cart.getOptionLabel(cart.getSelectedOption(cartItem)),
            ]),
        }}
      />
      <Button
        loading={confirmCheckoutMutation.isPending}
        onClick={() => {
          confirmCheckoutMutation.mutate({ params: { orderId: orderId ?? "" } });
        }}
      >
        Bekreft
      </Button>
    </>
  );
}
