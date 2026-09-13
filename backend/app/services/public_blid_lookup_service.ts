import type { Limiter } from "@adonisjs/limiter";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type {
  PublicBlidHandedOut,
  PublicBlidLookupResult,
  PublicBlidLookupSuspended,
  PublicBlidNotHandedOut,
} from "#shared/public_blid_lookup";

/** How long a new account has to exist before it may look up who holds a book. */
const LOOKUP_WAITING_PERIOD_MS = 24 * 60 * 60 * 1000;

function byBlid(blid: string): SEDbQuery {
  const databaseQuery = new SEDbQuery();
  databaseQuery.stringFilters = [{ fieldName: "blid", value: blid }];
  return databaseQuery;
}

async function findHandedOut(blid: string): Promise<PublicBlidHandedOut | null> {
  const [row] = await StorageService.CustomerItems.aggregate<Omit<PublicBlidHandedOut, "status">>([
    {
      $match: {
        returned: false,
        buyout: false,
        cancel: false,
        buyback: false,
        blid,
      },
    },
    {
      $lookup: {
        from: BlSchemaName.Branches,
        localField: "handoutInfo.handoutById",
        foreignField: "_id",
        as: "branchInfo",
      },
    },
    {
      $lookup: {
        from: BlSchemaName.Items,
        localField: "item",
        foreignField: "_id",
        as: "itemInfo",
      },
    },
    {
      $lookup: {
        from: BlSchemaName.UserDetails,
        localField: "customer",
        foreignField: "_id",
        as: "customerInfo",
      },
    },
    {
      $project: {
        _id: 0,
        handoutBranch: { $first: "$branchInfo.name" },
        handoutTime: "$handoutInfo.time",
        deadline: 1,
        title: { $first: "$itemInfo.title" },
        isbn: { $toString: { $first: "$itemInfo.info.isbn" } },
        name: { $first: "$customerInfo.name" },
        email: { $first: "$customerInfo.email" },
        phone: { $first: "$customerInfo.phone" },
      },
    },
  ]);
  return row === undefined ? null : { status: "handedOut", ...row };
}

function activityTime(customerItem: CustomerItem): number {
  const time = customerItem.handoutInfo?.time ?? customerItem.creationTime;
  return time === undefined ? 0 : new Date(time).getTime();
}

/**
 * The item a blid is tied to: the unique-item registry first, then the most recent customer item
 * for legacy blids that were handed out before the registry existed.
 */
async function findRegisteredItemId(blid: string): Promise<string | null> {
  const [uniqueItem] = (await StorageService.UniqueItems.getByQueryOrNull(byBlid(blid))) ?? [];
  if (uniqueItem !== undefined) {
    return uniqueItem.item;
  }
  const customerItems = (await StorageService.CustomerItems.getByQueryOrNull(byBlid(blid))) ?? [];
  const latest = customerItems.toSorted((a, b) => activityTime(b) - activityTime(a))[0];
  return latest?.item ?? null;
}

async function findNotHandedOut(blid: string): Promise<PublicBlidNotHandedOut | null> {
  const itemId = await findRegisteredItemId(blid);
  if (itemId === null) {
    return null;
  }
  const item = await StorageService.Items.getOrNull(itemId);
  return {
    status: "notHandedOut",
    title: item?.title ?? "",
    isbn: String(item?.info?.isbn ?? ""),
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
   * user may look up now. Records without a creation time predate timestamps and are old.
   */
  opensAt(creationTime: Date | string | undefined, now: Date = new Date()): Date | null {
    if (creationTime === undefined) {
      return null;
    }
    const opensAt = new Date(new Date(creationTime).getTime() + LOOKUP_WAITING_PERIOD_MS);
    return opensAt.getTime() > now.getTime() ? opensAt : null;
  },
};
