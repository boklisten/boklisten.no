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
}

export interface MatchDraft {
  meetingLocation: string;
  meetingTime: DateTime | null;
  /** Exactly two customer ids; `null` is the stand. */
  participantCustomerIds: (string | null)[];
  obligations: ObligationDraft[];
}

/**
 * Writes every match of a generated round in one transaction: the matches, their participants, and
 * every obligation, finishing by stamping the round as generated. A partial round is worse than no
 * round — students would be told to meet for books that were never recorded — so this is
 * all-or-nothing.
 *
 * A round may be generated only once. The round row is locked for the length of the transaction and
 * re-read inside it, so two admins pressing the button at the same moment cannot both get past the
 * check and leave the round with two overlapping sets of matches. Deleting the matches clears the
 * stamp and makes the round generatable again.
 *
 * The round stays a draft: an admin switches it on once they have looked it over, and until then
 * students see nothing and locks and discharges ignore it.
 */
async function attachMatches(roundId: number, matches: MatchDraft[]): Promise<MatchRound> {
  return db.transaction(async (trx) => {
    const round = await MatchRound.query({ client: trx })
      .where("id", roundId)
      .forUpdate()
      .firstOrFail();

    if (round.generatedAt !== null) {
      throw new BlError("Runden har allerede overleveringer").code(200);
    }

    // The models would fill these via their autoCreate hooks; raw inserts must say so themselves.
    const now = DateTime.now().toJSDate();

    const matchRows: { id: number }[] = await trx
      .table("matches")
      .insert(
        matches.map((draft) => ({
          round_id: round.id,
          meeting_location: draft.meetingLocation,
          meeting_time: draft.meetingTime?.toJSDate() ?? null,
          created_at: now,
          updated_at: now,
        })),
      )
      .returning("id");

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
    const createdParticipants: {
      id: number;
      match_id: number;
      user_detail_id: string | null;
    }[] = await trx
      .table("match_participants")
      .insert(participantRows)
      .returning(["id", "match_id", "user_detail_id"]);
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
            created_at: now,
            updated_at: now,
          };
        });
      }),
    );

    round.generatedAt = DateTime.now();
    await round.save();
    return round;
  });
}

/**
 * Throws away a round's matches and returns it to the planned state it was generated from.
 *
 * The plan survives, so the round can be regenerated once whatever was wrong with it — a missing
 * branch, the wrong deadline — has been corrected. Participants and obligations cascade from the
 * matches; recorded handovers keep their rows and lose only their link to the obligations, which is
 * how the physical chain of custody survives an admin changing their mind.
 *
 * The round is forced back to a draft as well: an active round with no matches would show students
 * an empty round for as long as it took to regenerate.
 */
async function deleteMatches(roundId: number): Promise<void> {
  await db.transaction(async (trx) => {
    await trx.from("matches").where("round_id", roundId).delete();
    await trx.from("match_rounds").where("id", roundId).update({
      generated_at: null,
      status: "draft",
      updated_at: DateTime.now().toJSDate(),
    });
  });
}

/** How much has been built on top of a round. Counted across rounds, not known by one. */
export interface RoundCounts {
  matches: number;
  handovers: number;
}

interface CountRow {
  round_id: number;
  total: string | number;
}

const toCountMap = (rows: CountRow[]) =>
  new Map(rows.map((row) => [row.round_id, Number(row.total)]));

/**
 * How many matches each round has, and how many of their obligations have already been settled by
 * a handover.
 *
 * Grouped rather than counted per round, because the listing needs both numbers for every round at
 * once: to tell a planned round from a generated one, and to warn before matches are thrown away.
 * Pass `roundId` when only one round is being rendered. A handover can discharge both halves of a
 * pair of obligations in the same round, so it is counted once.
 */
async function roundCounts(roundId?: number): Promise<Map<number, RoundCounts>> {
  const matchQuery = db
    .from("matches")
    .groupBy("matches.round_id")
    .select("matches.round_id")
    .count("* as total");

  const handoverQuery = db
    .from("book_handovers")
    .join("match_obligations", (join) => {
      void join
        .on("match_obligations.id", "book_handovers.discharges_sender_obligation_id")
        .orOn("match_obligations.id", "book_handovers.discharges_receiver_obligation_id");
    })
    .join("matches", "matches.id", "match_obligations.match_id")
    .groupBy("matches.round_id")
    .select("matches.round_id")
    .countDistinct("book_handovers.id as total");

  if (roundId !== undefined) {
    void matchQuery.where("matches.round_id", roundId);
    void handoverQuery.where("matches.round_id", roundId);
  }

  const [matchRows, handoverRows]: [CountRow[], CountRow[]] = await Promise.all([
    matchQuery,
    handoverQuery,
  ]);
  const matches = toCountMap(matchRows);
  const handovers = toCountMap(handoverRows);

  return new Map(
    [...new Set([...matches.keys(), ...handovers.keys()])].map((id) => [
      id,
      {
        matches: matches.get(id) ?? 0,
        handovers: handovers.get(id) ?? 0,
      },
    ]),
  );
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
  attachMatches,
  deleteMatches,
  roundCounts,
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
