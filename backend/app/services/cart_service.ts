import type { Branch } from "#shared/branch";
import type { BranchItem } from "#shared/branch-item";
import type { CartItemOption } from "#shared/cart_item";
import type { Item } from "#shared/item";

export const CartService = {
  /**
   * The ways a customer may order `item` from `branch` online, priced from the branch's periods
   * and the item's price. `branch` and `item` are the two sides of `branchItem`; the caller has
   * them loaded already (a catalog prices a whole branch against the same branch row).
   */
  getOptions(branchItem: BranchItem, branch: Branch, item: Item): CartItemOption[] {
    const options: CartItemOption[] = [];

    if (branchItem.rent) {
      for (const rentPeriod of branch.rentPeriods) {
        options.push({
          type: "rent",
          price: branch.paymentResponsible ? 0 : Math.ceil(item.price * rentPeriod.percentage),
          to: rentPeriod.date,
        });
      }
    }

    if (branchItem.partlyPayment) {
      for (const partlyPaymentPeriod of branch.partlyPaymentPeriods) {
        const priceUpFront =
          Math.floor((item.price * partlyPaymentPeriod.percentageUpFront) / 10) * 10;
        const priceLater =
          Math.floor((item.price * partlyPaymentPeriod.percentageBuyout) / 10) * 10;
        options.push({
          type: "partly-payment",
          price: branch.paymentResponsible ? 0 : priceUpFront,
          payLater: branch.paymentResponsible ? 0 : priceLater,
          to: partlyPaymentPeriod.date,
        });
      }
    }

    if (branchItem.buy) {
      options.push({
        type: "buy",
        price: branch.paymentResponsible ? 0 : Math.floor(item.price / 10) * 10,
      });
    }

    return options;
  },
};
