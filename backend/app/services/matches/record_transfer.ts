import * as Sentry from "@sentry/node";
import type { Infer } from "@vinejs/vine/types";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import Item from "#models/item";
import Order from "#models/order";
import type { NewOrder } from "#models/order";
import type OrderItem from "#models/order_item";
import User from "#models/user";
import BlidService from "#services/blid_service";
import { OrderToCustomerItemGenerator } from "#services/customer_items/order_to_customer_item_generator";
import { OrderActive } from "#services/orders/order_active";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { OrderValidator } from "#services/orders/validation/order_validator";
import { extendRemainingCopyDeadlines } from "#services/matches/copy_deadlines";
import {
  isDischargeConflict,
  MatchRepository,
  requireHandoverBlid,
} from "#services/matches/match_repository";
import { BlError } from "#shared/bl-error";
import { itemsAreEquivalent } from "#shared/item-equivalence";
import type { matchTransferSchema } from "#validators/matches";

const invalidBlidFeedback = "Feil strekkode. Bruk bokas unike ID. Se instruksjoner for hjelp";
const inactiveBlidFeedback = "Boka du har skannet er ikke aktiv. Vennligst lever den på stand";
const genericExpiredDeadlineFeedback =
  "Boka du har skannet har en utgått frist og kan ikke overleveres. Eieren må beholde boka og vil få faktura. Kom på stand for å få boka du skal ha.";

async function expiredDeadlineFeedback(ownerDetailsId: string): Promise<string> {
  const ownerName = await User.namesByIds([ownerDetailsId])
    .then((names) => names.get(ownerDetailsId))
    .catch(() => {});
  if (!ownerName) {
    return genericExpiredDeadlineFeedback;
  }
  return `Boka du har skannet har en utgått frist og kan ikke overleveres. ${ownerName} må beholde boka og vil få faktura. Kom på stand for å få boka du skal ha.`;
}
const alreadyYoursFeedback = "Denne boka er allerede registrert på deg.";
const alreadyReceivedFeedback = "Du har allerede skannet denne boka.";
const notOrderedFeedback =
  "Du har ikke bestilt boken du skannet. Vennligst kom på stand dersom du faktisk skal ha boka.";
const noActiveOrderFeedback =
  "Du har ingen aktiv bestilling for denne boka. Ta kontakt med stand for spørsmål.";
const genericUnexpectedSenderFeedback =
  "Boka du skannet tilhørte en annen elev enn den du var satt opp med. Du skal beholde den, men eleven du var satt opp med er fortsatt ansvarlig for å levere sin opprinnelige bok.";

async function unexpectedSenderFeedback(
  actualSenderId: string,
  expectedSenderId: string,
): Promise<string> {
  const names = await User.namesByIds([actualSenderId, expectedSenderId]).catch(
    () => new Map<string, string>(),
  );

  const actualName = names.get(actualSenderId);
  const expectedName = names.get(expectedSenderId);
  if (!actualName || !expectedName) {
    return genericUnexpectedSenderFeedback;
  }
  return `Boka du skannet var ${actualName} sin. Du skal beholde den, men ${expectedName} er fortsatt ansvarlig for å levere sin opprinnelige bok.`;
}

interface OriginalOrderInfo {
  order: Order;
  relevantOrderItem: OrderItem;
}

/** The receiver's live rent order for the title, which the new match-receive order moves from. */
async function findReceiverRentOrder(
  receiverUserDetailId: string,
  itemId: string,
): Promise<OriginalOrderInfo | undefined> {
  const orderActive = new OrderActive();
  return (await orderActive.getActiveOrders(receiverUserDetailId))
    .flatMap((order) => {
      const relevantOrderItem = order.orderItems.find(
        (orderItem) =>
          orderActive.isOrderItemActive(orderItem) &&
          itemsAreEquivalent(orderItem.itemId, itemId) &&
          orderItem.type === "rent",
      );
      return relevantOrderItem ? [{ order, relevantOrderItem }] : [];
    })
    .at(0);
}

async function createMatchReceiveOrder(
  customerItem: CustomerItem,
  userDetailId: string,
): Promise<NewOrder> {
  const item = await Item.findOrFail(customerItem.itemId);

  const originalReceiverOrderInfo = await findReceiverRentOrder(userDetailId, customerItem.itemId);

  if (!originalReceiverOrderInfo) {
    throw new BlError("No receiver order for match transfer item").code(200);
  }
  const branch = await Branch.findOrFail(originalReceiverOrderInfo.order.branchId);

  const movedFromOrderId = originalReceiverOrderInfo.order.id;

  const originalOrderDeadline = originalReceiverOrderInfo.relevantOrderItem.periodTo;
  const branchRentDeadline = branch.rentPeriods[0]?.date;

  const deadline =
    originalOrderDeadline ??
    (branchRentDeadline === undefined ? null : DateTime.fromJSDate(branchRentDeadline));

  if (!deadline) {
    throw new BlError(
      "Cannot set deadline: no rent period for branch and no original order deadline",
    ).code(200);
  }

  return {
    placed: true,
    amount: 0,
    branchId: branch.id,
    customerId: userDetailId,
    byCustomer: true,
    orderItems: [
      {
        movedFromOrderId,
        itemId: item.id,
        blid: requireHandoverBlid(customerItem.blid),
        type: "match-receive",
        handout: false,
        delivered: false,
        amount: 0,
        unitPrice: 0,
        periodFrom: DateTime.now(),
        periodTo: deadline,
        numberOfPeriods: 1,
        periodType: "semester",
      },
    ],
  };
}

async function createMatchDeliverOrder(
  customerItem: CustomerItem,
  userDetailId: string,
): Promise<NewOrder> {
  const item = await Item.findOrFail(customerItem.itemId);

  const branch = await Branch.findOrFail(customerItem.handoutBranchId);

  return {
    placed: true,
    amount: 0,
    branchId: branch.id,
    customerId: userDetailId,
    byCustomer: true,
    orderItems: [
      {
        itemId: item.id,
        blid: requireHandoverBlid(customerItem.blid),
        customerItemId: customerItem.id,
        type: "match-deliver",
        handout: false,
        delivered: false,
        amount: 0,
        unitPrice: 0,
      },
    ],
  };
}

async function placeReceiverOrder(
  customerItem: CustomerItem,
  receiverUserDetailId: string,
): Promise<Order> {
  const receiverOrder = await createMatchReceiveOrder(customerItem, receiverUserDetailId);

  const placedReceiverOrder = await Order.createWithItems(receiverOrder);

  await new OrderValidator().validate(placedReceiverOrder, false);

  const orderMovedToHandler = new OrderItemMovedFromOrderHandler();
  await orderMovedToHandler.updateOrderItems(placedReceiverOrder);
  return placedReceiverOrder;
}

async function recordReceiverCustomerItem(placedReceiverOrder: Order): Promise<void> {
  const [addedCustomerItem] = await new OrderToCustomerItemGenerator().createFor(
    placedReceiverOrder,
  );

  if (addedCustomerItem === undefined) {
    throw new BlError("Failed to create new customer items");
  }
  await placedReceiverOrder.saveWithItems();
}

async function returnSenderCustomerItem(
  customerItem: CustomerItem,
  senderUserDetailId: string,
): Promise<void> {
  const senderOrder = await createMatchDeliverOrder(customerItem, senderUserDetailId);

  const placedSenderOrder = await Order.createWithItems(senderOrder);
  await new OrderValidator().validate(placedSenderOrder, false);

  customerItem.returned = true;
  await customerItem.save();

  await extendRemainingCopyDeadlines(
    senderUserDetailId,
    customerItem.itemId,
    customerItem.deadline.toJSDate(),
  );
}

/**
 * Records one student handing a book to another.
 *
 * Which obligations this settles follows from ownership, not from who was matched with whom. The
 * scanned copy discharges the sender half belonging to **its current owner** — a book given to a
 * student is theirs, so they are credited for handing over either of two copies they hold — while
 * the receiver half is satisfied by any copy of the title, from anyone. The two halves therefore
 * belong to different matches, which is the whole point of recording them separately.
 */
export async function recordTransfer(
  detailsId: string,
  { blid }: Infer<typeof matchTransferSchema>,
) {
  if (!BlidService.isValidBlid(blid)) {
    return { feedback: invalidBlidFeedback };
  }

  const [customerItem] = await CustomerItem.activeByBlid(blid);
  // A copy whose owner was deleted has nobody to transfer it from.
  const ownerId = customerItem?.customerId;
  if (!customerItem || !ownerId) {
    return { feedback: inactiveBlidFeedback };
  }

  if (ownerId === detailsId) {
    return { feedback: alreadyYoursFeedback };
  }

  if (customerItem.deadline < DateTime.now()) {
    return { feedback: await expiredDeadlineFeedback(ownerId) };
  }

  const receiverObligation = await MatchRepository.findReceiverObligation(
    detailsId,
    customerItem.itemId,
  );
  if (!receiverObligation) {
    return {
      feedback: (await MatchRepository.hasReceivedTitle(detailsId, customerItem.itemId))
        ? alreadyReceivedFeedback
        : notOrderedFeedback,
    };
  }

  if (!(await findReceiverRentOrder(detailsId, customerItem.itemId))) {
    return { feedback: noActiveOrderFeedback };
  }

  const handoverBlid = requireHandoverBlid(customerItem.blid);

  const senderObligation = await MatchRepository.findSenderObligation(ownerId, customerItem.itemId);

  const recordDischarge = (dischargesSenderObligationId: number | null) =>
    MatchRepository.recordHandover({
      blid: handoverBlid,
      itemId: customerItem.itemId,
      fromUserDetailId: ownerId,
      toUserDetailId: detailsId,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId,
      dischargesReceiverObligationId: receiverObligation.id,
    });

  let handover;
  try {
    handover = await recordDischarge(senderObligation?.id ?? null);
  } catch (error) {
    if (isDischargeConflict(error, "receiver")) {
      return { feedback: alreadyYoursFeedback };
    }
    if (!isDischargeConflict(error, "sender")) {
      throw error;
    }
    // A concurrent scan settled the sender's obligation with their other copy first. This copy
    // still satisfies the receiver; credit the sender's next open obligation, if any is left.
    const nextSenderObligation = await MatchRepository.findSenderObligation(
      ownerId,
      customerItem.itemId,
    );
    handover = await recordDischarge(nextSenderObligation?.id ?? null);
  }

  let placedReceiverOrder: Order;
  try {
    await returnSenderCustomerItem(customerItem, ownerId);
    placedReceiverOrder = await placeReceiverOrder(customerItem, detailsId);
    await recordReceiverCustomerItem(placedReceiverOrder);
  } catch (error) {
    // The books did not actually change owner; take the discharge back so the match still shows
    // the copy as due and the scan can be retried.
    await handover.delete();
    throw error;
  }

  // Traceability only, so it must not fail a transfer that has already happened.
  try {
    handover.orderId = placedReceiverOrder.id;
    await handover.save();
  } catch (error) {
    Sentry.captureException(error);
  }

  const expectedSender = receiverObligation.sender.userDetailId;
  return {
    feedback:
      expectedSender !== null && expectedSender !== ownerId
        ? await unexpectedSenderFeedback(ownerId, expectedSender)
        : undefined,
  };
}
