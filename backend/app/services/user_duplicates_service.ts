import db from "@adonisjs/lucid/services/db";

import CustomerItem from "#models/customer_item";
import { isObjectIdHex } from "#models/helpers/object_id";
import OrderItem from "#models/order_item";
import User from "#models/user";
import { countActiveMatches } from "#services/matches/active_matches";
import { LOAN_ORDER_ITEM_TYPES } from "#shared/order/open-order-item";
import type { UserPermission } from "#shared/user-permission";

// Caps enrichment and rendering cost; truncation is reported via totalPairCount
const MAX_PAIRS = 100;
// Blocking keys shared by more users than this are too generic to compare pairwise
const MAX_BLOCK_SIZE = 20;

export interface DuplicateCandidateSource {
  id: string;
  name?: string;
  email?: string;
  phone?: string | null;
  address?: string;
  postCode?: string;
  /** Calendar date `yyyy-MM-dd`, or a legacy Date. */
  dob?: Date | string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  branchMembership?: string | null;
}

interface DuplicatePair {
  score: number;
  reasons: string[];
  users: [DuplicateUserSummary, DuplicateUserSummary];
}

interface DuplicateUserSummary {
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

interface DuplicateCustomersResult {
  totalPairCount: number;
  pairs: DuplicatePair[];
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replaceAll(/\D/g, "");
  return digits.startsWith("0047")
    ? digits.slice(4)
    : digits.startsWith("47") && digits.length === 10
      ? digits.slice(2)
      : digits;
}

function normalizeDob(value: Date | string | null | undefined) {
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

async function countActiveBooks(detailsIds: string[]) {
  const rows: { id: string; count: string }[] = await CustomerItem.whereActive(
    db.from("customer_items"),
  )
    .whereIn("customer_items.customer_id", detailsIds)
    .groupBy("customer_items.customer_id")
    .select("customer_items.customer_id as id")
    .count("* as count");
  return new Map(rows.map((row) => [row.id, Number(row.count)]));
}

async function countOrderedItems(detailsIds: string[]) {
  const rows: { id: string; count: string }[] = await OrderItem.whereOpen(
    db.from("order_items").join("orders", "orders.id", "order_items.order_id"),
    LOAN_ORDER_ITEM_TYPES,
  )
    .where("orders.placed", true)
    .whereIn("orders.customer_id", detailsIds)
    .groupBy("orders.customer_id")
    .select("orders.customer_id as id")
    .count("* as count");
  return new Map(rows.map((row) => [row.id, Number(row.count)]));
}

async function buildSummarizer(involvedIds: string[]) {
  const [accounts, activeBooks, orderedItems, activeMatches] = await Promise.all([
    User.byIds(involvedIds),
    countActiveBooks(involvedIds),
    countOrderedItems(involvedIds),
    countActiveMatches(involvedIds),
  ]);

  return (source: DuplicateCandidateSource): DuplicateUserSummary => {
    const account = accounts.get(source.id);
    return {
      detailsId: source.id,
      name: source.name ?? "",
      email: source.email ?? "",
      phone: source.phone ?? "",
      permission: account?.permission ?? "customer",
      branchMembership: source.branchMembership ?? null,
      lastActive: account?.lastActiveAt?.toISO() ?? null,
      activeBooks: activeBooks.get(source.id) ?? 0,
      orderedItems: orderedItems.get(source.id) ?? 0,
      activeMatches: activeMatches.get(source.id) ?? 0,
    };
  };
}

/** Activity summaries for specific users, e.g. to preview a merge. Unknown ids are omitted. */
async function summarizeUserDetails(detailsIds: string[]): Promise<DuplicateUserSummary[]> {
  const validIds = detailsIds.filter((id) => isObjectIdHex(id));
  if (validIds.length === 0) {
    return [];
  }
  const sources = [...(await User.byIds(validIds)).values()].map(toCandidateSource);
  const summarize = await buildSummarizer(sources.map((source) => source.id));
  return sources.map((source) => summarize(source));
}

async function findDuplicateCustomers(): Promise<DuplicateCustomersResult> {
  const sources = (
    await User.query().select(
      "id",
      "name",
      "email",
      "phone",
      "address",
      "postCode",
      "dob",
      "branchMembershipId",
      "guardianEmail",
      "guardianPhone",
    )
  ).map(toCandidateSource);

  const allPairs = findDuplicateCandidatePairs(sources);
  const pairs = allPairs.slice(0, MAX_PAIRS);
  const involvedIds = [...new Set(pairs.flatMap((pair) => [pair.a.id, pair.b.id]))];
  const summarize = await buildSummarizer(involvedIds);

  return {
    totalPairCount: allPairs.length,
    pairs: pairs.map((pair) => ({
      score: pair.score,
      reasons: pair.reasons,
      users: [summarize(pair.a), summarize(pair.b)],
    })),
  };
}

function toCandidateSource(user: User): DuplicateCandidateSource {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    postCode: user.postCode,
    dob: user.dob?.toISODate() ?? null,
    guardianEmail: user.guardianEmail,
    guardianPhone: user.guardianPhone,
    branchMembership: user.branchMembershipId,
  };
}

export const UserDuplicatesService = {
  findDuplicateCustomers,
  summarizeUserDetails,
};
