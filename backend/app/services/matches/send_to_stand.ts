import db from "@adonisjs/lucid/services/db";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";
import { BlError } from "#shared/bl-error";

/**
 * The customer's stand match in the round, created at the round's stand if they have none yet.
 * A created match gets no meeting time: the student is simply told to visit the stand while it is
 * open, there is no slot to schedule after the fact.
 */
async function standMatchFor(
  trx: TransactionClientContract,
  roundId: number,
  customerId: string,
  standLocation: string,
): Promise<Match> {
  const existing = await Match.query({ client: trx })
    .where("roundId", roundId)
    .whereHas("participants", (participants) => participants.whereNull("userDetailId"))
    .whereHas("participants", (participants) => participants.where("userDetailId", customerId))
    .preload("participants")
    .first();
  if (existing) return existing;

  const created = await Match.create(
    { roundId, meetingLocation: standLocation, meetingTime: null },
    { client: trx },
  );
  await MatchParticipant.createMany(
    [
      { matchId: created.id, userDetailId: customerId },
      { matchId: created.id, userDetailId: null },
    ],
    { client: trx },
  );
  await created.load("participants");
  return created;
}

function participantIn(match: Match, userDetailId: string | null): MatchParticipant {
  const participant = match.participants.find((p) => p.userDetailId === userDetailId);
  if (!participant) {
    throw new BlError("Standoverleveringen mangler en part").store("matchId", match.id);
  }
  return participant;
}

/**
 * Dissolves a user match and routes its books via the stand instead — the admin action for when a
 * student cannot make the meeting.
 *
 * Each obligation splits into its two halves: the sender's duty to give the book up becomes a
 * customer→stand obligation in the sender's stand match, and the receiver's due book becomes a
 * stand→customer obligation in theirs — appended to an existing stand match in the round, or to a
 * freshly created one. Locks are cleared: sending to stand is an explicit decision that the meeting
 * will not happen, which is the only thing a lock protects.
 *
 * Halves already settled are carried over too, with their handover re-pointed at the new
 * obligation, so the stand match truthfully shows what already happened (the handover keeps its
 * real from/to parties) and the round's statistics keep counting it. The user match is then
 * deleted; its participants and remaining obligations cascade.
 */
export async function sendMatchToStand(matchId: number): Promise<void> {
  await db.transaction(async (trx) => {
    const match = await Match.query({ client: trx })
      .where("id", matchId)
      .preload("participants")
      .preload("obligations")
      .forUpdate()
      .first();
    if (!match) {
      throw new BlError("Overleveringen finnes ikke").code(702);
    }
    if (match.participants.some((participant) => participant.userDetailId === null)) {
      throw new BlError("Overleveringen er allerede en standoverlevering").code(200);
    }

    const obligationIds = match.obligations.map((obligation) => obligation.id);
    const handovers =
      obligationIds.length === 0
        ? []
        : await BookHandover.query({ client: trx })
            .whereIn("dischargesSenderObligationId", obligationIds)
            .orWhereIn("dischargesReceiverObligationId", obligationIds);
    // The partial unique indexes guarantee at most one handover per half.
    const bySenderHalf = new Map(
      handovers
        .filter((handover) => handover.dischargesSenderObligationId !== null)
        .map((handover) => [handover.dischargesSenderObligationId, handover]),
    );
    const byReceiverHalf = new Map(
      handovers
        .filter((handover) => handover.dischargesReceiverObligationId !== null)
        .map((handover) => [handover.dischargesReceiverObligationId, handover]),
    );

    const fullyCompleted =
      match.obligations.length > 0 &&
      match.obligations.every(
        (obligation) => bySenderHalf.has(obligation.id) && byReceiverHalf.has(obligation.id),
      );
    if (fullyCompleted) {
      throw new BlError("Overleveringen er allerede fullført").code(200);
    }

    const round = await MatchRound.query({ client: trx }).where("id", match.roundId).firstOrFail();
    const participantsById = new Map(match.participants.map((p) => [p.id, p]));
    const standMatches = new Map<string, Match>();
    for (const participant of match.participants) {
      standMatches.set(
        participant.userDetailId!,
        await standMatchFor(trx, match.roundId, participant.userDetailId!, round.standLocation),
      );
    }

    for (const obligation of match.obligations) {
      const senderId = participantsById.get(obligation.senderParticipantId)!.userDetailId!;
      const receiverId = participantsById.get(obligation.receiverParticipantId)!.userDetailId!;
      const senderStand = standMatches.get(senderId)!;
      const receiverStand = standMatches.get(receiverId)!;

      const senderHalf = await MatchObligation.create(
        {
          matchId: senderStand.id,
          senderParticipantId: participantIn(senderStand, senderId).id,
          receiverParticipantId: participantIn(senderStand, null).id,
          itemId: obligation.itemId,
        },
        { client: trx },
      );
      const receiverHalf = await MatchObligation.create(
        {
          matchId: receiverStand.id,
          senderParticipantId: participantIn(receiverStand, null).id,
          receiverParticipantId: participantIn(receiverStand, receiverId).id,
          itemId: obligation.itemId,
        },
        { client: trx },
      );

      const senderHandover = bySenderHalf.get(obligation.id);
      if (senderHandover) {
        senderHandover.useTransaction(trx);
        senderHandover.dischargesSenderObligationId = senderHalf.id;
        await senderHandover.save();
      }
      const receiverHandover = byReceiverHalf.get(obligation.id);
      if (receiverHandover) {
        receiverHandover.useTransaction(trx);
        receiverHandover.dischargesReceiverObligationId = receiverHalf.id;
        await receiverHandover.save();
      }
    }

    await match.useTransaction(trx).delete();
  });
}
