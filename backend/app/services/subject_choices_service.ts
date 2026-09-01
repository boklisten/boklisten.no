import { DateTime } from "luxon";
import { ObjectId } from "mongodb";

import { ACTIVE_CUSTOMER_ITEM_MATCH, OPEN_ORDER_ITEM_MATCH } from "#services/branch_books_service";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import type { SubjectForUpload } from "#services/branch_subjects_service";
import { fetchSubjectsForUpload, normalizeSubjectName } from "#services/branch_subjects_service";
import { StorageService } from "#services/storage_service";
import { buildBranchMappings } from "#services/user_provisioning_service";
import { canonicalItemId, getEquivalentItemIds } from "#shared/item-equivalence";
import type { Period } from "#shared/period";

export interface SubjectChoiceRow {
  name: string;
  localName: string;
  subject: string;
  /** yyyy-mm-dd */
  deadline: string;
}

export interface MemberSummary {
  id: string;
  name: string;
  branchMembership: string | null;
}

interface SubjectChoiceGroup {
  name: string;
  localName: string;
  choices: { subject: string; deadline: string }[];
}

export interface PlannedOrder {
  customerId: string;
  customerName: string;
  /** The branch whose subjects resolved the order's books */
  branchId: string;
  orderItems: {
    itemId: string;
    title: string;
    deadline: string;
    periodType: Extract<Period, "year" | "semester">;
  }[];
}

export interface SubjectChoicesPlan {
  orders: PlannedOrder[];
  metrics: {
    studentsWithOrders: number;
    totalBooks: number;
    skippedAlreadyOwned: number;
    studentsAlreadyCovered: number;
    /** Choices that matched a subject with no books: recognized, but nothing to order */
    choicesWithoutBooks: number;
  };
  unknownSubjects: { subject: string; studentCount: number }[];
  unknownUsers: { name: string; localName: string }[];
  ambiguousUsers: { name: string; localName: string; matchCount: number }[];
}

function normalizeName(name: string) {
  return name.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function normalizeCompact(value: string) {
  return value.replaceAll(/\s/g, "").toLowerCase();
}

export function groupSubjectChoiceRows(rows: SubjectChoiceRow[]): SubjectChoiceGroup[] {
  const groups = new Map<string, SubjectChoiceGroup>();
  const seenChoicesByGroup = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${normalizeName(row.name)}|${normalizeCompact(row.localName)}`;
    const group = groups.get(key) ?? {
      name: row.name.trim(),
      localName: row.localName.trim(),
      choices: [],
    };
    const seenChoices = seenChoicesByGroup.get(key) ?? new Set<string>();
    const choiceKey = `${normalizeCompact(row.subject)}|${row.deadline}`;
    if (!seenChoices.has(choiceKey)) {
      seenChoices.add(choiceKey);
      group.choices.push({ subject: row.subject.trim(), deadline: row.deadline });
    }
    groups.set(key, group);
    seenChoicesByGroup.set(key, seenChoices);
  }
  return [...groups.values()];
}

export function matchStudent(
  group: { name: string },
  members: MemberSummary[],
  klasseBranchId: string | null,
):
  | { status: "matched"; member: MemberSummary }
  | { status: "unknown" }
  | { status: "ambiguous"; matchCount: number } {
  const nameMatches = members.filter(
    (member) => normalizeName(member.name) === normalizeName(group.name),
  );
  const inKlasse = klasseBranchId
    ? nameMatches.filter((member) => member.branchMembership === klasseBranchId)
    : [];
  const candidates = inKlasse.length > 0 ? inKlasse : nameMatches;
  if (candidates.length === 1 && candidates[0]) {
    return { status: "matched", member: candidates[0] };
  }
  if (candidates.length === 0) {
    return { status: "unknown" };
  }
  return { status: "ambiguous", matchCount: candidates.length };
}

export function resolveSubjectItems({
  startBranchId,
  uploadBranchId,
  subject,
  parentByBranchId,
  subjectsByBranchId,
}: {
  startBranchId: string;
  uploadBranchId: string;
  subject: string;
  parentByBranchId: Map<string, string>;
  subjectsByBranchId: Map<string, SubjectForUpload[]>;
}): { branchId: string; items: { itemId: string; title: string }[] } | null {
  const normalizedSubject = normalizeSubjectName(subject);
  const visited = new Set<string>();
  let branchId: string | undefined = startBranchId;
  while (branchId && !visited.has(branchId)) {
    visited.add(branchId);
    const match = (subjectsByBranchId.get(branchId) ?? []).find(
      (branchSubject) => normalizeSubjectName(branchSubject.externalName) === normalizedSubject,
    );
    if (match) {
      return { branchId, items: match.books };
    }
    if (branchId === uploadBranchId) {
      return null;
    }
    branchId = parentByBranchId.get(branchId);
  }
  return null;
}

export function findInvalidDeadlines(rows: Pick<SubjectChoiceRow, "deadline">[]): string[] {
  return [
    ...new Set(
      rows.map((row) => row.deadline).filter((deadline) => !DateTime.fromISO(deadline).isValid),
    ),
  ].toSorted();
}

export function findPastDeadlines(rows: Pick<SubjectChoiceRow, "deadline">[], now: Date): string[] {
  const today = DateTime.fromJSDate(now).toISODate() ?? "";
  return [
    ...new Set(rows.map((row) => row.deadline).filter((deadline) => deadline <= today)),
  ].toSorted();
}

export function resolvePeriodType(deadline: Date, now: Date): "year" | "semester" {
  return DateTime.fromJSDate(now).plus({ months: 6 }) < DateTime.fromJSDate(deadline)
    ? "year"
    : "semester";
}

export function planSubjectChoices({
  rows,
  uploadBranchId,
  members,
  klasseBranchIdByLocalName,
  parentByBranchId,
  subjectsByBranchId,
  ownedItemKeys,
  now,
}: {
  rows: SubjectChoiceRow[];
  uploadBranchId: string;
  members: MemberSummary[];
  klasseBranchIdByLocalName: Map<string, string | null>;
  parentByBranchId: Map<string, string>;
  subjectsByBranchId: Map<string, SubjectForUpload[]>;
  ownedItemKeys: Set<string>;
  now: Date;
}): SubjectChoicesPlan {
  const plan: SubjectChoicesPlan = {
    orders: [],
    metrics: {
      studentsWithOrders: 0,
      totalBooks: 0,
      skippedAlreadyOwned: 0,
      studentsAlreadyCovered: 0,
      choicesWithoutBooks: 0,
    },
    unknownSubjects: [],
    unknownUsers: [],
    ambiguousUsers: [],
  };
  const unknownSubjectStudents = new Map<string, { subject: string; students: Set<string> }>();

  // A student can appear under several classes (typo, moved class); merge per member
  // so they never get duplicate orders for the same books.
  const choicesByMemberId = new Map<
    string,
    { member: MemberSummary; choices: SubjectChoiceGroup["choices"]; seenChoices: Set<string> }
  >();
  for (const group of groupSubjectChoiceRows(rows)) {
    const klasseBranchId = klasseBranchIdByLocalName.get(group.localName) ?? null;
    const match = matchStudent(group, members, klasseBranchId);
    if (match.status === "unknown") {
      plan.unknownUsers.push({ name: group.name, localName: group.localName });
      continue;
    }
    if (match.status === "ambiguous") {
      plan.ambiguousUsers.push({
        name: group.name,
        localName: group.localName,
        matchCount: match.matchCount,
      });
      continue;
    }
    const entry = choicesByMemberId.get(match.member.id) ?? {
      member: match.member,
      choices: [],
      seenChoices: new Set<string>(),
    };
    for (const choice of group.choices) {
      const choiceKey = `${normalizeCompact(choice.subject)}|${choice.deadline}`;
      if (entry.seenChoices.has(choiceKey)) {
        continue;
      }
      entry.seenChoices.add(choiceKey);
      entry.choices.push(choice);
    }
    choicesByMemberId.set(match.member.id, entry);
  }

  for (const { member, choices } of choicesByMemberId.values()) {
    // Keyed by the equivalence group's canonical id, so two subjects that resolve to different
    // editions of the same title still yield a single order item (the first edition encountered).
    const orderItemByItemId = new Map<
      string,
      PlannedOrder["orderItems"][number] & { branchId: string }
    >();
    let skippedForStudent = 0;
    for (const choice of choices) {
      const resolved = resolveSubjectItems({
        startBranchId: member.branchMembership ?? uploadBranchId,
        uploadBranchId,
        subject: choice.subject,
        parentByBranchId,
        subjectsByBranchId,
      });
      if (!resolved) {
        const key = normalizeCompact(choice.subject);
        const entry = unknownSubjectStudents.get(key) ?? {
          subject: choice.subject,
          students: new Set<string>(),
        };
        entry.students.add(member.id);
        unknownSubjectStudents.set(key, entry);
        continue;
      }
      if (resolved.items.length === 0) {
        plan.metrics.choicesWithoutBooks++;
        continue;
      }
      for (const item of resolved.items) {
        const alreadyOwned = getEquivalentItemIds(item.itemId).some((equivalentItemId) =>
          ownedItemKeys.has(`${member.id}:${equivalentItemId}`),
        );
        if (alreadyOwned) {
          skippedForStudent++;
          continue;
        }
        const existing = orderItemByItemId.get(canonicalItemId(item.itemId));
        if (existing) {
          if (choice.deadline < existing.deadline) {
            existing.deadline = choice.deadline;
            existing.periodType = resolvePeriodType(new Date(choice.deadline), now);
          }
          continue;
        }
        orderItemByItemId.set(canonicalItemId(item.itemId), {
          itemId: item.itemId,
          title: item.title,
          deadline: choice.deadline,
          periodType: resolvePeriodType(new Date(choice.deadline), now),
          branchId: resolved.branchId,
        });
      }
    }

    plan.metrics.skippedAlreadyOwned += skippedForStudent;
    const orderItemsByBranchId = new Map<string, PlannedOrder["orderItems"]>();
    for (const { branchId, ...orderItem } of orderItemByItemId.values()) {
      const branchOrderItems = orderItemsByBranchId.get(branchId) ?? [];
      branchOrderItems.push(orderItem);
      orderItemsByBranchId.set(branchId, branchOrderItems);
    }
    if (orderItemsByBranchId.size > 0) {
      for (const [branchId, orderItems] of orderItemsByBranchId) {
        plan.orders.push({
          customerId: member.id,
          customerName: member.name,
          branchId,
          orderItems,
        });
        plan.metrics.totalBooks += orderItems.length;
      }
      plan.metrics.studentsWithOrders++;
    } else if (skippedForStudent > 0) {
      plan.metrics.studentsAlreadyCovered++;
    }
  }

  plan.unknownSubjects = [...unknownSubjectStudents.values()]
    .map(({ subject, students }) => ({ subject, studentCount: students.size }))
    .toSorted((a, b) => a.subject.localeCompare(b.subject));
  plan.unknownUsers.sort((a, b) => a.name.localeCompare(b.name));
  plan.ambiguousUsers.sort((a, b) => a.name.localeCompare(b.name));
  return plan;
}

async function fetchScopeBranches(branchId: string) {
  const descendantIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
  const scopeIds = [branchId, ...descendantIds];
  const branches = await StorageService.Branches.aggregate<{
    id: string;
    name: string;
    parentBranch?: string;
    childBranches?: string[];
  }>([
    { $match: { _id: { $in: scopeIds.map((id) => new ObjectId(id)) } } },
    { $project: { name: 1, parentBranch: 1, childBranches: 1 } },
  ]);
  return { scopeIds, branches };
}

async function fetchMembers(scopeIds: string[]): Promise<MemberSummary[]> {
  const members = await StorageService.UserDetails.aggregate<{
    id: string;
    name?: string;
    branchMembership?: string;
  }>([
    { $match: { branchMembership: { $in: scopeIds.map((id) => new ObjectId(id)) } } },
    { $project: { name: 1, branchMembership: 1 } },
  ]);
  return members.map((member) => ({
    id: member.id,
    name: member.name ?? "",
    branchMembership: member.branchMembership ? String(member.branchMembership) : null,
  }));
}

async function fetchOwnedItemKeys(customerIds: string[]): Promise<Set<string>> {
  if (customerIds.length === 0) {
    return new Set();
  }
  const customerObjectIds = customerIds.map((id) => new ObjectId(id));
  const [activeCustomerItems, openOrderItems] = await Promise.all([
    StorageService.CustomerItems.aggregate<{ customer: string; item: string }>([
      { $match: { ...ACTIVE_CUSTOMER_ITEM_MATCH, customer: { $in: customerObjectIds } } },
      { $project: { customer: { $toString: "$customer" }, item: { $toString: "$item" } } },
    ]),
    StorageService.Orders.aggregate<{ customer: string; item: string }>([
      { $match: { placed: true, customer: { $in: customerObjectIds } } },
      { $unwind: "$orderItems" },
      { $match: OPEN_ORDER_ITEM_MATCH },
      {
        $project: {
          customer: { $toString: "$customer" },
          item: { $toString: "$orderItems.item" },
        },
      },
    ]),
  ]);
  return new Set(
    [...activeCustomerItems, ...openOrderItems].map(({ customer, item }) => `${customer}:${item}`),
  );
}

async function buildPlan(branchId: string, rows: SubjectChoiceRow[]): Promise<SubjectChoicesPlan> {
  const { scopeIds, branches } = await fetchScopeBranches(branchId);
  const [members, subjectsByBranchId] = await Promise.all([
    fetchMembers(scopeIds),
    fetchSubjectsForUpload(scopeIds),
  ]);

  const parentByBranchId = new Map<string, string>();
  for (const branch of branches) {
    if (branch.parentBranch) {
      parentByBranchId.set(branch.id, String(branch.parentBranch));
    }
  }
  const leafBranches = branches.filter((branch) => (branch.childBranches ?? []).length === 0);
  const groups = groupSubjectChoiceRows(rows);
  const mappings = buildBranchMappings(
    groups.map((group) => group.localName),
    leafBranches.map((branch) => ({ id: branch.id, name: branch.name })),
  );
  const klasseBranchIdByLocalName = new Map(
    mappings.map((mapping) => [mapping.localName, mapping.branch?.id ?? null]),
  );

  const matchedCustomerIds = groups.flatMap((group) => {
    const match = matchStudent(
      group,
      members,
      klasseBranchIdByLocalName.get(group.localName) ?? null,
    );
    return match.status === "matched" ? [match.member.id] : [];
  });
  const ownedItemKeys = await fetchOwnedItemKeys(matchedCustomerIds);

  return planSubjectChoices({
    rows,
    uploadBranchId: branchId,
    members,
    klasseBranchIdByLocalName,
    parentByBranchId,
    subjectsByBranchId,
    ownedItemKeys,
    now: new Date(),
  });
}

function summarizePlan(plan: SubjectChoicesPlan) {
  return {
    metrics: plan.metrics,
    unknownSubjects: plan.unknownSubjects,
    unknownUsers: plan.unknownUsers,
    ambiguousUsers: plan.ambiguousUsers,
  };
}

export const SubjectChoicesService = {
  async evaluate(branchId: string, rows: SubjectChoiceRow[]) {
    return summarizePlan(await buildPlan(branchId, rows));
  },

  async upload(branchId: string, rows: SubjectChoiceRow[]) {
    const plan = await buildPlan(branchId, rows);
    const summary = {
      ...summarizePlan(plan),
      ordersCreated: 0,
      booksOrdered: 0,
      errors: [] as { customerName: string; message: string }[],
    };

    async function createOrder(order: PlannedOrder) {
      try {
        await StorageService.Orders.add({
          amount: 0,
          orderItems: order.orderItems.map((orderItem) => ({
            type: "rent",
            item: orderItem.itemId,
            title: orderItem.title,
            amount: 0,
            unitPrice: 0,
            delivered: false,
            info: {
              from: new Date(),
              to: new Date(orderItem.deadline),
              numberOfPeriods: 1,
              periodType: orderItem.periodType,
            },
          })),
          branch: order.branchId,
          customer: order.customerId,
          byCustomer: true,
          placed: true,
          payments: [],
        });
        summary.ordersCreated++;
        summary.booksOrdered += order.orderItems.length;
      } catch (error) {
        summary.errors.push({
          customerName: order.customerName,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Process in chunks to avoid flooding the database
    const CHUNK_SIZE = 10;
    for (let i = 0; i < plan.orders.length; i += CHUNK_SIZE) {
      await Promise.allSettled(plan.orders.slice(i, i + CHUNK_SIZE).map(createOrder));
    }
    return summary;
  },
};
