import db from "@adonisjs/lucid/services/db";

import BadRequestException from "#exceptions/bad_request_exception";
import BranchItem from "#models/branch_item";
import Item from "#models/item";

export interface BranchItemInput {
  item: { id: string };
  rent: boolean;
  rentAtBranch: boolean;
  partlyPayment: boolean;
  partlyPaymentAtBranch: boolean;
  buy: boolean;
  buyAtBranch: boolean;
  subjects: string[];
}

/** The branch's book list as the admin page edits it. */
export const BranchItemsService = {
  async list(branchId: string) {
    const branchItems = await BranchItem.forBranch(branchId).preload("item");
    return branchItems
      .map((branchItem) => ({
        item: { id: branchItem.item.id, title: branchItem.item.title },
        rent: branchItem.rent,
        rentAtBranch: branchItem.rentAtBranch,
        partlyPayment: branchItem.partlyPayment,
        partlyPaymentAtBranch: branchItem.partlyPaymentAtBranch,
        buy: branchItem.buy,
        buyAtBranch: branchItem.buyAtBranch,
        subjects: branchItem.categories,
      }))
      .toSorted((a, b) => a.item.title.localeCompare(b.item.title, "nb"));
  },

  /**
   * Makes the branch's list equal to `inputs`: entries for titles already on the list are
   * updated in place (their id and creation time survive), new titles are added and titles left
   * out are removed.
   */
  async replace(branchId: string, inputs: BranchItemInput[]): Promise<void> {
    const itemIds = inputs.map((input) => input.item.id);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException("Samme bok er oppført flere ganger");
    }
    const items = await Item.byIds(itemIds);
    const unknown = itemIds.filter((itemId) => !items.has(itemId));
    if (unknown.length > 0) {
      throw new BadRequestException(`Fant ikke bok ${unknown.join(", ")}`);
    }

    await db.transaction(async (trx) => {
      const existing = await BranchItem.query({ client: trx })
        .where("branchId", branchId)
        .forUpdate();
      const byItem = new Map(existing.map((branchItem) => [branchItem.itemId, branchItem]));

      const added: Partial<BranchItem>[] = [];
      for (const input of inputs) {
        const columns = {
          rent: input.rent,
          rentAtBranch: input.rentAtBranch,
          partlyPayment: input.partlyPayment,
          partlyPaymentAtBranch: input.partlyPaymentAtBranch,
          buy: input.buy,
          buyAtBranch: input.buyAtBranch,
          categories: subjectNames(input.subjects),
        };
        const current = byItem.get(input.item.id);
        if (current === undefined) {
          added.push({ branchId, itemId: input.item.id, ...columns });
        } else {
          // Lucid compares the merged values against the row and skips the UPDATE when nothing changed.
          await current.merge(columns).save();
        }
      }
      await BranchItem.createMany(added, { client: trx });

      const kept = new Set(itemIds);
      const removed = existing.filter((branchItem) => !kept.has(branchItem.itemId));
      if (removed.length > 0) {
        await BranchItem.query({ client: trx })
          .whereIn(
            "id",
            removed.map((branchItem) => branchItem.id),
          )
          .delete();
      }
    });
  },
};

/** Trimmed, non-empty, unique; the same rule the transfer from Mongo applied. */
function subjectNames(subjects: string[]): string[] {
  return [...new Set(subjects.map((subject) => subject.trim()).filter((s) => s.length > 0))];
}
