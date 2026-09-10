import type {
  StandCartCheckoutPayment,
  StandCartCheckoutState,
  StandCartConfirmation,
} from "@boklisten/backend/shared/stand_cart";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StandCart } from "@/features/stand-cart/useStandCart";
import MonitoringNotice from "@/shared/components/MonitoringNotice";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

// Above the drawer (260), so a decision is always reachable
const CONFIRM_Z_INDEX = 350;

export type Payment = StandCartCheckoutPayment;
export type Delivery = { trackingNumber: string } | null;
export type FailedStatus = Exclude<StandCartCheckoutState["status"], "pending" | "paid" | "placed">;

/** The cart's lines as the checkout and the refund plan want them, prices included so the server can refuse a stale one. */
export function checkoutLines(cart: StandCart) {
  return cart.lines.map(({ line, choice, resolved }) => ({
    source: line.source,
    choice,
    ...(line.blid === null ? {} : { blid: line.blid }),
    expectedPrice: resolved?.price ?? 0,
  }));
}

/** Whether the backend's answer means the order went through. */
export function isPlaced(state: StandCartCheckoutState): boolean {
  return state.status === "paid" || state.status === "placed";
}

export interface StandCartSubmitter {
  /**
   * Sends the cart as an order. Resolves with the backend's answer, or null when the employee
   * backed out of a confirmation or the request failed; the failure has been shown already.
   */
  submit: (payment: Payment | null, delivery: Delivery) => Promise<StandCartCheckoutState | null>;
  /** The bookkeeping once the backend has answered: lists refreshed and the cart emptied when placed. */
  settle: (state: StandCartCheckoutState) => void;
  isPending: boolean;
}

/**
 * Turning the cart into an order, for whichever step does it: the cart step itself when there is
 * nothing to pay, the payment step otherwise. The two things the employee must knowingly
 * override, a missing signature and a book due from another student, are confirmed right before
 * the order is sent.
 */
export default function useStandCartSubmit({
  cart,
  customer,
  notifyByEmail,
  onCartChanged,
}: {
  cart: StandCart;
  customer: UserDetail;
  notifyByEmail: boolean;
  /** The backend refused the cart and re-pricing it changed what the employee sees. */
  onCartChanged: () => void;
}): StandCartSubmitter {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const { data: signatureStatus } = useQuery(
    api.signatures.getSignature.queryOptions({ params: { detailsId: customer.id } }),
  );
  const checkoutMutation = useMutation(
    api.standCart.checkout.mutationOptions({
      onError: async (error) => {
        showErrorNotification(errorMessage(error, "Klarte ikke fullføre handlekurven"));
        // Whatever stopped it, the lines are re-priced so the cart shows the current truth; when
        // that moved anything, the employee is taken back to look at it rather than left on a
        // payment form that would fail the same way again
        if (await cart.refresh()) {
          onCartChanged();
        }
      },
    }),
  );

  /** The order changed what every list on the customer shows. */
  function invalidate() {
    for (const key of [
      api.orders.getPlacedOrders.pathKey(),
      api.customerItems.getActiveCustomerItemsForCustomer.pathKey(),
      api.matches.getMatchesForCustomer.pathKey(),
      api.orderHistory.getForCustomer.pathKey(),
      api.blidSearch.lookup.pathKey(),
      api.orderManager.listOpenOrders.pathKey(),
      api.orderManager.getOrder.pathKey(),
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }

  /** The obstacles the employee must knowingly accept before the order is sent. */
  async function confirmObstacles(): Promise<StandCartConfirmation[] | null> {
    const confirmed: StandCartConfirmation[] = [];
    const [peer] = cart.peerNotes;
    if (peer && peer.kind === "peer-match") {
      const ok = await asyncConfirmModal({
        title: "Skal mottas fra en annen elev",
        children: (
          <Text>
            Denne boka skal {customer.name} få fra{" "}
            <Text span fw={700}>
              {peer.deliverFromName}
            </Text>
            . Er du sikker på at du vil dele den ut på stand likevel?
          </Text>
        ),
        confirmLabel: "Del ut likevel",
        confirmColor: "red",
        zIndex: CONFIRM_Z_INDEX,
      });
      if (!ok) {
        return null;
      }
      confirmed.push("peer-match");
    }
    if (cart.hasLoanHandout && signatureStatus?.signatureRequired) {
      const ok = await asyncConfirmModal({
        title: signatureStatus.outgrownGuardianSignature
          ? "Signert av foresatt, må signeres på nytt"
          : "Kunden mangler gyldig signatur",
        children: (
          <Stack gap="xs">
            <Text>Bøker skal normalt ikke deles ut uten gyldig signatur.</Text>
            <MonitoringNotice />
          </Stack>
        ),
        confirmLabel: "Del ut likevel",
        confirmColor: "red",
        zIndex: CONFIRM_Z_INDEX,
      });
      if (!ok) {
        return null;
      }
      confirmed.push("missing-signature");
    }
    return confirmed;
  }

  async function submit(
    payment: Payment | null,
    delivery: Delivery,
  ): Promise<StandCartCheckoutState | null> {
    if (cart.cart.branchId === null) {
      return null;
    }
    const confirmed = await confirmObstacles();
    if (confirmed === null) {
      return null;
    }
    try {
      return await checkoutMutation.mutateAsync({
        body: {
          customerId: customer.id,
          branchId: cart.cart.branchId,
          lines: checkoutLines(cart),
          payment: cart.total === 0 ? null : payment,
          delivery,
          notifyByEmail,
          confirmed,
        },
      });
    } catch {
      // Shown by the mutation's onError
      return null;
    }
  }

  function settle(state: StandCartCheckoutState) {
    if (isPlaced(state)) {
      invalidate();
      cart.clear();
    }
  }

  return { submit, settle, isPending: checkoutMutation.isPending };
}
