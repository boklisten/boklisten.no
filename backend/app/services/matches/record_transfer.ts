import * as Sentry from "@sentry/node";
import { Infer } from "@vinejs/vine/types";
import { DateTime } from "luxon";

import BlidService from "#services/blid_service";
import { CustomerItemActiveBlid } from "#services/legacy/collections/customer-item/helpers/customer-item-active-blid";
import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { OrderItemMovedFromOrderHandler } from "#services/legacy/collections/order/helpers/order-item-moved-from-order-handler/order-item-moved-from-order-handler";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { isNullish } from "#services/legacy/typescript-helpers";
import { extendRemainingCopyDeadlines } from "#services/matches/copy_deadlines";
import {
  isDischargeConflict,
  MatchRepository,
  requireHandoverBlid,
} from "#services/matches/match_repository";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { itemsAreEquivalent } from "#shared/item-equivalence";
import { Order } from "#shared/order/order";
import { OrderItem } from "#shared/order/order-item/order-item";
import { USER_PERMISSION } from "#shared/user-permission";
import { matchTransferSchema } from "#validators/matches";

const invalidBlidFeedback = "Feil strekkode. Bruk bokas unike ID. Se instruksjoner for hjelp";
const inactiveBlidFeedback = "Boka du har skannet er ikke aktiv. Vennligst lever den på stand";
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
  const names = await StorageService.UserDetails.getMany(
    [actualSenderId, expectedSenderId],
    USER_PERMISSION.ADMIN,
  )
    .then((details) => new Map(details.map((detail) => [detail.id, detail.name])))
    .catch(() => new Map<string, string>());

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
    .map((order) => ({
      order,
      relevantOrderItem: order.orderItems.find(
        (orderItem) =>
          orderActive.isOrderItemActive(orderItem) &&
          itemsAreEquivalent(orderItem.item, itemId) &&
          orderItem.type === "rent",
      ),
    }))
    .find(({ relevantOrderItem }) => relevantOrderItem !== undefined) as
    | OriginalOrderInfo
    | undefined;
}

async function createMatchReceiveOrder(
  customerItem: CustomerItem,
  userDetailId: string,
): Promise<Omit<Order, "id">> {
  const item = await StorageService.Items.get(customerItem.item);

  if (!item) {
    throw new BlError("Failed to get item");
  }

  const originalReceiverOrderInfo = await findReceiverRentOrder(userDetailId, customerItem.item);

  if (!originalReceiverOrderInfo) {
    throw new BlError("No receiver order for match transfer item").code(200);
  }
  const branch = await StorageService.Branches.get(originalReceiverOrderInfo.order.branch);

  const movedFromOrder = originalReceiverOrderInfo.order.id;

  const originalOrderDeadline = originalReceiverOrderInfo.relevantOrderItem.info?.to;
  const branchRentDeadline = branch.paymentInfo?.rentPeriods?.[0]?.date;

  let deadline = originalOrderDeadline ?? branchRentDeadline;

  if (!deadline) {
    throw new BlError(
      "Cannot set deadline: no rent period for branch and no original order deadline",
    ).code(200);
  }
  // This is necessary because it's not actually a date in the database, and thus the type is wrong.
  // It might be solved in the future by Zod or some other strict parser/validation.
  deadline = new Date(deadline);

  return {
    placed: true,
    payments: [],
    amount: 0,
    branch: branch.id,
    customer: userDetailId,
    byCustomer: true,
    orderItems: [
      {
        movedFromOrder,
        item: item.id,
        title: item.title,
        blid: requireHandoverBlid(customerItem.blid),
        type: "match-receive",
        amount: 0,
        unitPrice: 0,
        info: {
          from: new Date(),
          to: deadline,
          numberOfPeriods: 1,
          periodType: "semester",
        },
      },
    ],
  };
}

async function createMatchDeliverOrder(
  customerItem: CustomerItem,
  userDetailId: string,
): Promise<Omit<Order, "id">> {
  const item = await StorageService.Items.get(customerItem.item);

  if (!item) {
    throw new BlError("Failed to get item");
  }

  if (isNullish(customerItem.handoutInfo)) {
    throw new BlError("No handout-info for customerItem").code(200);
  }
  const branch = await StorageService.Branches.get(customerItem.handoutInfo.handoutById);

  return {
    placed: true,
    payments: [],
    amount: 0,
    branch: branch.id,
    customer: userDetailId,
    byCustomer: true,
    orderItems: [
      {
        item: item.id,
        title: item.title,
        blid: requireHandoverBlid(customerItem.blid),
        customerItem: customerItem.id,
        type: "match-deliver",
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

  const placedReceiverOrder = await StorageService.Orders.add(receiverOrder);

  await new OrderValidator().validate(placedReceiverOrder, false);

  const orderMovedToHandler = new OrderItemMovedFromOrderHandler();
  await orderMovedToHandler.updateOrderItems(placedReceiverOrder);
  return placedReceiverOrder;
}

async function recordReceiverCustomerItem(placedReceiverOrder: Order): Promise<void> {
  const [generatedReceiverCustomerItem] = await new OrderToCustomerItemGenerator().generate(
    placedReceiverOrder,
  );

  if (generatedReceiverCustomerItem === undefined) {
    throw new BlError("Failed to create new customer items");
  }

  const addedCustomerItem = await StorageService.CustomerItems.add(generatedReceiverCustomerItem);

  await StorageService.Orders.update(placedReceiverOrder.id, {
    orderItems: placedReceiverOrder.orderItems.map((orderItem) => ({
      ...orderItem,
      customerItem: addedCustomerItem.id,
    })),
  });
}

async function returnSenderCustomerItem(customerItem: CustomerItem): Promise<void> {
  const senderOrder = await createMatchDeliverOrder(customerItem, customerItem.customer);

  const placedSenderOrder = await StorageService.Orders.add(senderOrder);
  await new OrderValidator().validate(placedSenderOrder, false);

  await StorageService.CustomerItems.update(customerItem.id, {
    returned: true,
  });

  await extendRemainingCopyDeadlines(
    customerItem.customer,
    customerItem.item,
    new Date(customerItem.deadline),
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

  let blidNotActiveError = false;
  const [customerItem] = await new CustomerItemActiveBlid()
    .getActiveCustomerItems(blid)
    .catch(() => {
      blidNotActiveError = true;
      return [];
    });
  if (!customerItem || blidNotActiveError) {
    return { feedback: inactiveBlidFeedback };
  }

  if (customerItem.customer === detailsId) {
    return { feedback: alreadyYoursFeedback };
  }

  const receiverObligation = await MatchRepository.findReceiverObligation(
    detailsId,
    customerItem.item,
  );
  if (!receiverObligation) {
    return {
      feedback: (await MatchRepository.hasReceivedTitle(detailsId, customerItem.item))
        ? alreadyReceivedFeedback
        : notOrderedFeedback,
    };
  }

  if (!(await findReceiverRentOrder(detailsId, customerItem.item))) {
    return { feedback: noActiveOrderFeedback };
  }

  const handoverBlid = requireHandoverBlid(customerItem.blid);

  const senderObligation = await MatchRepository.findSenderObligation(
    customerItem.customer,
    customerItem.item,
  );

  const recordDischarge = (dischargesSenderObligationId: number | null) =>
    MatchRepository.recordHandover({
      blid: handoverBlid,
      itemId: customerItem.item,
      fromUserDetailId: customerItem.customer,
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
      customerItem.customer,
      customerItem.item,
    );
    handover = await recordDischarge(nextSenderObligation?.id ?? null);
  }

  let placedReceiverOrder: Order;
  try {
    await returnSenderCustomerItem(customerItem);
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
      expectedSender !== null && expectedSender !== customerItem.customer
        ? await unexpectedSenderFeedback(customerItem.customer, expectedSender)
        : undefined,
  };
}
