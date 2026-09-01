import type { HttpContext } from "@adonisjs/core/http";
import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";
import { BlError } from "#shared/bl-error";
import { PeerObligations } from "#services/matches/peer_obligations";
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
import { handoutValidator } from "#validators/handout_validator";
import { PermissionService } from "#services/permission_service";
import BlidService from "#services/blid_service";
import { itemsAreEquivalent } from "#shared/item-equivalence";
import { findFutureRentPeriod } from "#shared/rent-periods";

const blidNotActiveFeedback = "Denne unike IDen er ikke koblet til noen bok.";

export default class HandoutController {
  async handout(ctx: HttpContext) {
    const { detailsId: employeeId } = PermissionService.employeeOrFail(ctx);
    const { blid, customerId, force, branchId, deadline } =
      await ctx.request.validateUsing(handoutValidator);

    if (!BlidService.isValidBlid(blid)) {
      return { feedback: "Denne bliden er ikke gyldig." };
    }
    const signatureFeedback = await verifyCustomerSignature(customerId);
    if (signatureFeedback) {
      return { feedback: signatureFeedback };
    }

    const userFeedback = await this.verifyBlidNotActive(blid, customerId);
    if (userFeedback) {
      return { feedback: userFeedback };
    }

    const uniqueItemOrFeedback = await this.verifyUniqueItemPresent(blid);
    if (typeof uniqueItemOrFeedback === "string") {
      return { feedback: uniqueItemOrFeedback, connectBlid: true };
    }

    // A book the customer is supposed to receive from another student should not normally be
    // handed out at the stand, so the employee must confirm (force) before we hand it out. The
    // handover is recorded either way, so the peer is freed of their obligation.
    const peerReceive = await this.findPeerReceiveSource(uniqueItemOrFeedback.item, customerId);
    if (peerReceive && !force) {
      return {
        feedback: "",
        requiresConfirmation: true,
        reason: "peer-match" as const,
        deliverFromName: peerReceive.deliverFromName,
      };
    }

    const placedRentOrder = await this.placeRentOrder(
      blid,
      uniqueItemOrFeedback.item,
      customerId,
      employeeId,
    );
    if (typeof placedRentOrder === "string") {
      return { feedback: placedRentOrder };
    }
    if (placedRentOrder !== null) {
      await this.recordStandHandover(blid, uniqueItemOrFeedback.item, customerId, placedRentOrder);
      await this.createCustomerItem(placedRentOrder);
      return { feedback: "" };
    }

    // Not ordered: the employee must confirm and pick which branch deadline the book is handed
    // out on. An order placed in the meantime wins over the picked deadline, since the ordered
    // path above is always tried first.
    if (!branchId || !deadline) {
      return {
        feedback: "",
        requiresConfirmation: true,
        reason: "not-ordered" as const,
        title: uniqueItemOrFeedback.title,
      };
    }
    const noOrderResult = await this.placeNoOrderHandout(
      blid,
      uniqueItemOrFeedback.item,
      customerId,
      employeeId,
      branchId,
      deadline,
    );
    if (typeof noOrderResult === "string") {
      return { feedback: noOrderResult };
    }
    await this.recordStandHandover(blid, uniqueItemOrFeedback.item, customerId, noOrderResult);
    await this.createCustomerItem(noOrderResult);
    // Tells the frontend the ordered path did not win after all, so only then does it add a
    // synthetic row for a book the orders poll will never list.
    return { feedback: "", handedOutWithoutOrder: true, itemId: uniqueItemOrFeedback.item };
  }

  /**
   * If the customer is due to receive this item from another student, returns the sender's name.
   */
  private async findPeerReceiveSource(
    itemId: string,
    customerId: string,
  ): Promise<{ deliverFromName: string } | null> {
    const senderCustomerId = await PeerObligations.findPeerSender(customerId, itemId);
    if (!senderCustomerId) {
      return null;
    }

    const sender = await StorageService.UserDetails.getOrNull(senderCustomerId);
    return { deliverFromName: sender?.name ?? "en annen elev" };
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
    employeeId: string,
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
      employee: employeeId,
      handoutByDelivery: false,
      orderItems: [
        {
          movedFromOrder,
          handout: true,
          delivered: false,
          // The scanned copy's own item: an order for one edition may be fulfilled with an
          // equivalent edition, and the record must say which book the customer actually got.
          item: itemId,
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

    return placedHandoutOrder;
  }

  /**
   * Hands out a book the customer never ordered, on a deadline the employee picked from the given
   * branch's future rent periods. Returns feedback when the pick no longer holds.
   */
  private async placeNoOrderHandout(
    blid: string,
    itemId: string,
    customerId: string,
    employeeId: string,
    branchId: string,
    deadline: Date,
  ): Promise<Order | string> {
    const item = await StorageService.Items.get(itemId);
    if (!item) {
      throw new BlError("Failed to get item");
    }
    const branch = await StorageService.Branches.getOrNull(branchId);
    if (!branch) {
      return "Fant ikke filialen. Prøv å skanne boka på nytt.";
    }
    const period = findFutureRentPeriod(branch, deadline, new Date());
    if (!period) {
      return "Fristen er ikke lenger gyldig for denne filialen. Prøv å skanne boka på nytt.";
    }

    const placedHandoutOrder = await StorageService.Orders.add({
      placed: true,
      payments: [],
      amount: 0,
      branch: branch.id,
      customer: customerId,
      byCustomer: false,
      employee: employeeId,
      handoutByDelivery: false,
      orderItems: [
        {
          handout: true,
          delivered: false,
          item: itemId,
          title: item.title,
          blid,
          type: "rent",
          amount: 0,
          unitPrice: 0,
          info: {
            from: new Date(),
            to: new Date(period.date),
            numberOfPeriods: 1,
            periodType: period.type,
          },
        },
      ],
    });

    await new OrderValidator().validate(placedHandoutOrder, false);

    return placedHandoutOrder;
  }

  /**
   * The stand is a party to the handover in its own right, so this is recorded like any other
   * movement: it settles the customer's receiver half if they were due the book from anyone.
   * Recording must never undo a handout that already happened, so failures are reported to Sentry
   * instead of thrown — a drifted obligation is caught by the confirmation dialogs on later scans.
   */
  private async recordStandHandover(
    blid: string,
    itemId: string,
    customerId: string,
    placedHandoutOrder: Order,
  ): Promise<void> {
    try {
      const receiverObligation = await MatchRepository.findReceiverObligation(customerId, itemId);
      await MatchRepository.recordHandover({
        blid,
        itemId,
        fromUserDetailId: null,
        toUserDetailId: customerId,
        occurredAt: DateTime.now(),
        orderId: placedHandoutOrder.id,
        dischargesSenderObligationId: null,
        dischargesReceiverObligationId: receiverObligation?.id ?? null,
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  private async verifyBlidNotActive(blid: string, customerId: string): Promise<string | null> {
    try {
      const activeCustomerItems = await new CustomerItemActiveBlid().getActiveCustomerItems(blid);
      if (activeCustomerItems.length > 0) {
        const lastCustomerItem = activeCustomerItems[0];
        if (lastCustomerItem?.customer === customerId) {
          return "Denne boken er allerede delt ut til denne kunden.";
        }
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
