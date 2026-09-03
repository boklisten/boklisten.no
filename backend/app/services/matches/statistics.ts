import type BookHandover from "#models/book_handover";
import type MatchObligation from "#models/match_obligation";
import MatchRound from "#models/match_round";
import { MatchRepository } from "#services/matches/match_repository";
import {
  deriveObligationProgress,
  indexHandoversByHalf,
} from "#services/matches/obligation_status";
import type { HandoverFacts } from "#services/matches/obligation_status";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type {
  BookTransferProgress,
  BranchHierarchyNode,
  HandoverVerdictBreakdown,
  MatchCompletionBreakdown,
  MatchConfigDistributionEntry,
  MatchStatistics,
  SenderLiability,
  StandAttendanceSlot,
  StandBookExpectation,
  UserAttendanceSlot,
} from "#shared/match/match-statistics";
import { describeMatchConfig } from "#shared/match/match-statistics";
import { USER_PERMISSION } from "#shared/user-permission";

/** Sort meeting slots chronologically, keeping the "no time" bucket (null) last. */
function compareSlots(a: string | null, b: string | null): number {
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a.localeCompare(b);
}

function emptyBreakdown(): MatchCompletionBreakdown {
  return { notStarted: 0, started: 0, completed: 0 };
}

/** The two handovers that settle an obligation, either of which may not have happened. */
interface SettledObligation {
  obligation: MatchObligation;
  senderHandover: BookHandover | null;
  receiverHandover: BookHandover | null;
}

/**
 * How many of an obligation's two halves belong to a student.
 *
 * A stand-sided obligation has only one: the stand handing a book over is the same event as the
 * student receiving it, so there is no second fact to record. Counting the stand's half would cap
 * every stand match at 50% forever.
 */
function countableHalves(obligation: MatchObligation): number {
  return (
    (obligation.sender.userDetailId === null ? 0 : 1) +
    (obligation.receiver.userDetailId === null ? 0 : 1)
  );
}

function toHandoverFacts(handover: BookHandover | null): HandoverFacts | null {
  if (handover === null) {
    return null;
  }
  return {
    id: handover.id,
    fromCustomerId: handover.fromUserDetailId,
    toCustomerId: handover.toUserDetailId,
  };
}

function settledHalves({
  obligation,
  senderHandover,
  receiverHandover,
}: SettledObligation): number {
  return (
    (obligation.sender.userDetailId !== null && senderHandover !== null ? 1 : 0) +
    (obligation.receiver.userDetailId !== null && receiverHandover !== null ? 1 : 0)
  );
}

function emptyStatistics(): MatchStatistics {
  return {
    generatedAt: new Date().toISOString(),
    roundId: "",
    roundName: "",
    userMatchCount: 0,
    standMatchCount: 0,
    studentReach: { totalStudents: 0, onlyUserHandovers: 0, mustVisitStand: 0 },
    distribution: [],
    userMatchCompletion: emptyBreakdown(),
    standMatchCompletion: emptyBreakdown(),
    userBookTransfer: { expected: 0, transferred: 0 },
    standBooksIn: { expected: 0, transferred: 0 },
    standBooksOut: { expected: 0, transferred: 0 },
    standBookExpectations: [],
    standBranchHierarchy: [],
    standAttendance: [],
    userAttendance: [],
    handoverVerdicts: {
      asPlanned: 0,
      fromUnexpectedSender: 0,
      toUnexpectedRecipient: 0,
      outsideAnyMatch: 0,
    },
    senderLiability: { studentsStillResponsible: 0, copiesOutstanding: 0 },
  };
}

/**
 * Statistics for one round, read entirely from the obligations and handovers it produced.
 *
 * The old version compared "number of expected item ids" against "number of recorded blids" and
 * called the result completion. Those are different kinds of id, so the comparison only ever
 * worked by accident. Completion is now the share of obligation halves that a recorded handover
 * actually discharged.
 */
const increment = (map: Map<string, number>, item: string) =>
  map.set(item, (map.get(item) ?? 0) + 1);

export async function computeMatchStatistics(roundId?: number): Promise<MatchStatistics> {
  const round =
    roundId === undefined
      ? await MatchRepository.findDefaultRound()
      : await MatchRound.find(roundId);
  if (!round) {
    return emptyStatistics();
  }

  const matches = await MatchRepository.findForRound(round.id);
  const obligationIds = matches.flatMap((match) => match.obligations.map((o) => o.id));
  const handovers = await MatchRepository.handoversForObligations(obligationIds);
  const { bySenderHalf, byReceiverHalf } = indexHandoversByHalf(handovers);

  const settle = (obligation: MatchObligation): SettledObligation => ({
    obligation,
    senderHandover: bySenderHalf.get(obligation.id) ?? null,
    receiverHandover: byReceiverHalf.get(obligation.id) ?? null,
  });

  const userMatchCompletion = emptyBreakdown();
  const standMatchCompletion = emptyBreakdown();
  const userBookTransfer: BookTransferProgress = { expected: 0, transferred: 0 };
  const standBooksIn: BookTransferProgress = { expected: 0, transferred: 0 };
  const standBooksOut: BookTransferProgress = { expected: 0, transferred: 0 };
  const verdicts: HandoverVerdictBreakdown = {
    asPlanned: 0,
    fromUnexpectedSender: 0,
    toUnexpectedRecipient: 0,
    outsideAnyMatch: 0,
  };
  const liableStudents = new Set<string>();
  let copiesOutstanding = 0;

  const matchesPerCustomer = new Map<string, { userMatches: number; standMatches: number }>();
  const standCustomers: string[] = [];
  const standAttendanceCounts = new Map<string | null, number>();
  const userAttendanceStudents = new Map<
    string,
    { location: string; date: string | null; students: Set<string> }
  >();
  const expectedInByItem = new Map<string, number>();
  const actualInByItem = new Map<string, number>();
  const expectedOutByItem = new Map<string, number>();
  const actualOutByItem = new Map<string, number>();
  const bump = (customer: string, kind: "userMatches" | "standMatches") => {
    const existing = matchesPerCustomer.get(customer) ?? { userMatches: 0, standMatches: 0 };
    existing[kind]++;
    matchesPerCustomer.set(customer, existing);
  };

  let userMatchCount = 0;
  let standMatchCount = 0;

  for (const match of matches) {
    const customers = match.participants
      .map((participant) => participant.userDetailId)
      .filter((id): id is string => id !== null);
    const isStandMatch = match.participants.some(
      (participant) => participant.userDetailId === null,
    );
    const date = match.meetingTime ? match.meetingTime.toISO() : null;

    if (isStandMatch) {
      standMatchCount++;
      for (const customer of customers) {
        bump(customer, "standMatches");
        standCustomers.push(customer);
      }
      standAttendanceCounts.set(date, (standAttendanceCounts.get(date) ?? 0) + 1);
    } else {
      userMatchCount++;
      for (const customer of customers) {
        bump(customer, "userMatches");
      }

      const key = `${match.meetingLocation} ${date ?? ""}`;
      const slot = userAttendanceStudents.get(key);
      if (slot) {
        for (const customer of customers) {
          slot.students.add(customer);
        }
      } else {
        userAttendanceStudents.set(key, {
          location: match.meetingLocation,
          date,
          students: new Set(customers),
        });
      }
    }

    let countable = 0;
    let settled = 0;

    for (const obligation of match.obligations) {
      const state = settle(obligation);
      countable += countableHalves(obligation);
      settled += settledHalves(state);

      const senderIsStand = obligation.sender.userDetailId === null;
      const receiverIsStand = obligation.receiver.userDetailId === null;

      if (senderIsStand) {
        standBooksOut.expected++;
        increment(expectedOutByItem, obligation.itemId);
        if (state.receiverHandover) {
          standBooksOut.transferred++;
          increment(actualOutByItem, obligation.itemId);
        }
      } else if (receiverIsStand) {
        standBooksIn.expected++;
        increment(expectedInByItem, obligation.itemId);
        if (state.senderHandover) {
          standBooksIn.transferred++;
          increment(actualInByItem, obligation.itemId);
        }
      } else {
        userBookTransfer.expected++;
        if (state.senderHandover) {
          userBookTransfer.transferred++;
        }
      }

      // A student's own copy that has not been handed over anywhere keeps them liable.
      if (!senderIsStand && state.senderHandover === null) {
        copiesOutstanding++;
        liableStudents.add(obligation.sender.userDetailId!);
      }

      // One verdict per settled obligation, not per half — a planned student-to-student
      // handover settles both halves but is still a single event in the donut. Stand-sided
      // obligations have a single countable half, so `wentAsPlanned` (same handover on both
      // halves) never applies; a half settled without an unexpected party stands in for it.
      const progress = deriveObligationProgress(
        {
          senderCustomerId: obligation.sender.userDetailId,
          receiverCustomerId: obligation.receiver.userDetailId,
          itemId: obligation.itemId,
        },
        toHandoverFacts(state.senderHandover),
        toHandoverFacts(state.receiverHandover),
      );
      const standHalfAsPlanned =
        (senderIsStand && progress.receiverSatisfied && progress.receivedFrom === null) ||
        (receiverIsStand && progress.senderDischarged && progress.deliveredTo === null);
      if (progress.wentAsPlanned || standHalfAsPlanned) {
        verdicts.asPlanned++;
      }
      if (progress.receivedFrom !== null) {
        verdicts.fromUnexpectedSender++;
      }
      if (progress.deliveredTo !== null) {
        verdicts.toUnexpectedRecipient++;
      }
    }

    const breakdown = isStandMatch ? standMatchCompletion : userMatchCompletion;
    if (countable > 0 && settled >= countable) {
      breakdown.completed++;
    } else if (settled > 0) {
      breakdown.started++;
    } else {
      breakdown.notStarted++;
    }
  }

  verdicts.outsideAnyMatch = await countUnattachedHandovers(round);

  let onlyUserHandovers = 0;
  let mustVisitStand = 0;
  const distributionCounts = new Map<string, MatchConfigDistributionEntry>();
  for (const { userMatches: u, standMatches: s } of matchesPerCustomer.values()) {
    if (s > 0) {
      mustVisitStand++;
    } else {
      onlyUserHandovers++;
    }

    const key = `${u}-${s}`;
    const existing = distributionCounts.get(key);
    if (existing) {
      existing.students++;
    } else {
      distributionCounts.set(key, { ...describeMatchConfig(u, s), students: 1 });
    }
  }

  const [standBranchHierarchy, standBookExpectations] = await Promise.all([
    computeStandBranchHierarchy(standCustomers),
    computeStandBookExpectations({
      expectedInByItem,
      actualInByItem,
      expectedOutByItem,
      actualOutByItem,
    }),
  ]);

  const senderLiability: SenderLiability = {
    studentsStillResponsible: liableStudents.size,
    copiesOutstanding,
  };

  return {
    generatedAt: new Date().toISOString(),
    roundId: String(round.id),
    roundName: round.name,
    userMatchCount,
    standMatchCount,
    studentReach: {
      totalStudents: matchesPerCustomer.size,
      onlyUserHandovers,
      mustVisitStand,
    },
    distribution: [...distributionCounts.values()].toSorted((a, b) => b.students - a.students),
    userMatchCompletion,
    standMatchCompletion,
    userBookTransfer,
    standBooksIn,
    standBooksOut,
    standBookExpectations,
    standBranchHierarchy,
    standAttendance: [...standAttendanceCounts.entries()]
      .map(([date, people]) => ({ date, people }))
      .toSorted((a, b) => compareSlots(a.date, b.date)) satisfies StandAttendanceSlot[],
    userAttendance: [...userAttendanceStudents.values()]
      .map(({ location, date, students }) => ({ location, date, people: students.size }))
      .toSorted(
        (a, b) => a.location.localeCompare(b.location) || compareSlots(a.date, b.date),
      ) satisfies UserAttendanceSlot[],
    handoverVerdicts: verdicts,
    senderLiability,
  };
}

/**
 * Books the round's participants moved between this round being generated and the next one,
 * settling nothing.
 */
async function countUnattachedHandovers(round: MatchRound): Promise<number> {
  const from = round.generatedAt ?? round.createdAt;
  if (!from) {
    return 0;
  }
  const nextRound = await MatchRound.query()
    .where("id", ">", round.id)
    .orderBy("id", "asc")
    .first();
  const until = nextRound?.generatedAt ?? nextRound?.createdAt ?? null;
  return MatchRepository.unattachedHandoverCount(round.id, from, until);
}

/** Join the per-item in/out counts with their book titles, sorted by total volume. */
async function computeStandBookExpectations(counts: {
  expectedInByItem: Map<string, number>;
  actualInByItem: Map<string, number>;
  expectedOutByItem: Map<string, number>;
  actualOutByItem: Map<string, number>;
}): Promise<StandBookExpectation[]> {
  const itemIds = [
    ...new Set([
      ...counts.expectedInByItem.keys(),
      ...counts.actualInByItem.keys(),
      ...counts.expectedOutByItem.keys(),
      ...counts.actualOutByItem.keys(),
    ]),
  ];
  if (itemIds.length === 0) {
    return [];
  }

  const items = await StorageService.Items.getMany(itemIds, USER_PERMISSION.ADMIN);
  const titleById = new Map(items.map((item) => [item.id, item.title]));

  return itemIds
    .map((itemId) => ({
      itemId,
      title: titleById.get(itemId) ?? "Ukjent bok",
      expectedIn: counts.expectedInByItem.get(itemId) ?? 0,
      actualIn: counts.actualInByItem.get(itemId) ?? 0,
      expectedOut: counts.expectedOutByItem.get(itemId) ?? 0,
      actualOut: counts.actualOutByItem.get(itemId) ?? 0,
    }))
    .toSorted((a, b) => b.expectedIn + b.expectedOut - (a.expectedIn + a.expectedOut));
}

const UNKNOWN_BRANCH = "Ukjent filial";

interface MutableBranchNode {
  name: string;
  students: number;
  children: Map<string, MutableBranchNode>;
}

/**
 * Build the branch-membership hierarchy of the stand-visiting students, rooted
 * at each top-level branch (the one without a parent). Every student is counted
 * into each branch along its ancestor chain, so a parent's count covers its
 * children. Students with no known branch are grouped under "Ukjent filial".
 */
async function computeStandBranchHierarchy(
  standCustomers: string[],
): Promise<BranchHierarchyNode[]> {
  if (standCustomers.length === 0) {
    return [];
  }

  const [userDetails, branches] = await Promise.all([
    StorageService.UserDetails.getMany(standCustomers, USER_PERMISSION.ADMIN),
    StorageService.Branches.getAll(USER_PERMISSION.ADMIN),
  ]);

  const branchById = new Map(branches.map((branch) => [branch.id, branch]));
  const customerBranchId = new Map(
    userDetails.map((userDetail) => [userDetail.id, userDetail.branchMembership]),
  );

  const roots = new Map<string, MutableBranchNode>();
  for (const customer of standCustomers) {
    const chain = ancestorChain(customerBranchId.get(customer), branchById);
    let level = roots;
    for (const { id, name } of chain) {
      let node = level.get(id);
      if (!node) {
        node = { name, students: 0, children: new Map() };
        level.set(id, node);
      }
      node.students++;
      level = node.children;
    }
  }

  return toBranchNodes(roots);
}

/** The branches from root to leaf for a student's branch membership. */
function ancestorChain(
  leafId: string | undefined,
  branchById: Map<string, Branch>,
): { id: string; name: string }[] {
  if (!leafId || !branchById.has(leafId)) {
    return [{ id: UNKNOWN_BRANCH, name: UNKNOWN_BRANCH }];
  }
  const chain: { id: string; name: string }[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = leafId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const branch = branchById.get(currentId);
    if (!branch) {
      break;
    }
    // Use localName at deeper levels; the root usually only has a full name.
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- legacy data can hold "" localName, which must fall through to name
    chain.push({ id: currentId, name: branch.localName || branch.name });
    currentId = branch.parentBranch;
  }
  return chain.toReversed();
}

function toBranchNodes(level: Map<string, MutableBranchNode>): BranchHierarchyNode[] {
  return [...level.values()]
    .map((node) => ({
      name: node.name,
      students: node.students,
      children: toBranchNodes(node.children),
    }))
    .toSorted((a, b) => b.students - a.students);
}
