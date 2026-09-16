import Branch from "#models/branch";
import Item from "#models/item";
import type { BranchItem } from "#shared/branch-item";
import type { CartItemOption } from "#shared/cart_item";

export const CartService = {
  async getOptions(branchItem: BranchItem) {
    const [branch, item] = await Promise.all([
      Branch.findOrFail(branchItem.branch),
      Item.findOrFail(branchItem.item),
    ]);
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
