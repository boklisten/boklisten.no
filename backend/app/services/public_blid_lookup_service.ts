import type { Limiter } from "@adonisjs/limiter";
import db from "@adonisjs/lucid/services/db";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import Item from "#models/item";
import UniqueItem from "#models/unique_item";
import User from "#models/user";
import type {
  PublicBlidHandedOut,
  PublicBlidLookupResult,
  PublicBlidLookupSuspended,
  PublicBlidNotHandedOut,
} from "#shared/public_blid_lookup";

/** How long a new account has to exist before it may look up who holds a book. */
const LOOKUP_WAITING_PERIOD_MS = 24 * 60 * 60 * 1000;

async function findHandedOut(blid: string): Promise<PublicBlidHandedOut | null> {
  const [customerItem] = await CustomerItem.activeByBlid(blid);
  if (customerItem === undefined) {
    return null;
  }
  const [item, branch, customer] = await Promise.all([
    Item.find(customerItem.itemId),
    Branch.findOptional(customerItem.handoutBranchId),
    User.findOptional(customerItem.customerId),
  ]);
  return {
    status: "handedOut",
    handoutTime: customerItem.handedOutAt.toJSDate().toISOString(),
    deadline: customerItem.deadline.toISODate()!,
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    handoutBranch: branch?.name ?? "",
    title: item?.title ?? "",
    isbn: item === null ? "" : String(item.isbn),
  };
}

/**
 * The item a blid is tied to: the unique-item registry first, then the most recent customer item
 * for legacy blids that were handed out before the registry existed.
 */
async function findRegisteredItemId(blid: string): Promise<string | null> {
  const uniqueItem = await UniqueItem.findByBlid(blid);
  if (uniqueItem !== null) {
    return uniqueItem.itemId;
  }
  const latest: { item_id: string } | null = await db
    .from("customer_items")
    .where("blid", blid)
    .orderBy("handed_out_at", "desc")
    .select("item_id")
    .first();
  return latest?.item_id ?? null;
}

async function findNotHandedOut(blid: string): Promise<PublicBlidNotHandedOut | null> {
  const itemId = await findRegisteredItemId(blid);
  if (itemId === null) {
    return null;
  }
  const item = await Item.find(itemId);
  return {
    status: "notHandedOut",
    title: item?.title ?? "",
    isbn: item === null ? "" : String(item.isbn),
  };
}

export const PublicBlidLookupService = {
  /** Who holds the book, or whether Boklisten knows the book at all. */
  async lookup(blid: string): Promise<PublicBlidLookupResult> {
    return (
      (await findHandedOut(blid)) ?? (await findNotHandedOut(blid)) ?? { status: "unregistered" }
    );
  },

  /**
   * The lookup behind a miss guard: every "unregistered" answer counts against the account, and
   * once the limiter's quota is spent the account is blocked for its block duration, whatever it
   * asks about. Hits do not reset the count (unlike the limiter's own `penalize`, which is built
   * for logins), so guessing through a dense range of IDs still runs out of misses.
   */
  async guardedLookup(
    { detailsId, blid }: { detailsId: string; blid: string },
    misses: Limiter,
    now: Date = new Date(),
  ): Promise<PublicBlidLookupResult | PublicBlidLookupSuspended> {
    const key = `public_blid_lookup_misses_${detailsId}`;
    if (await misses.isBlocked(key)) {
      const seconds = await misses.availableIn(key);
      return { status: "suspended", until: new Date(now.getTime() + seconds * 1000).toISOString() };
    }
    const result = await this.lookup(blid);
    if (result.status === "unregistered") {
      const { consumed, limit } = await misses.increment(key);
      if (consumed >= limit) {
        await misses.block(key, misses.blockDuration);
      }
    }
    return result;
  },

  /**
   * When a user may start looking up books: 24 hours after registering, so a throwaway account
   * cannot be created and used to read a stranger's contact details in one sitting. Null when the
   * user may look up now.
   */
  opensAt(creationTime: Date, now: Date = new Date()): Date | null {
    const opensAt = new Date(creationTime.getTime() + LOOKUP_WAITING_PERIOD_MS);
    return opensAt.getTime() > now.getTime() ? opensAt : null;
  },
};
