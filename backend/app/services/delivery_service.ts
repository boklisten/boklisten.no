import Item from "#models/item";
import type { Order } from "#shared/order/order";

const MAX_POSTAL_WEIGHT_GRAMS = 3000;
const MAX_POSTAL_ITEM_COUNT = 3;
/** Books without a known weight are assumed to weigh a kilogram. */
const FALLBACK_WEIGHT_GRAMS = 1000;

export const DeliveryService = {
  async calculateOrderWeightInGrams(order: Order) {
    const items = await Item.byIds(order.orderItems.map((orderItem) => orderItem.item));
    return order.orderItems.reduce((sum, orderItem) => {
      const kilograms = items.get(orderItem.item)?.weight ?? null;
      const grams = kilograms === null ? 0 : Math.round(kilograms * 1000);
      return sum + (grams || FALLBACK_WEIGHT_GRAMS);
    }, 0);
  },
  isPostal(weightInGrams: number, itemCount: number) {
    return weightInGrams < MAX_POSTAL_WEIGHT_GRAMS || itemCount <= MAX_POSTAL_ITEM_COUNT;
  },
};
