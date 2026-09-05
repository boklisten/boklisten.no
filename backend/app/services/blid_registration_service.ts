import { findItemByIsbn, findUniqueItemByBlid } from "#services/item_lookup";
import { StorageService } from "#services/storage_service";
import type { BlidRegistrationResponse, LinkedBook } from "#shared/blid_registration";
import type { Item } from "#shared/item";
import type { UniqueItem } from "#shared/unique-item";

type StoredLink = Pick<UniqueItem, "blid" | "item" | "title">;

export interface BlidRegistrationSources {
  /** The book with the scanned ISBN. */
  item: Pick<Item, "id" | "title">;
  /** The scanned blids, in scan order. */
  blids: string[];
  /** The unique items already stored for any of those blids. */
  existing: StoredLink[];
}

export type BlidRegistrationPlan =
  | { kind: "conflict"; conflicts: { blid: string; linkedTo: LinkedBook }[] }
  | { kind: "ok"; toAdd: string[]; skipped: string[] };

/**
 * Decides what a batch does before anything is written: a blid already linked to the scanned
 * book is left alone, while one linked to another book stops the whole batch, so a mislabelled
 * copy never gets silently relinked.
 */
export function planBlidRegistration({
  item,
  blids,
  existing,
}: BlidRegistrationSources): BlidRegistrationPlan {
  const existingByBlid = new Map(existing.map((unique) => [unique.blid, unique]));
  const conflicts: { blid: string; linkedTo: LinkedBook }[] = [];
  const toAdd: string[] = [];
  const skipped: string[] = [];

  for (const blid of new Set(blids)) {
    const link = existingByBlid.get(blid);
    if (link === undefined) {
      toAdd.push(blid);
    } else if (link.item === item.id) {
      skipped.push(blid);
    } else {
      conflicts.push({ blid, linkedTo: { itemId: link.item, title: link.title } });
    }
  }

  return conflicts.length > 0 ? { kind: "conflict", conflicts } : { kind: "ok", toAdd, skipped };
}

export const BlidRegistrationService = {
  /** The book the blid is linked to, or null when the sticker is still free. */
  async lookupLink(blid: string): Promise<LinkedBook | null> {
    const uniqueItem = await findUniqueItemByBlid(blid);
    return uniqueItem === null ? null : { itemId: uniqueItem.item, title: uniqueItem.title };
  },

  async register(isbn: string, blids: string[]): Promise<BlidRegistrationResponse> {
    const item = await findItemByIsbn(isbn);
    if (item === null) {
      return { success: false, feedback: `Fant ingen bok med ISBN ${isbn}.`, conflicts: [] };
    }
    const existing = await StorageService.UniqueItems.aggregate<StoredLink>([
      { $match: { blid: { $in: blids } } },
      { $project: { _id: 0, blid: 1, title: 1, item: { $toString: "$item" } } },
    ]);

    const plan = planBlidRegistration({ item, blids, existing });
    if (plan.kind === "conflict") {
      return {
        success: false,
        feedback:
          "Noen av de unike IDene er allerede koblet til en annen bok. Fjern dem fra listen.",
        conflicts: plan.conflicts,
      };
    }

    for (const blid of plan.toAdd) {
      await StorageService.UniqueItems.add({ blid, item: item.id, title: item.title });
    }
    return {
      success: true,
      title: item.title,
      added: plan.toAdd.length,
      skipped: plan.skipped.length,
    };
  },
};
