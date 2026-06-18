/** Counts of matches split by how far they have progressed. */
export interface MatchCompletionBreakdown {
  notStarted: number;
  started: number;
  completed: number;
}

/** Expected vs actually transferred number of books. */
export interface BookTransferProgress {
  expected: number;
  transferred: number;
}

/** The broad group a handover combination belongs to. */
export type MatchConfigCategory = "userOnly" | "both" | "standOnly";

/**
 * How many students ended up with a given combination of handovers,
 * e.g. "2 elevoverleveringer, 1 standoverlevering": 42 students.
 */
export interface MatchConfigDistributionEntry {
  userMatches: number;
  standMatches: number;
  label: string;
  students: number;
  category: MatchConfigCategory;
}

/** Expected vs actual books in to and out from the stand, per title. */
export interface StandBookExpectation {
  itemId: string;
  title: string;
  /** Copies students are expected to hand in to the stand. */
  expectedIn: number;
  /** Copies actually handed in to the stand so far. */
  actualIn: number;
  /** Copies students are expected to pick up from the stand. */
  expectedOut: number;
  /** Copies actually picked up from the stand so far. */
  actualOut: number;
}

/**
 * A node in the branch-membership hierarchy of the students who must visit the
 * stand, e.g. root "Ullern VGS" → "VG2" → "ST" → "A". `students` is the total
 * for the whole subtree, so a parent always covers its children.
 */
export interface BranchHierarchyNode {
  name: string;
  students: number;
  children: BranchHierarchyNode[];
}

/** How the students are split between only-student handovers and needing the stand. */
export interface StudentReachSummary {
  /** Distinct students involved in any handover. */
  totalStudents: number;
  /** Students who only have student-to-student handovers (no stand visit). */
  onlyUserHandovers: number;
  /** Students who have to visit the stand (have at least one stand handover). */
  mustVisitStand: number;
}

/** Number of students expected at the stand at a given meeting time. */
export interface StandAttendanceSlot {
  /** ISO date string of the meeting time, or null when no time is set. */
  date: string | null;
  people: number;
}

/** Number of students expected at a given location and meeting time. */
export interface UserAttendanceSlot {
  location: string;
  /** ISO date string of the meeting time, or null when no time is set. */
  date: string | null;
  people: number;
}

export interface MatchStatistics {
  /** ISO timestamp of when the statistics were computed. */
  generatedAt: string;
  userMatchCount: number;
  standMatchCount: number;
  studentReach: StudentReachSummary;
  /** Sorted by number of students, descending. */
  distribution: MatchConfigDistributionEntry[];
  userMatchCompletion: MatchCompletionBreakdown;
  standMatchCompletion: MatchCompletionBreakdown;
  userBookTransfer: BookTransferProgress;
  /** Books the students hand in to the stand. */
  standBooksIn: BookTransferProgress;
  /** Books the students pick up from the stand. */
  standBooksOut: BookTransferProgress;
  /** Per-title breakdown of books expected in and out of the stand, sorted by total, descending. */
  standBookExpectations: StandBookExpectation[];
  /** Branch membership hierarchy of the students who must visit the stand. */
  standBranchHierarchy: BranchHierarchyNode[];
  /** Sorted chronologically; the "no time" bucket (date === null) comes last. */
  standAttendance: StandAttendanceSlot[];
  /** Sorted by location, then chronologically; the "no time" bucket comes last. */
  userAttendance: UserAttendanceSlot[];
}
