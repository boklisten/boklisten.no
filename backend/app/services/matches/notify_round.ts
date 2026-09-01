import type { Infer } from "@vinejs/vine/types";

import MatchRound from "#models/match_round";
import DispatchService from "#services/dispatch_service";
import { MessageLogService } from "#services/message_log_service";
import { MatchRepository } from "#services/matches/match_repository";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { matchNotifySchema } from "#validators/matches";

export async function notify(
  { target, message, roundId }: Infer<typeof matchNotifySchema>,
  initiatedByDetailsId?: string,
) {
  const round =
    roundId === undefined
      ? await MatchRepository.findDefaultRound()
      : await MatchRound.find(roundId);
  if (!round) {
    return "Could not find any matches!";
  }

  // Students cannot see a draft round, so a message about it would point them at nothing.
  if (round.status !== "active") {
    throw new BlError("Runden er ikke aktiv – skru den på før du varsler elevene").code(200);
  }

  const matches = await MatchRepository.findForRound(round.id);
  if (matches.length === 0) {
    return "Could not find any matches!";
  }

  const userMatchCustomers = new Set<string>();
  const standMatchCustomers = new Set<string>();
  for (const match of matches) {
    const isStandMatch = match.participants.some(
      (participant) => participant.userDetailId === null,
    );
    for (const participant of match.participants) {
      if (participant.userDetailId === null) {
        continue;
      }
      (isStandMatch ? standMatchCustomers : userMatchCustomers).add(participant.userDetailId);
    }
  }

  let targetCustomerIds: Set<string>;
  switch (target) {
    case "user-matches": {
      targetCustomerIds = userMatchCustomers;
      break;
    }
    case "stand-only": {
      targetCustomerIds = standMatchCustomers.difference(userMatchCustomers);
      break;
    }
    default: {
      targetCustomerIds = userMatchCustomers.union(standMatchCustomers);
      break;
    }
  }

  const targetCustomers = await StorageService.UserDetails.getMany([...targetCustomerIds]);
  const sendout = await MessageLogService.createSendout({
    kind: "match-notify",
    name: round.name,
    initiatedByDetailsId,
  });
  const { mailStatus, smsStatus } = await DispatchService.sendMatchInformation({
    customers: targetCustomers,
    smsBody: message,
    sendoutId: sendout?.id,
  });

  return `Emails sent successfully? ${mailStatus.success} | SMS: ${smsStatus.successCount} successful, failed to send to ${smsStatus.failed.join(", ")}`;
}
