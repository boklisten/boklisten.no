import db from "@adonisjs/lucid/services/db";

/**
 * Matches where each user still has an obligation no book handover has discharged, keyed by
 * user id; users with none are absent. Shared by the duplicate-customer summary and the delete
 * guard, so "aktive overleveringer" means the same thing in both places.
 */
export async function countActiveMatches(detailsIds: string[]): Promise<Map<string, number>> {
  if (detailsIds.length === 0) {
    return new Map();
  }
  const { rows } = await db.rawQuery<{ rows: { detailsId: string; count: string }[] }>(
    `SELECT participant.user_detail_id AS "detailsId", count(DISTINCT obligation.match_id) AS count
     FROM match_participants AS participant
     JOIN match_obligations AS obligation ON
       (obligation.sender_participant_id = participant.id AND NOT EXISTS (
         SELECT 1 FROM book_handovers WHERE discharges_sender_obligation_id = obligation.id))
       OR (obligation.receiver_participant_id = participant.id AND NOT EXISTS (
         SELECT 1 FROM book_handovers WHERE discharges_receiver_obligation_id = obligation.id))
     WHERE participant.user_detail_id = ANY(?)
     GROUP BY participant.user_detail_id`,
    [detailsIds],
  );
  return new Map(rows.map(({ detailsId, count }) => [detailsId, Number(count)]));
}
