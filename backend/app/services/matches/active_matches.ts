import BookHandover from "#models/book_handover";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";

/**
 * Matches where each user still has an obligation no book handover has discharged, keyed by
 * user id; users with none are absent. Shared by the duplicate-customer summary and the delete
 * guard, so "aktive overleveringer" means the same thing in both places.
 */
export async function countActiveMatches(detailsIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (detailsIds.length === 0) {
    return counts;
  }
  const participants = await MatchParticipant.query().whereIn("userDetailId", detailsIds);
  if (participants.length === 0) {
    return counts;
  }
  const participantIds = participants.map((participant) => participant.id);
  const obligations = await MatchObligation.query()
    .whereIn("senderParticipantId", participantIds)
    .orWhereIn("receiverParticipantId", participantIds);
  if (obligations.length === 0) {
    return counts;
  }
  const handovers = await BookHandover.query()
    .whereIn(
      "dischargesSenderObligationId",
      obligations.map((obligation) => obligation.id),
    )
    .orWhereIn(
      "dischargesReceiverObligationId",
      obligations.map((obligation) => obligation.id),
    );
  const dischargedAsSender = new Set(
    handovers.map((handover) => handover.dischargesSenderObligationId).filter(Boolean),
  );
  const dischargedAsReceiver = new Set(
    handovers.map((handover) => handover.dischargesReceiverObligationId).filter(Boolean),
  );

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const activeMatchesByUser = new Map<string, Set<number>>();
  for (const obligation of obligations) {
    const openSides = [
      !dischargedAsSender.has(obligation.id)
        ? participantById.get(obligation.senderParticipantId)
        : undefined,
      !dischargedAsReceiver.has(obligation.id)
        ? participantById.get(obligation.receiverParticipantId)
        : undefined,
    ];
    for (const participant of openSides) {
      if (!participant?.userDetailId) {
        continue;
      }
      const matches = activeMatchesByUser.get(participant.userDetailId) ?? new Set();
      matches.add(obligation.matchId);
      activeMatchesByUser.set(participant.userDetailId, matches);
    }
  }
  for (const [detailsId, matches] of activeMatchesByUser) {
    counts.set(detailsId, matches.size);
  }
  return counts;
}
