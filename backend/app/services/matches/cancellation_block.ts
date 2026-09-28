import db from "@adonisjs/lucid/services/db";
import type { DatabaseQueryBuilderContract } from "@adonisjs/lucid/types/querybuilder";

import BadRequestException from "#exceptions/bad_request_exception";
import { getEquivalentItemIds } from "#shared/item-equivalence";

function participantsOfMatch(query: DatabaseQueryBuilderContract) {
  return query.from("match_participants").whereColumn("match_participants.match_id", "matches.id");
}

/**
 * Item ids the given customer may not cancel an order for, because a user match in an active
 * round depends on them. Match lock is irrelevant here: an unlocked match still binds two
 * students, so cancellation is never allowed. Equivalent editions are included, since a match
 * obligation for one edition can be satisfied by an ordered copy of another.
 */
export async function itemIdsInActiveUserMatches(customerId: string): Promise<Set<string>> {
  const rows: { itemId: string }[] = await db
    .from("match_obligations")
    .join("matches", "matches.id", "match_obligations.match_id")
    .join("match_rounds", "match_rounds.id", "matches.round_id")
    .where("match_rounds.status", "active")
    .whereExists((query) => {
      void participantsOfMatch(query).where("match_participants.user_id", customerId);
    })
    .whereNotExists((query) => {
      void participantsOfMatch(query).whereNull("match_participants.user_id");
    })
    .distinct("match_obligations.item_id as itemId");
  return new Set(rows.flatMap(({ itemId }) => getEquivalentItemIds(itemId)));
}

export async function assertNotBlockedByUserMatch(customerId: string, itemId: string) {
  const blockedItemIds = await itemIdsInActiveUserMatches(customerId);
  if (blockedItemIds.has(itemId)) {
    throw new BadRequestException(
      "Boka er en del av en overlevering med en annen elev og kan ikke avbestilles",
    );
  }
}
