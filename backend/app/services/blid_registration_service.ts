import UniqueItem from "#models/unique_item";
import { findItemByIsbn, findUniqueItemByBlid } from "#services/item_lookup";
import type { BlidRegistrationResponse, LinkedBook } from "#shared/blid_registration";
import type { Item } from "#shared/item";

/** A sticker already in the registry: its blid and the book it sits on. */
interface StoredLink extends LinkedBook {
  blid: string;
}

export interface BlidRegistrationSources {
  /** The book with the scanned ISBN. */
  item: Pick<Item, "id" | "title">;
  /** The scanned blids, in scan order. */
  blids: string[];
  /** The unique items already stored for any of those blids. */
  existing: StoredLink[];
}

type BlidRegistrationPlan =
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
    } else if (link.itemId === item.id) {
      skipped.push(blid);
    } else {
      conflicts.push({ blid, linkedTo: { itemId: link.itemId, title: link.title } });
    }
  }

  return conflicts.length > 0 ? { kind: "conflict", conflicts } : { kind: "ok", toAdd, skipped };
}

export const BlidRegistrationService = {
  /** The book the blid is linked to, or null when the sticker is still free. */
  async lookupLink(blid: string): Promise<LinkedBook | null> {
    const uniqueItem = await findUniqueItemByBlid(blid);
    if (uniqueItem === null) {
      return null;
    }
    await uniqueItem.load("item");
    return { itemId: uniqueItem.itemId, title: uniqueItem.item.title };
  },

  async register(isbn: string, blids: string[]): Promise<BlidRegistrationResponse> {
    const item = await findItemByIsbn(isbn);
    if (item === null) {
      return { success: false, feedback: `Fant ingen bok med ISBN ${isbn}.`, conflicts: [] };
    }
    const existing: StoredLink[] = (await UniqueItem.byBlidsWithItem(blids)).map((unique) => ({
      blid: unique.blid,
      itemId: unique.itemId,
      title: unique.item.title,
    }));

    const plan = planBlidRegistration({ item, blids, existing });
    if (plan.kind === "conflict") {
      return {
        success: false,
        feedback:
          "Noen av de unike IDene er allerede koblet til en annen bok. Fjern dem fra listen.",
        conflicts: plan.conflicts,
      };
    }

    await UniqueItem.createMany(plan.toAdd.map((blid) => ({ blid, itemId: item.id })));
    return {
      success: true,
      title: item.title,
      added: plan.toAdd.length,
      skipped: plan.skipped.length,
    };
  },
};
