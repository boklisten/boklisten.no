import {
  ITEMS_LOCKED_TO_MATCH_RETURN_FEEDBACK,
  MatchLockService,
} from "#services/match_lock_service";
import { OrderToCustomerItemGenerator } from "#services/legacy/collections/customer-item/helpers/order-to-customer-item-generator";
import { OrderPlacedHandler } from "#services/legacy/collections/order/helpers/order-placed-handler/order-placed-handler";
import { OrderValidator } from "#services/legacy/collections/order/helpers/order-validator/order-validator";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { isNotNullish } from "#services/legacy/typescript-helpers";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { StandMatch } from "#shared/match/stand-match";
import { UserMatch } from "#shared/match/user-match";
import { Order } from "#shared/order/order";
import { OrderItem } from "#shared/order/order-item/order-item";
import { OrderItemType } from "#shared/order/order-item/order-item-type";
import { UserPermission } from "#shared/user-permission";
import { BlApiRequest } from "#types/bl-api-request";
import { Operation } from "#types/operation";

export class OrderPlaceOperation implements Operation {
  private queryBuilder = new SEDbQueryBuilder();
  private orderToCustomerItemGenerator: OrderToCustomerItemGenerator;
  private orderPlacedHandler: OrderPlacedHandler;
  private orderValidator: OrderValidator;

  constructor(
    orderToCustomerItemGenerator?: OrderToCustomerItemGenerator,
    orderPlacedHandler?: OrderPlacedHandler,
    orderValidator?: OrderValidator,
  ) {
    this.orderToCustomerItemGenerator =
      orderToCustomerItemGenerator ?? new OrderToCustomerItemGenerator();

    this.orderPlacedHandler = orderPlacedHandler ?? new OrderPlacedHandler();

    this.orderValidator = orderValidator ?? new OrderValidator();
  }

  private filterOrdersByAlreadyOrdered(orders: Order[]) {
    const customerOrderItems = [];

    for (const order of orders) {
      if (order.orderItems) {
        for (const orderItem of order.orderItems) {
          if (order.handoutByDelivery || !order.byCustomer) {
            continue;
          }

          if (orderItem.handout) {
            continue;
          }

          if (orderItem.movedToOrder) {
            continue;
          }

          if (
            orderItem.type === "rent" ||
            orderItem.type === "buy" ||
            orderItem.type === "partly-payment"
          ) {
            customerOrderItems.push(orderItem);
          }
        }
      }
    }
    return customerOrderItems;
  }

  private async hasOpenOrderWithOrderItems(order: Order) {
    const databaseQuery = this.queryBuilder.getDbQuery(
      { customer: order.customer, placed: "true" },
      [
        { fieldName: "customer", type: "object-id" },
        { fieldName: "placed", type: "boolean" },
      ],
    );

    try {
      const existingOrders = await StorageService.Orders.getByQuery(databaseQuery);
      const alreadyOrderedItems = this.filterOrdersByAlreadyOrdered(existingOrders);

      for (const orderItem of order.orderItems) {
        for (const alreadyOrderedItem of alreadyOrderedItems) {
          if (
            orderItem.item === alreadyOrderedItem.item &&
            // @ts-expect-error fixme: auto ignored
            orderItem.info.to === alreadyOrderedItem.info.to
          ) {
            return true;
          }
        }
      }
    } catch {
      console.log("could not get user orders");
    }

    return false;
  }

  /**
   * Check whether a blid in the order is already handed out
   *
   * Unable to check against legacy customeritems which have no blid, but there
   * are very few of those which are not returned. Only checks whether a blid is
   * already handed out if the handout order type of the item in this order is
   * "buy", "rent" or "partly-payment".
   *
   * @param order The Order which contains items
   * @private
   */
  private async isSomeBlidAlreadyHandedOut(order: Order): Promise<boolean> {
    const handoutOrderTypes = new Set<OrderItemType>(["buy", "rent", "partly-payment"]);
    const handoutItems = order.orderItems.filter(
      (orderItem) => handoutOrderTypes.has(orderItem.type) && orderItem.blid != null,
    );
    if (handoutItems.length === 0) {
      return false;
    }

    try {
      // Use an aggregation because the query builder does not support checking against a list of blids,
      // and we would otherwise have to send a query for every single order item.
      const unreturnedItems = await StorageService.CustomerItems.aggregate([
        {
          $match: {
            blid: {
              $in: handoutItems.map((handoutItem) => handoutItem.blid),
            },
            returned: false,
            // In some cases, books that have previously been bought out get returned
            // to Boklistens possesion without being registered as a buyback
            // Therefore, it should be possible to hand out books that have been bought out
            buyout: false,
          },
        },
      ]);
      return unreturnedItems.length > 0;
    } catch {
      console.error("Could not check whether some items are already handed out");
      return false;
    }
  }

  /**
   * For each customerItem, check that the customer who owns it does not have a locked UserMatch with the same item
   * @param customerItems the customer items to be verified
   * @param userMatches the user matches to check against
   * @throws if someone tries to return/buyback a customerItem that's locked to a UserMatch
   * @private
   */
  private verifyCustomerItemsNotInLockedUserMatch(
    customerItems: CustomerItem[],
    userMatches: UserMatch[],
  ) {
    if (MatchLockService.findCustomerItemsLockedToMatch(customerItems, userMatches).length > 0) {
      throw new BlError(ITEMS_LOCKED_TO_MATCH_RETURN_FEEDBACK).code(802);
    }
  }

  /**
   * For each item, check that the customer does not have a locked UserMatch with the same item
   * @param items the IDs of the items to be verified
   * @param userMatches the user matches to check against
   * @param customer the ID of the customer
   * @throws if someone tries to receive an item that's locked to a UserMatch
   * @private
   */
  private verifyItemsNotInLockedUserMatch(
    items: string[],
    userMatches: UserMatch[],
    customer: string,
  ) {
    for (const item of items) {
      if (
        userMatches.some(
          (userMatch) =>
            userMatch.itemsLockedToMatch &&
            (userMatch.customerA === customer || userMatch.customerB === customer) &&
            (userMatch.expectedAToBItems.includes(item) ||
              userMatch.expectedBToAItems.includes(item)),
        )
      ) {
        throw new BlError(
          "Ordren inneholder bøker som er låst til en UserMatch; kunden må motta de låste bøkene fra en annen elev",
        ).code(807);
      }
    }
  }

  /**
   * Go through the orderItems and update matches if any of the customerItems belong to a match
   * @param userMatches all the user matches
   * @param standMatches all the stand matches
   * @param returnOrderItems the orderItems for items that are handed in
   * @param handoutOrderItems the orderItems for items that are handed out
   * @private
   */
  private async updateMatchesIfPresent(
    userMatches: UserMatch[],
    standMatches: StandMatch[],
    returnOrderItems: OrderItem[],
    handoutOrderItems: OrderItem[],
  ) {
    if (returnOrderItems.length === 0 && handoutOrderItems.length === 0) {
      return;
    }

    const returnCustomerItems = await StorageService.CustomerItems.getMany(
      returnOrderItems.map((orderItem) => orderItem.customerItem).filter(isNotNullish),
    );

    const handoutCustomerItems = await StorageService.CustomerItems.getMany(
      handoutOrderItems.map((orderItem) => orderItem.customerItem).filter(isNotNullish),
    );

    await this.updateStandMatchHandoffs(returnCustomerItems, standMatches);
    await this.updateStandMatchPickups(handoutCustomerItems, standMatches);
    await this.updateSenderUserMatches(returnCustomerItems, userMatches);
    await this.updateReceiverUserMatches(handoutCustomerItems, userMatches);
  }

  // Update the deliveredItems of the customer's StandMatches to show those newly handed in
  private async updateStandMatchHandoffs(
    returnCustomerItems: CustomerItem[],
    standMatches: StandMatch[],
  ) {
    const matchToDeliveredItemsMap = this.groupValuesByMatch(
      returnCustomerItems,
      (customerItem) =>
        standMatches.find(
          (standMatch) =>
            standMatch.customer === customerItem.customer &&
            standMatch.expectedHandoffItems.includes(customerItem.item) &&
            !standMatch.deliveredItems.includes(customerItem.item),
        ),
      (customerItem, match) => [...match.deliveredItems, customerItem.item],
    );

    for (const [standMatchId, deliveredItems] of matchToDeliveredItemsMap.entries()) {
      await StorageService.StandMatches.update(standMatchId, {
        deliveredItems: Array.from(deliveredItems),
      });
    }
  }

  // Update the receivedItems of the customer's StandMatches to show those newly picked up
  private async updateStandMatchPickups(
    handoutCustomerItems: CustomerItem[],
    standMatches: StandMatch[],
  ) {
    const matchToReceivedItemsMap = this.groupValuesByMatch(
      handoutCustomerItems,
      (customerItem) =>
        standMatches.find(
          (standMatch) =>
            standMatch.customer === customerItem.customer &&
            standMatch.expectedPickupItems.includes(customerItem.item) &&
            !standMatch.receivedItems.includes(customerItem.item),
        ),
      (customerItem, match) => [...match.receivedItems, customerItem.item],
    );

    for (const [standMatchId, receivedItems] of matchToReceivedItemsMap.entries()) {
      await StorageService.StandMatches.update(standMatchId, {
        receivedItems: Array.from(receivedItems),
      });
    }
  }

  // Update the receivedBlids of all UserMatches where the stand customer is receiver to show those newly picked up
  private async updateReceiverUserMatches(
    handoutCustomerItems: CustomerItem[],
    userMatches: UserMatch[],
  ) {
    for (const customerItem of handoutCustomerItems) {
      const receiverUserMatch = userMatches.find(
        (userMatch) =>
          (userMatch.customerA === customerItem.customer &&
            userMatch.expectedBToAItems.includes(customerItem.item) &&
            !userMatch.receivedBlIdsCustomerA.includes(customerItem.blid ?? "")) ||
          (userMatch.customerB === customerItem.customer &&
            userMatch.expectedAToBItems.includes(customerItem.item) &&
            !userMatch.receivedBlIdsCustomerB.includes(customerItem.blid ?? "")),
      );
      if (!receiverUserMatch) {
        continue;
      }

      let update: Partial<UserMatch> = {};
      if (receiverUserMatch.customerA === customerItem.customer) {
        update = {
          receivedBlIdsCustomerA: [
            ...receiverUserMatch.receivedBlIdsCustomerA,
            customerItem.blid ?? "",
          ],
        };
      }
      if (receiverUserMatch.customerB === customerItem.customer) {
        update = {
          receivedBlIdsCustomerB: [
            ...receiverUserMatch.receivedBlIdsCustomerB,
            customerItem.blid ?? "",
          ],
        };
      }
      await StorageService.UserMatches.update(receiverUserMatch.id, update);
    }
  }

  // Update the deliveredBlIds of all UserMatches where the book owner is sender to show those newly handed in
  private async updateSenderUserMatches(
    returnCustomerItems: CustomerItem[],
    userMatches: UserMatch[],
  ) {
    for (const customerItem of returnCustomerItems) {
      const senderUserMatch = userMatches.find(
        (userMatch) =>
          (userMatch.customerA === customerItem.customer &&
            userMatch.expectedAToBItems.includes(customerItem.item) &&
            !userMatch.deliveredBlIdsCustomerA.includes(customerItem.blid ?? "")) ||
          (userMatch.customerB === customerItem.customer &&
            userMatch.expectedBToAItems.includes(customerItem.item) &&
            !userMatch.deliveredBlIdsCustomerB.includes(customerItem.blid ?? "")),
      );
      if (!senderUserMatch) {
        continue;
      }

      let update: Partial<UserMatch> = {};
      if (senderUserMatch.customerA === customerItem.customer) {
        update = {
          deliveredBlIdsCustomerA: [
            ...senderUserMatch.deliveredBlIdsCustomerA,
            customerItem.blid ?? "",
          ],
        };
      }
      if (senderUserMatch.customerB === customerItem.customer) {
        update = {
          deliveredBlIdsCustomerB: [
            ...senderUserMatch.deliveredBlIdsCustomerB,
            customerItem.blid ?? "",
          ],
        };
      }
      await StorageService.UserMatches.update(senderUserMatch.id, update);
    }
  }

  // Using some collection of values, group those values by match.
  // Can be used to e.g. combine all required updates to a match.
  private groupValuesByMatch<V, M extends UserMatch | StandMatch>(
    values: V[],
    findMatch: (value: V) => M | undefined,
    valuesExtractor: (value: V, match: M) => string[],
  ): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    for (const value of values) {
      const match = findMatch(value);
      if (match) {
        map.set(
          match.id,
          new Set([...(map.get(match.id) ?? []), ...valuesExtractor(value, match)]),
        );
      }
    }

    return map;
  }

  public async run(blApiRequest: BlApiRequest) {
    let order: Order;

    try {
      order = await StorageService.Orders.get(blApiRequest.documentId);
    } catch {
      throw new ReferenceError(`order "${blApiRequest.documentId}" not found`);
    }

    const pendingSignature = await this.orderPlacedHandler.isSignaturePending(order);

    if (order.byCustomer) {
      const orderContainsActiveCustomerItems = await this.hasOpenOrderWithOrderItems(order);
      if (orderContainsActiveCustomerItems) {
        throw new BlError("Order contains active customer items").code(500);
      }
    }

    const someBlidAlreadyHandedOut = await this.isSomeBlidAlreadyHandedOut(order);

    if (someBlidAlreadyHandedOut) {
      throw new BlError(
        "En eller flere av bøkene du prøver å dele ut er allerede aktiv på en annen kunde. Prøv å dele ut én og én bok for å finne ut hvilke bøker dette gjelder.",
      ).code(801);
    }

    const returnOrderItems = order.orderItems.filter(
      (orderItem) => orderItem.type === "return" || orderItem.type === "buyback",
    );
    const handoutOrderItems = order.orderItems.filter(
      (orderItem) => orderItem.handout && orderItem.type === "rent",
    );

    const userMatches = await StorageService.UserMatches.getAll();

    if (!order.byCustomer) {
      await this.verifyCompatibilityWithUserMatches(
        returnOrderItems,
        handoutOrderItems,
        userMatches,
        order.customer,
      );
    }

    let customerItems = await this.orderToCustomerItemGenerator.generate(order);

    if (customerItems && customerItems.length > 0) {
      customerItems = await this.addCustomerItems(
        customerItems,
        // @ts-expect-error // fixme: bad enums
        blApiRequest.user,
      );
      order = this.addCustomerItemIdToOrderItems(order, customerItems);

      await StorageService.Orders.update(
        order.id,
        {
          orderItems: order.orderItems,
          pendingSignature,
        },
        // @ts-expect-error // fixme: bad enums
        blApiRequest.user,
      );
    }

    const standMatches = await StorageService.StandMatches.getAll();
    if (!order.byCustomer) {
      await this.updateMatchesIfPresent(
        userMatches,
        standMatches,
        returnOrderItems,
        handoutOrderItems,
      );
    }

    await this.orderPlacedHandler.placeOrder(order, blApiRequest.user?.details ?? "");

    const isAdmin =
      blApiRequest.user?.permission !== undefined &&
      PermissionService.isPermissionEqualOrOver(blApiRequest.user?.permission, "admin");

    await this.orderValidator.validate(order, isAdmin);

    if (customerItems && customerItems.length > 0) {
      try {
        // should add customerItems to customer if present
        await this.addCustomerItemsToCustomer(
          customerItems,
          order.customer,
          // @ts-expect-error // fixme: bad enums
          blApiRequest.user,
        );
        // fixme: probably not a good idea to ignore this error...
      } catch {}
    }
    return new BlapiResponse([order]);
  }

  /**
   * Verify that the order does not try to hand out or in an item locked to one of the customer's UserMatches
   * @param returnOrderItems the orderItems that will be handed in
   * @param handoutOrderItems the orderItems that will be handed out
   * @param userMatches the user matches to check against
   * @param customerId the customer the order belongs to
   * @throws if the order tries to hand out or in a (customer)Item locked to a UserMatch
   * @private
   */
  private async verifyCompatibilityWithUserMatches(
    returnOrderItems: OrderItem[],
    handoutOrderItems: OrderItem[],
    userMatches: UserMatch[],
    customerId: string,
  ) {
    const returnCustomerItems = await StorageService.CustomerItems.getMany(
      returnOrderItems.map((orderItem) => orderItem.customerItem).filter(isNotNullish),
    );
    const handoutItems = handoutOrderItems.map((orderItem) => orderItem.item);
    this.verifyCustomerItemsNotInLockedUserMatch(returnCustomerItems, userMatches);
    this.verifyItemsNotInLockedUserMatch(handoutItems, userMatches, customerId);
  }

  private async addCustomerItems(
    customerItems: CustomerItem[],
    user: { id: string; permission: UserPermission },
  ): Promise<CustomerItem[]> {
    const addedCustomerItems = [];
    for (const customerItem of customerItems) {
      const ci = await StorageService.CustomerItems.add(customerItem, user);
      addedCustomerItems.push(ci);
    }

    return addedCustomerItems;
  }

  private async addCustomerItemsToCustomer(
    customerItems: CustomerItem[],
    customerId: string,
  ): Promise<boolean> {
    const customerItemIds: string[] = customerItems.map((ci) => {
      return ci.id.toString();
    });

    const userDetail = await StorageService.UserDetails.get(customerId);

    let userDetailCustomerItemsIds = userDetail.customerItems ?? [];

    userDetailCustomerItemsIds = userDetailCustomerItemsIds.concat(customerItemIds);

    await StorageService.UserDetails.update(customerId, {
      customerItems: userDetailCustomerItemsIds,
    });

    return true;
  }

  private addCustomerItemIdToOrderItems(order: Order, customerItems: CustomerItem[]) {
    for (const customerItem of customerItems) {
      for (const orderItem of order.orderItems) {
        if (customerItem.item === orderItem.item) {
          orderItem.customerItem = customerItem.id;
        }
      }
    }
    return order;
  }
}
