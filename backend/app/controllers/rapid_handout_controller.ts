import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";
import { BlError } from "#shared/bl-error";
import { MatchLock } from "#services/matches/match_lock";
import { MatchRepository } from "#services/matches/match_repository";
import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import type { Order } from "#shared/order/order";
import type { UniqueItem } from "#shared/unique-item";
import { StorageService } from "#services/storage_service";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { OrderItemMovedFromOrderHandler } from "#services/legacy/collections/order/helpers/order-item-moved-from-order-handler/order-item-moved-from-order-handler";
import { CustomerItemActiveBlid } from "#services/legacy/collections/customer-item/helpers/customer-item-active-blid";
import { findUniqueItemByBlid } from "#services/item_lookup";
import { verifyCustomerSignature } from "#services/legacy/signature.helper";
import { rapidHandoutValidator } from "#validators/rapid_handout_validator";
import { PermissionService } from "#services/permission_service";
import BlidService from "#services/blid_service";
import { itemsAreEquivalent } from "#shared/item-equivalence";

const blidNotActiveFeedback = "Denne unike IDen er ikke koblet til noen bok.";

export default class RapidHandoutController {
  async handout(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const { blid, customerId, force } = await ctx.request.validateUsing(rapidHandoutValidator);

    if (!BlidService.isValidBlid(blid)) {
      return { feedback: "Denne bliden er ikke gyldig." };
    }
    const signatureFeedback = await verifyCustomerSignature(customerId);
    if (signatureFeedback) return { feedback: signatureFeedback };

    const userFeedback = await this.verifyBlidNotActive(blid, customerId);
    if (userFeedback) return { feedback: userFeedback };

    const uniqueItemOrFeedback = await this.verifyUniqueItemPresent(blid);
    if (typeof uniqueItemOrFeedback === "string")
      return { feedback: uniqueItemOrFeedback, connectBlid: true };

    // A book the customer is supposed to receive from another student should not normally be
    // handed out at the stand. If the match is locked it is impossible; otherwise the employee
    // must confirm (force) before we hand it out.
    const peerReceive = await this.findPeerReceiveSource(uniqueItemOrFeedback.item, customerId);
    if (peerReceive) {
      if (peerReceive.locked) {
        return {
          feedback: `Denne boka er låst til overlevering. Eleven får den fra ${peerReceive.deliverFromName}. Lås opp matchen i brukerdetaljer for å dele ut på stand.`,
          deliverFromName: peerReceive.deliverFromName,
        };
      }
      if (!force) {
        return {
          feedback: "",
          requiresConfirmation: true,
          deliverFromName: peerReceive.deliverFromName,
        };
      }
    }

    const placedRentOrder = await this.placeRentOrder(blid, uniqueItemOrFeedback.item, customerId);
    if (placedRentOrder === null) {
      return {
        feedback: `«${uniqueItemOrFeedback.title}» er ikke blant bøkene denne kunden har bestilt.`,
      };
    }
    if (typeof placedRentOrder === "string") {
      return { feedback: placedRentOrder };
    }
    await this.createCustomerItem(placedRentOrder);

    return { feedback: "" };
  }

  /**
   * If the customer is due to receive this item from another student, returns the sender's name and
   * whether that handover is locked (and thus impossible to hand out at stand).
   */
  private async findPeerReceiveSource(
    itemId: string,
    customerId: string,
  ): Promise<{ locked: boolean; deliverFromName: string } | null> {
    const peer = await MatchLock.findPeerSender(customerId, itemId);
    if (!peer) return null;

    const sender = await StorageService.UserDetails.getOrNull(peer.senderCustomerId);
    return { locked: peer.lockedToMatch, deliverFromName: sender?.name ?? "en annen elev" };
  }

  private async createCustomerItem(placedReceiverOrder: Order): Promise<void> {
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

  private async placeRentOrder(
    blid: string,
    itemId: string,
    customerId: string,
  ): Promise<Order | string | null> {
    const item = await StorageService.Items.get(itemId);
    if (!item) {
      throw new BlError("Failed to get item");
    }

    interface OriginalOrderInfo {
      order: Order;
      relevantOrderItem: OrderItem | undefined;
    }
    const orderActive = new OrderActive();
    const customerOrder: OriginalOrderInfo | undefined = (
      await orderActive.getActiveOrders(customerId)
    )
      .map((order) => ({
        order,
        relevantOrderItem: order.orderItems.find(
          (orderItem) =>
            !orderItem.handout &&
            !orderItem.delivered &&
            !orderItem.movedToOrder &&
            itemsAreEquivalent(itemId, orderItem.item) &&
            (orderItem.type === "rent" || orderItem.type === "partly-payment"),
        ),
      }))
      .find(({ relevantOrderItem }) => relevantOrderItem !== undefined);

    if (!customerOrder) {
      return null;
    }
    const branch = await StorageService.Branches.get(customerOrder.order.branch);

    const movedFromOrder = customerOrder.order.id;

    const originalOrderDeadline = customerOrder.relevantOrderItem?.info?.to;
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

    if (deadline.getTime() <= Date.now()) {
      const formattedDeadline = DateTime.fromJSDate(deadline)
        .setLocale("nb")
        .toFormat("d. MMMM yyyy");
      return `«${item.title}» kan ikke deles ut fordi fristen på bestillingen gikk ut ${formattedDeadline}. Kanseller bestillingen og legg den inn på nytt for å få en gyldig frist.`;
    }

    const placedHandoutOrder = await StorageService.Orders.add({
      placed: true,
      payments: [],
      amount: 0,
      branch: branch.id,
      customer: customerId,
      byCustomer: false,
      pendingSignature: false,
      orderItems: [
        {
          movedFromOrder,
          handout: true,
          item: customerOrder.relevantOrderItem?.item ?? itemId,
          title: item.title,
          blid,
          type: customerOrder.relevantOrderItem?.type ?? "rent",
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
    });

    await new OrderValidator().validate(placedHandoutOrder, false);

    const orderMovedToHandler = new OrderItemMovedFromOrderHandler();
    await orderMovedToHandler.updateOrderItems(placedHandoutOrder);

    // The stand is a party to the handover in its own right, so this is recorded like any other
    // movement: it settles the customer's receiver half if they were due the book from anyone.
    const handedOutItemId = customerOrder.relevantOrderItem?.item ?? itemId;
    const receiverObligation = await MatchRepository.findReceiverObligation(
      customerId,
      handedOutItemId,
    );
    await MatchRepository.recordHandover({
      blid,
      itemId: handedOutItemId,
      fromUserDetailId: null,
      toUserDetailId: customerId,
      occurredAt: DateTime.now(),
      orderId: placedHandoutOrder.id,
      dischargesSenderObligationId: null,
      dischargesReceiverObligationId: receiverObligation?.id ?? null,
    });

    return placedHandoutOrder;
  }

  private async verifyBlidNotActive(blid: string, customerId: string): Promise<string | null> {
    try {
      const activeCustomerItems = await new CustomerItemActiveBlid().getActiveCustomerItems(blid);
      if (activeCustomerItems.length > 0) {
        const lastCustomerItem = activeCustomerItems[0];
        if (lastCustomerItem?.customer === customerId)
          return "Denne boken er allerede delt ut til denne kunden.";
        return "Denne boken er allerede delt ut til en annen kunde. Sjekk bl-admin for mer informasjon.";
      }
    } catch {
      // Blid not active so it is free to be handed out
    }
    return null;
  }

  private async verifyUniqueItemPresent(blid: string): Promise<string | UniqueItem> {
    return (await findUniqueItemByBlid(blid)) ?? blidNotActiveFeedback;
  }
}
