import db from "@adonisjs/lucid/services/db";
import { DateTime } from "luxon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchRound from "#models/match_round";
import { BlError } from "#shared/bl-error";
import { getEquivalentItemIds } from "#shared/item-equivalence";

function matchesWithRelations() {
  return Match.query()
    .preload("participants", (participants) => participants.orderBy("id", "asc"))
    .preload("obligations", (obligations) => {
      // `void`: the query builder is thenable, but chaining preloads is configuration, not a query.
      void obligations.preload("sender").preload("receiver");
    });
}

/**
 * Every match the given customer is a party to in an active round.
 *
 * Rounds accumulate now that they are rows rather than a collection wiped between terms, so only
 * rounds switched on may be read or written as current activity — otherwise last term's
 * unfulfilled matches would haunt students forever, and a freshly generated draft would be
 * visible before an admin has checked it.
 */
async function findForCustomer(customerId: string): Promise<Match[]> {
  return matchesWithRelations()
    .whereHas("participants", (participants) => participants.where("userDetailId", customerId))
    .whereHas("round", (round) => round.where("status", "active"));
}

/**
 * The round meant when no round is named: the newest active one, or failing that the newest
 * overall. The same rule the admin UI uses to pick its default, so an admin and the backend fall
 * back to the same round.
 */
async function findDefaultRound(): Promise<MatchRound | null> {
  return (
    (await MatchRound.query().where("status", "active").orderBy("id", "desc").first()) ??
    (await MatchRound.query().orderBy("id", "desc").first())
  );
}

/** One match by id, with the same relations preloaded as the listing queries. */
async function findById(matchId: number): Promise<Match | null> {
  return matchesWithRelations().where("id", matchId).first();
}

/** Every match generated in the given round. */
async function findForRound(roundId: number): Promise<Match[]> {
  return matchesWithRelations().where("roundId", roundId);
}

/** Every recorded hop for one physical copy, oldest first, across rounds and stand visits. */
async function custodyChain(blid: string): Promise<BookHandover[]> {
  return BookHandover.query().where("blid", blid).orderBy("occurredAt", "asc");
}

/**
 * Every handover that discharged either half of the given obligations.
 *
 * Fetched in one query rather than through a relation on `MatchObligation`, which would make
 * `MatchObligation` and `BookHandover` import each other.
 */
async function handoversForObligations(obligationIds: number[]): Promise<BookHandover[]> {
  if (obligationIds.length === 0) return [];
  return BookHandover.query()
    .whereIn("dischargesSenderObligationId", obligationIds)
    .orWhereIn("dischargesReceiverObligationId", obligationIds);
}

/** The customer ids taking part in any of the round's matches, as a subquery. */
function roundParticipantCustomerIds(roundId: number) {
  return db
    .from("match_participants")
    .join("matches", "matches.id", "match_participants.match_id")
    .where("matches.round_id", roundId)
    .whereNotNull("match_participants.user_detail_id")
    .select("match_participants.user_detail_id");
}

/**
 * How many books moved in the window without settling anything.
 *
 * Handovers are not stamped with a round — they record physical movement, which does not belong to
 * one — so a round's share of them is bounded by when it and its successor were generated, and by
 * who moved the book: only handovers touching one of the round's own participants count. Two
 * schools running stands in the same weeks must not pollute each other's statistics.
 */
async function unattachedHandoverCount(
  roundId: number,
  from: DateTime,
  until: DateTime | null,
): Promise<number> {
  const query = BookHandover.query()
    .whereNull("dischargesSenderObligationId")
    .whereNull("dischargesReceiverObligationId")
    .where("occurredAt", ">=", from.toISO()!)
    .where((participant) => {
      void participant
        .whereIn("fromUserDetailId", roundParticipantCustomerIds(roundId))
        .orWhereIn("toUserDetailId", roundParticipantCustomerIds(roundId));
    });
  if (until) void query.where("occurredAt", "<", until.toISO()!);

  const [row] = await query.count("* as total");
  return Number(row?.$extras["total"] ?? 0);
}

/** One book that should move, described in customer ids rather than participant rows. */
export interface ObligationDraft {
  /** null means the stand. */
  senderCustomerId: string | null;
  /** null means the stand. */
  receiverCustomerId: string | null;
  itemId: string;
  lockedToMatch: boolean;
}

export interface MatchDraft {
  meetingLocation: string;
  meetingTime: DateTime | null;
  /** Exactly two customer ids; `null` is the stand. */
  participantCustomerIds: (string | null)[];
  obligations: ObligationDraft[];
}

/**
 * Writes a whole generated round in one transaction: the round, its matches, their participants,
 * and every obligation. A partial round is worse than no round — students would be told to meet
 * for books that were never recorded — so this is all-or-nothing.
 *
 * The round is born a draft: an admin switches it on once they have looked it over, and until
 * then students see nothing and locks and discharges ignore it.
 *
 */
async function createRound(
  round: { name: string; standLocation: string; generatedAt: DateTime },
  matches: MatchDraft[],
): Promise<MatchRound> {
  return db.transaction(async (trx) => {
    const createdRound = await MatchRound.create({ ...round, status: "draft" }, { client: trx });
    if (matches.length === 0) return createdRound;

    // The models would fill these via their autoCreate hooks; raw inserts must say so themselves.
    const now = DateTime.now().toJSDate();

    const matchRows = (await trx
      .table("matches")
      .insert(
        matches.map((draft) => ({
          round_id: createdRound.id,
          meeting_location: draft.meetingLocation,
          meeting_time: draft.meetingTime?.toJSDate() ?? null,
          created_at: now,
          updated_at: now,
        })),
      )
      .returning("id")) as { id: number }[];

    const participantRows = matches.flatMap((draft, index) => {
      const matchId = matchRows[index]?.id;
      if (matchId === undefined) {
        throw new BlError("Insert returned fewer matches than were drafted");
      }
      return draft.participantCustomerIds.map((userDetailId) => ({
        match_id: matchId,
        user_detail_id: userDetailId,
        created_at: now,
        updated_at: now,
      }));
    });
    const createdParticipants = (await trx
      .table("match_participants")
      .insert(participantRows)
      .returning(["id", "match_id", "user_detail_id"])) as {
      id: number;
      match_id: number;
      user_detail_id: string | null;
    }[];
    const participantIds = new Map(
      createdParticipants.map((participant) => [
        `${participant.match_id}:${participant.user_detail_id}`,
        participant.id,
      ]),
    );

    await trx.table("match_obligations").insert(
      matches.flatMap((draft, index) => {
        const matchId = matchRows[index]!.id;
        return draft.obligations.map((obligation) => {
          const senderParticipantId = participantIds.get(
            `${matchId}:${obligation.senderCustomerId}`,
          );
          const receiverParticipantId = participantIds.get(
            `${matchId}:${obligation.receiverCustomerId}`,
          );
          if (senderParticipantId === undefined || receiverParticipantId === undefined) {
            throw new BlError("Obligation names a party that is not in the match").store(
              "obligation",
              obligation,
            );
          }
          return {
            match_id: matchId,
            sender_participant_id: senderParticipantId,
            receiver_participant_id: receiverParticipantId,
            item_id: obligation.itemId,
            locked_to_match: obligation.lockedToMatch,
            created_at: now,
            updated_at: now,
          };
        });
      }),
    );

    return createdRound;
  });
}

export function requireHandoverBlid(blid: string | null | undefined): string {
  if (!blid) {
    throw new BlError("Kan ikke registrere overlevering uten BL-ID").code(200);
  }
  return blid;
}

export interface RecordHandoverInput {
  /** null only for legacy copies that never got a blid. */
  blid: string | null;
  itemId: string;
  /** null means the stand. */
  fromUserDetailId: string | null;
  /** null means the stand. */
  toUserDetailId: string | null;
  occurredAt: DateTime;
  /** The Mongo Order that is the authoritative record of this movement. */
  orderId: string | null;
  dischargesSenderObligationId: number | null;
  dischargesReceiverObligationId: number | null;
}

/**
 * Records one physical handover. The partial unique indexes guarantee an obligation half is
 * discharged at most once, even under concurrency — a violation surfaces here as an insert error
 * that `isDischargeConflict` can recognise.
 *
 * Both discharge ids may be null: a book can move outside any match, and that is worth recording
 * for the chain of custody even though no obligation is affected.
 */
async function recordHandover(input: RecordHandoverInput): Promise<BookHandover> {
  return BookHandover.create(input);
}

/** True when `error` is Postgres rejecting a second discharge of the given obligation half. */
export function isDischargeConflict(error: unknown, half: "sender" | "receiver"): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === "23505" && constraint === `book_handovers_${half}_obligation_unique`;
}

/** Obligation ids whose given half has already been discharged. */
export function dischargedHalves(column: "sender" | "receiver") {
  const field = `discharges_${column}_obligation_id`;
  return db.from("book_handovers").select(field).whereNotNull(field);
}

/**
 * Constrains an obligation query to matches in active rounds. Discharges must never land on a
 * switched-off round's obligations: the partial unique indexes would then block the same handover
 * from ever settling the active round's copy of the obligation — and a draft an admin is still
 * checking must not accumulate discharges at all.
 */
function obligationsInLiveRounds() {
  return MatchObligation.query().whereHas("match", (match) =>
    match.whereHas("round", (round) => round.where("status", "active")),
  );
}

/**
 * The obligation discharged when `customerId` hands over a copy of `itemId`, if any.
 *
 * Matched on owner and title rather than on a particular copy: a student holding two copies of a
 * title gets credit for handing over either. Equivalent editions count as the same title.
 *
 * Oldest first, so repeated deliveries settle obligations in a stable order.
 */
async function findSenderObligation(
  customerId: string,
  itemId: string,
): Promise<MatchObligation | null> {
  return obligationsInLiveRounds()
    .whereIn("itemId", getEquivalentItemIds(itemId))
    .whereHas("sender", (sender) => sender.where("userDetailId", customerId))
    .whereNotIn("id", dischargedHalves("sender"))
    .orderBy("id", "asc")
    .preload("sender")
    .preload("receiver")
    .first();
}

/**
 * The obligation satisfied when `customerId` receives a copy of `itemId`, if any.
 *
 * Receiving is fungible in both copy and source: any copy of the title, from anyone, will do.
 */
async function findReceiverObligation(
  customerId: string,
  itemId: string,
): Promise<MatchObligation | null> {
  return obligationsInLiveRounds()
    .whereIn("itemId", getEquivalentItemIds(itemId))
    .whereHas("receiver", (receiver) => receiver.where("userDetailId", customerId))
    .whereNotIn("id", dischargedHalves("receiver"))
    .orderBy("id", "asc")
    .preload("sender")
    .preload("receiver")
    .first();
}

/**
 * Whether the customer was due this title in a live round and has already received it — the case
 * a scanner should answer "you already got this" rather than "you never ordered this".
 */
async function hasReceivedTitle(customerId: string, itemId: string): Promise<boolean> {
  const discharged = await obligationsInLiveRounds()
    .whereIn("itemId", getEquivalentItemIds(itemId))
    .whereHas("receiver", (receiver) => receiver.where("userDetailId", customerId))
    .whereIn("id", dischargedHalves("receiver"))
    .first();
  return discharged !== null;
}

export const MatchRepository = {
  createRound,
  findById,
  findForCustomer,
  findForRound,
  findDefaultRound,
  custodyChain,
  handoversForObligations,
  unattachedHandoverCount,
  findSenderObligation,
  findReceiverObligation,
  hasReceivedTitle,
  recordHandover,
};
