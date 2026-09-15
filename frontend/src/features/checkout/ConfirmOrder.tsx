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
    api.checkout.confirm.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke bekrefte ordre!"),
      onSuccess: async () => {
        cart.clear();
        // The placed order may change the customer's tasks (the backend reconciles the signature
        // demand on placement), so refresh them before navigating rather than let AuthGuard read
        // a pre-order cache
        await queryClient.invalidateQueries({
          queryKey: api.userDetails.me.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: api.orders.openItemsMe.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: api.customerItems.me.pathKey(),
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
