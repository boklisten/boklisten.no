import type Order from "#models/order";

const MAX_POSTAL_WEIGHT_GRAMS = 3000;
const MAX_POSTAL_ITEM_COUNT = 3;
/** Books without a known weight are assumed to weigh a kilogram. */
const FALLBACK_WEIGHT_GRAMS = 1000;

export const DeliveryService = {
  /** The lines' catalogue items must be loaded, as they are on an order read through `Order`. */
  calculateOrderWeightInGrams(order: Order) {
    return order.orderItems.reduce((sum, orderItem) => {
      const kilograms = orderItem.item.weight;
      const grams = kilograms === null ? 0 : Math.round(kilograms * 1000);
      return sum + (grams || FALLBACK_WEIGHT_GRAMS);
    }, 0);
  },
  isPostal(weightInGrams: number, itemCount: number) {
    return weightInGrams < MAX_POSTAL_WEIGHT_GRAMS || itemCount <= MAX_POSTAL_ITEM_COUNT;
  },
};
