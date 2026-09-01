import { ObjectId } from "mongodb";

import BookHandover from "#models/book_handover";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import { ACTIVE_CUSTOMER_ITEM_MATCH, OPEN_ORDER_ITEM_MATCH } from "#services/branch_books_service";
import { StorageService } from "#services/storage_service";
import type { UserPermission } from "#shared/user-permission";

// Caps enrichment and rendering cost; truncation is reported via totalPairCount
const MAX_PAIRS = 100;
// Blocking keys shared by more users than this are too generic to compare pairwise
const MAX_BLOCK_SIZE = 20;

export interface DuplicateCandidateSource {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  postCode?: string;
  dob?: Date | string;
  guardianEmail?: string;
  guardianPhone?: string;
  branchMembership?: string;
}

export interface DuplicatePair {
  score: number;
  reasons: string[];
  users: [DuplicateUserSummary, DuplicateUserSummary];
}

export interface DuplicateUserSummary {
  detailsId: string;
  name: string;
  email: string;
  phone: string;
  permission: UserPermission;
  branchMembership: string | null;
  lastActive: string | null;
  activeBooks: number;
  orderedItems: number;
  activeMatches: number;
}

export interface DuplicateCustomersResult {
  totalPairCount: number;
  pairs: DuplicatePair[];
}

// Legacy documents sometimes hold numbers where the schema says string
function normalizeText(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ");
}

function normalizePhone(value: string | undefined) {
  const digits = String(value ?? "").replaceAll(/\D/g, "");
  return digits.startsWith("0047")
    ? digits.slice(4)
    : digits.startsWith("47") && digits.length === 10
      ? digits.slice(2)
      : digits;
}

function normalizeDob(value: Date | string | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

interface NormalizedCandidate {
  source: DuplicateCandidateSource;
  name: string;
  dob: string;
  address: string;
  guardianPhone: string;
  guardianEmail: string;
}

function normalizeCandidate(source: DuplicateCandidateSource): NormalizedCandidate {
  return {
    source,
    name: normalizeText(source.name),
    dob: normalizeDob(source.dob),
    address:
      normalizeText(source.address) && normalizeText(source.postCode)
        ? `${normalizeText(source.address)}|${normalizeText(source.postCode)}`
        : "",
    guardianPhone: normalizePhone(source.guardianPhone),
    guardianEmail: normalizeText(source.guardianEmail),
  };
}

function scorePair(a: NormalizedCandidate, b: NormalizedCandidate) {
  const reasons: string[] = [];
  let score = 0;
  const sameName = a.name !== "" && a.name === b.name;
  const sameDob = a.dob !== "" && a.dob === b.dob;
  const sameGuardian =
    (a.guardianPhone !== "" && a.guardianPhone === b.guardianPhone) ||
    (a.guardianEmail !== "" && a.guardianEmail === b.guardianEmail);
  const sameAddress = a.address !== "" && a.address === b.address;

  if (sameName) {
    score += 3;
    reasons.push("Samme navn");
  }
  if (sameDob) {
    score += 2;
    reasons.push("Samme fødselsdato");
  }
  if (sameGuardian) {
    score += 2;
    reasons.push("Samme foresatt");
  }
  if (sameAddress) {
    score += 1;
    reasons.push("Samme adresse");
  }

  // Same name alone is a candidate; without a name match we require the rarer
  // dob coincidence plus a corroborating signal (guardian or address alone
  // would flag every pair of siblings).
  const isCandidate = sameName || (sameDob && (sameGuardian || sameAddress));
  return { isCandidate, score, reasons };
}

/** Pure pair detection, exported for testing. */
export function findDuplicateCandidatePairs(sources: DuplicateCandidateSource[]) {
  const candidates = sources.map(normalizeCandidate);
  const blocks = new Map<string, NormalizedCandidate[]>();
  for (const candidate of candidates) {
    const keys = [
      candidate.name && `name:${candidate.name}`,
      candidate.dob && `dob:${candidate.dob}`,
    ].filter(Boolean);
    for (const key of keys) {
      const block = blocks.get(key) ?? [];
      block.push(candidate);
      blocks.set(key, block);
    }
  }

  const seenPairs = new Set<string>();
  const pairs: {
    a: DuplicateCandidateSource;
    b: DuplicateCandidateSource;
    score: number;
    reasons: string[];
  }[] = [];
  for (const block of blocks.values()) {
    if (block.length < 2 || block.length > MAX_BLOCK_SIZE) {
      continue;
    }
    for (let i = 0; i < block.length; i++) {
      for (let j = i + 1; j < block.length; j++) {
        const a = block[i]!;
        const b = block[j]!;
        const pairKey = [a.source.id, b.source.id].toSorted().join("|");
        if (seenPairs.has(pairKey)) {
          continue;
        }
        const { isCandidate, score, reasons } = scorePair(a, b);
        if (!isCandidate) {
          continue;
        }
        seenPairs.add(pairKey);
        pairs.push({ a: a.source, b: b.source, score, reasons });
      }
    }
  }
  return pairs.toSorted((first, second) => second.score - first.score);
}

async function findUserAccounts(detailsIds: string[]) {
  const rows = await StorageService.Users.aggregate<{
    userDetail: string;
    permission: UserPermission;
    lastActive?: Date;
  }>([
    { $match: { userDetail: { $in: detailsIds.map((id) => new ObjectId(id)) } } },
    {
      $project: {
        userDetail: 1,
        permission: 1,
        lastActive: "$login.lastTokenIssuedAt",
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row.userDetail), row]));
}

async function countActiveBooks(detailsIds: string[]) {
  const rows = await StorageService.CustomerItems.aggregate<{ id: string; count: number }>([
    {
      $match: {
        ...ACTIVE_CUSTOMER_ITEM_MATCH,
        customer: { $in: detailsIds.map((id) => new ObjectId(id)) },
      },
    },
    { $group: { _id: "$customer", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row.id), row.count]));
}

async function countOrderedItems(detailsIds: string[]) {
  const rows = await StorageService.Orders.aggregate<{ id: string; count: number }>([
    { $match: { placed: true, customer: { $in: detailsIds.map((id) => new ObjectId(id)) } } },
    { $unwind: "$orderItems" },
    { $match: OPEN_ORDER_ITEM_MATCH },
    { $group: { _id: "$customer", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row.id), row.count]));
}

/** Matches where the user still has an obligation no book handover has discharged. */
async function countActiveMatches(detailsIds: string[]) {
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

async function findDuplicateCustomers(): Promise<DuplicateCustomersResult> {
  const sources = await StorageService.UserDetails.aggregate<DuplicateCandidateSource>([
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        address: 1,
        postCode: 1,
        dob: 1,
        branchMembership: 1,
        guardianEmail: { $ifNull: ["$guardian.email", ""] },
        guardianPhone: { $ifNull: ["$guardian.phone", ""] },
      },
    },
  ]);

  const allPairs = findDuplicateCandidatePairs(sources);
  const pairs = allPairs.slice(0, MAX_PAIRS);
  const involvedIds = [...new Set(pairs.flatMap((pair) => [pair.a.id, pair.b.id]))];
  const [accounts, activeBooks, orderedItems, activeMatches] = await Promise.all([
    findUserAccounts(involvedIds),
    countActiveBooks(involvedIds),
    countOrderedItems(involvedIds),
    countActiveMatches(involvedIds),
  ]);

  const summarize = (source: DuplicateCandidateSource): DuplicateUserSummary => {
    const account = accounts.get(source.id);
    return {
      detailsId: source.id,
      name: source.name ?? "",
      email: source.email ?? "",
      phone: source.phone ?? "",
      permission: account?.permission ?? "customer",
      branchMembership: source.branchMembership ?? null,
      lastActive: account?.lastActive ? new Date(account.lastActive).toISOString() : null,
      activeBooks: activeBooks.get(source.id) ?? 0,
      orderedItems: orderedItems.get(source.id) ?? 0,
      activeMatches: activeMatches.get(source.id) ?? 0,
    };
  };

  return {
    totalPairCount: allPairs.length,
    pairs: pairs.map((pair) => ({
      score: pair.score,
      reasons: pair.reasons,
      users: [summarize(pair.a), summarize(pair.b)],
    })),
  };
}

export const UserDuplicatesService = {
  findDuplicateCustomers,
};
