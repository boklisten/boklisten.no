import type { AccessToken } from "@boklisten/backend/shared/access-token";
import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import {
  StandMatchWithDetails,
  UserMatchWithDetails,
} from "@boklisten/backend/shared/match/match-dtos";
import { Title } from "@mantine/core";
import { ReactNode } from "react";
import { decodeToken } from "react-jwt";

import BL_CONFIG from "@/shared/utils/bl-config";

export interface ItemStatus {
  id: string;
  title: string;
  fulfilled: boolean;
}

export const MatchHeader = ({ children }: { children: ReactNode }) => {
  return <Title order={2}>{children}</Title>;
};

export function calculateFulfilledStandMatchItems(standMatch: StandMatchWithDetails): {
  fulfilledHandoffItems: string[];
  fulfilledPickupItems: string[];
} {
  const fulfilledHandoffItems = standMatch.expectedHandoffItems.filter((item) =>
    standMatch.deliveredItems.includes(item),
  );
  const fulfilledPickupItems = standMatch.expectedPickupItems.filter((item) =>
    standMatch.receivedItems.includes(item),
  );
  return { fulfilledHandoffItems, fulfilledPickupItems };
}

export interface UserMatchStatus {
  currentUser: {
    items: string[];
    wantedItems: string[];
    deliveredItems: string[];
    receivedItems: string[];
    name: string;
  };
  otherUser: {
    items: string[];
    wantedItems: string[];
    deliveredItems: string[];
    receivedItems: string[];
    name: string;
  };
}

export function calculateUserMatchStatus(userMatch: UserMatchWithDetails): UserMatchStatus {
  const customerA = {
    deliveredItems: [] as string[],
    receivedItems: [] as string[],
  };
  for (const deliveredBlId of userMatch.deliveredBlIdsCustomerA) {
    const deliveredItem = userMatch.blIdToItemMap[deliveredBlId];
    if (deliveredItem) {
      customerA.deliveredItems.push(deliveredItem);
    }
  }
  for (const receivedBlId of userMatch.receivedBlIdsCustomerA) {
    const receivedItem = userMatch.blIdToItemMap[receivedBlId];
    if (receivedItem) {
      customerA.receivedItems.push(receivedItem);
    }
  }

  const customerB = {
    deliveredItems: [] as string[],
    receivedItems: [] as string[],
  };
  for (const deliveredBlId of userMatch.deliveredBlIdsCustomerB) {
    const deliveredItem = userMatch.blIdToItemMap[deliveredBlId];
    if (deliveredItem) {
      customerB.deliveredItems.push(deliveredItem);
    }
  }
  for (const receivedBlId of userMatch.receivedBlIdsCustomerB) {
    const receivedItem = userMatch.blIdToItemMap[receivedBlId];
    if (receivedItem) {
      customerB.receivedItems.push(receivedItem);
    }
  }
  const decodedAccessToken = decodeToken<AccessToken>(
    localStorage.getItem(BL_CONFIG.token.accessToken) ?? "",
  );
  const currentUserIsCustomerA = userMatch.customerA === decodedAccessToken?.details;
  return {
    currentUser: {
      items: currentUserIsCustomerA ? userMatch.expectedAToBItems : userMatch.expectedBToAItems,
      wantedItems: currentUserIsCustomerA
        ? userMatch.expectedBToAItems
        : userMatch.expectedAToBItems,
      deliveredItems: currentUserIsCustomerA ? customerA.deliveredItems : customerB.deliveredItems,
      receivedItems: currentUserIsCustomerA ? customerA.receivedItems : customerB.receivedItems,
      name: currentUserIsCustomerA
        ? userMatch.customerADetails.name
        : userMatch.customerBDetails.name,
    },
    otherUser: {
      items: currentUserIsCustomerA ? userMatch.expectedBToAItems : userMatch.expectedAToBItems,
      wantedItems: currentUserIsCustomerA
        ? userMatch.expectedAToBItems
        : userMatch.expectedBToAItems,
      deliveredItems: currentUserIsCustomerA ? customerB.deliveredItems : customerA.deliveredItems,
      receivedItems: currentUserIsCustomerA ? customerB.receivedItems : customerA.receivedItems,
      name: currentUserIsCustomerA
        ? userMatch.customerBDetails.name
        : userMatch.customerADetails.name,
    },
  };
}

export function calculateItemStatuses<T extends UserMatchWithDetails | StandMatchWithDetails>(
  match: T,
  expectedItemsSelector: (match: T) => string[],
  fulfilledItems: string[],
): ItemStatus[] {
  return expectedItemsSelector(match)
    .map((id) => {
      const details = match.itemDetails[id];
      if (!details) {
        throw new Error(`Fant ikke detaljer for bok ${id}`);
      }
      return details;
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      fulfilled: fulfilledItems.some((fulfilledId) => itemsAreEquivalent(fulfilledId, item.id)),
    }));
}

export function isStandMatchFulfilled(standMatch: StandMatchWithDetails | undefined) {
  if (!standMatch) return false;

  const { fulfilledHandoffItems, fulfilledPickupItems } =
    calculateFulfilledStandMatchItems(standMatch);
  return (
    fulfilledHandoffItems.length >= standMatch.expectedHandoffItems.length &&
    fulfilledPickupItems.length >= standMatch.expectedPickupItems.length
  );
}

/**
 * Check if any expected items in a stand match are fulfilled.
 *
 * @param standMatch
 */
export function isStandMatchBegun(standMatch: StandMatchWithDetails): boolean {
  const { fulfilledHandoffItems, fulfilledPickupItems } =
    calculateFulfilledStandMatchItems(standMatch);
  return fulfilledHandoffItems.length > 0 || fulfilledPickupItems.length > 0;
}
