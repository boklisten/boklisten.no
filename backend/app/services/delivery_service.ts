import { StorageService } from "#services/storage_service";
import type { Order } from "#shared/order/order";

const MAX_POSTAL_WEIGHT_GRAMS = 3000;
const MAX_POSTAL_ITEM_COUNT = 3;

export const DeliveryService = {
  async calculateOrderWeightInGrams(order: Order) {
    const items = await Promise.all(
      order.orderItems.map((oi) => StorageService.Items.get(oi.item)),
    );
    return order.orderItems.reduce((sum, orderItem) => {
      const weight =
        Math.round(Number(items.find((item) => item.id === orderItem.item)?.info.weight) * 1000) ||
        1000;
      return sum + weight;
    }, 0);
  },
  isPostal(weightInGrams: number, itemCount: number) {
    return weightInGrams < MAX_POSTAL_WEIGHT_GRAMS || itemCount <= MAX_POSTAL_ITEM_COUNT;
  },
};
