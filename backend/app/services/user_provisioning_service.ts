import { Exception } from "@adonisjs/core/exceptions";
import * as Sentry from "@sentry/node";
import type { Infer } from "@vinejs/vine/types";

import Branch from "#models/branch";
import User from "#models/user";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import DispatchService from "#services/dispatch_service";
import { userHasValidSignature } from "#services/signature_helper";
import { invalidUserFields } from "#services/user_detail_helper";
import { dobFrom, UserService } from "#services/user_service";
import type { userProvisioningValidator } from "#validators/user_provisioning";

type UserCandidate = Infer<typeof userProvisioningValidator>["userCandidates"][number];
interface BranchSummary {
  id: string;
  name: string;
}

interface BranchMapping {
  localName: string;
  status: "matched" | "unmatched" | "ambiguous";
  branch: BranchSummary | null;
  candidates: BranchSummary[];
}

interface BranchResolution {
  localName: string;
  branchId: string;
}

function normalizeBranchName(name: string) {
  return name.replaceAll(/\s/g, "").toLowerCase();
}

export function buildBranchMappings(
  localNames: (string | undefined)[],
  branches: BranchSummary[],
): BranchMapping[] {
  return [...new Set(localNames.filter((localName): localName is string => Boolean(localName)))]
    .toSorted((a, b) => a.localeCompare(b))
    .map((localName) => {
      const candidates = branches
        .filter((branch) =>
          normalizeBranchName(branch.name).includes(normalizeBranchName(localName)),
        )
        .toSorted(
          (a, b) =>
            normalizeBranchName(a.name).length - normalizeBranchName(b.name).length ||
            a.name.localeCompare(b.name),
        );
      if (candidates.length === 1 && candidates[0]) {
        return { localName, status: "matched", branch: candidates[0], candidates };
      }
      return {
        localName,
        status: candidates.length === 0 ? "unmatched" : "ambiguous",
        branch: null,
        candidates,
      };
    });
}

export function applyBranchResolutions(
  mappings: BranchMapping[],
  resolutions: BranchResolution[],
): BranchMapping[] {
  const resolvedBranchIds = new Map(
    resolutions.map((resolution) => [resolution.localName, resolution.branchId]),
  );
  return mappings.map((mapping) => {
    if (mapping.status !== "ambiguous") {
      return mapping;
    }
    const branch = mapping.candidates.find(
      (candidate) => candidate.id === resolvedBranchIds.get(mapping.localName),
    );
    return branch ? { ...mapping, status: "matched", branch } : mapping;
  });
}

/** The columns a class list may overwrite on an existing customer; blanks keep what is there. */
export function mergeCandidateIntoUser(
  candidate: UserCandidate,
  existingUser: Pick<User, "address" | "postCode" | "postCity" | "dob">,
  branchId: string | undefined,
) {
  return {
    name: candidate.name,
    phone: candidate.phone,
    email: candidate.email,
    address: candidate.address ?? existingUser.address,
    postCode: candidate.postalCode ?? existingUser.postCode,
    postCity: candidate.postalCity ?? existingUser.postCity,
    dob: candidate.dob ? dobFrom(candidate.dob) : existingUser.dob,
    ...(branchId ? { branchMembershipId: branchId } : {}),
  };
}

export function computeTasks(
  user: Parameters<typeof invalidUserFields>[0],
  hasValidSignature: boolean,
) {
  return {
    taskConfirmDetails: invalidUserFields(user).length > 0,
    taskSignAgreement: !hasValidSignature,
  };
}

/**
 * For each row, the index of the earlier row that already names the same person, or null when the
 * row is the first to name them. Two rows are the same person when they share a phone or an email,
 * or when both resolve to the same existing customer — a class list that repeats a pupil, or lists
 * siblings on one guardian's number. Only the first row is provisioned: the later ones would
 * collide on the unique phone and email indexes, or silently overwrite each other.
 *
 * A duplicate's own phone and email are deliberately not registered, since the row it duplicates
 * already holds them and the row itself is never saved.
 */
export function findDuplicateRows(
  userCandidates: UserCandidate[],
  existingUsers: ({ id: string } | null)[],
): (number | null)[] {
  const firstRowByKey = new Map<string, number>();
  return userCandidates.map((candidate, index) => {
    const existingUser = existingUsers[index];
    const keys = [
      `phone:${candidate.phone}`,
      `email:${candidate.email.toLowerCase()}`,
      ...(existingUser ? [`user:${existingUser.id}`] : []),
    ];
    const firstRow = keys.map((key) => firstRowByKey.get(key)).find((row) => row !== undefined);
    if (firstRow !== undefined) {
      return firstRow;
    }
    for (const key of keys) {
      firstRowByKey.set(key, index);
    }
    return null;
  });
}

async function findExistingUsers(userCandidates: UserCandidate[]): Promise<(User | null)[]> {
  const phones = userCandidates.map((candidate) => candidate.phone);
  const emails = userCandidates.map((candidate) => candidate.email);
  const matches = await User.query()
    .whereIn("phone", phones)
    .orWhereRaw("lower(email) = ANY(?)", [emails.map((email) => email.toLowerCase())]);
  const usersByPhone = new Map(
    matches.flatMap((user) => (user.phone === null ? [] : [[user.phone, user] as const])),
  );
  const usersByEmail = new Map(matches.map((user) => [user.email.toLowerCase(), user]));
  return userCandidates.map(
    (candidate) =>
      usersByPhone.get(candidate.phone) ?? usersByEmail.get(candidate.email.toLowerCase()) ?? null,
  );
}

async function updateExistingUser(
  candidate: UserCandidate,
  existingUser: User,
  branchId: string | undefined,
) {
  existingUser.merge(mergeCandidateIntoUser(candidate, existingUser, branchId));
  existingUser.merge(computeTasks(existingUser, await userHasValidSignature(existingUser)));
  await existingUser.save();
}

async function createNewUser(
  candidate: UserCandidate,
  branchMembershipId: string | undefined,
  branchName: string,
) {
  const user = await UserService.createProvisionedUser(candidate, branchMembershipId);
  await DispatchService.sendOnboardingMessage({
    userDetail: user,
    branchName,
  });
}

async function evaluateCandidates(branchId: string, userCandidates: UserCandidate[]) {
  const branches = await BranchRelationshipService.getLeafDescendants(branchId);
  const mappings = buildBranchMappings(
    userCandidates.map((candidate) => candidate.localName),
    branches,
  );
  const existingUsers = await findExistingUsers(userCandidates);
  return {
    mappings,
    existingUsers,
    duplicateRows: findDuplicateRows(userCandidates, existingUsers),
  };
}

/** The unique index a failed write collided on, or null when it failed for another reason. */
function violatedUniqueIndex(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === "23505" && typeof constraint === "string" ? constraint : null;
}

/**
 * What to tell the administrator about a row that could not be saved. A row can still collide on
 * a unique index after the in-batch duplicates are filtered out, when its phone belongs to one
 * customer and its email to another. Anything else is unexpected: the row gets a plain message
 * and the real error goes to Sentry rather than into a dialog, where the raw SQL of a database
 * error would otherwise end up.
 */
export function provisioningErrorMessage(error: unknown, candidate: UserCandidate): string {
  switch (violatedUniqueIndex(error)) {
    case "users_phone_unique": {
      return `Mobilnummeret ${candidate.phone} tilhører allerede en annen kunde`;
    }
    case "users_email_unique": {
      return `E-postadressen ${candidate.email} tilhører allerede en annen kunde`;
    }
    default: {
      Sentry.captureException(error, { extra: { candidateEmail: candidate.email } });
      return "Ukjent feil. Ta kontakt på teknisk@boklisten.no dersom det gjentar seg.";
    }
  }
}

export const UserProvisioningService = {
  async evaluate(branchId: string, userCandidates: UserCandidate[]) {
    const { mappings, existingUsers, duplicateRows } = await evaluateCandidates(
      branchId,
      userCandidates,
    );
    const duplicateCount = duplicateRows.filter((row) => row !== null).length;
    const updateCount = existingUsers.filter(
      (user, index) => user !== null && duplicateRows[index] === null,
    ).length;
    return {
      mappings,
      updateCount,
      createCount: userCandidates.length - updateCount - duplicateCount,
      duplicateCount,
      // Counted here rather than in the browser so that it agrees with the other two: a skipped
      // duplicate is never uploaded, with or without a class.
      withoutClassCount: userCandidates.filter(
        (candidate, index) => !candidate.localName && duplicateRows[index] === null,
      ).length,
    };
  },

  async provision(
    branchId: string,
    userCandidates: UserCandidate[],
    branchResolutions: BranchResolution[] = [],
  ) {
    const {
      mappings: unresolvedMappings,
      existingUsers,
      duplicateRows,
    } = await evaluateCandidates(branchId, userCandidates);
    const mappings = applyBranchResolutions(unresolvedMappings, branchResolutions);
    const unmatchedLocalNames = mappings
      .filter((mapping) => mapping.status !== "matched")
      .map((mapping) => mapping.localName);
    if (unmatchedLocalNames.length > 0) {
      throw new Exception(`Fant ingen entydig filial for: ${unmatchedLocalNames.join(", ")}`, {
        status: 400,
        code: "E_UNMATCHED_LOCAL_NAMES",
      });
    }
    const branchByLocalName = new Map(
      mappings.map((mapping) => [mapping.localName, mapping.branch]),
    );
    const uploadBranch = await Branch.findOrFail(branchId);

    const summary = {
      createdCount: 0,
      updatedCount: 0,
      duplicates: [] as { name: string; email: string; duplicateOf: string }[],
      errors: [] as { name: string; email: string; message: string }[],
    };
    async function processCandidate(candidate: UserCandidate, index: number) {
      const branch = candidate.localName ? branchByLocalName.get(candidate.localName) : null;
      if (candidate.localName && !branch) {
        return;
      }
      // The row names someone an earlier row already named; that row carries their details.
      const duplicateRow = duplicateRows[index];
      if (duplicateRow !== null && duplicateRow !== undefined) {
        summary.duplicates.push({
          name: candidate.name,
          email: candidate.email,
          duplicateOf: userCandidates[duplicateRow]?.name ?? "",
        });
        return;
      }
      try {
        const existingUser = existingUsers[index];
        if (existingUser) {
          await updateExistingUser(candidate, existingUser, branch?.id);
          summary.updatedCount++;
        } else {
          await createNewUser(candidate, branch?.id, branch?.name ?? uploadBranch.name);
          summary.createdCount++;
        }
      } catch (error) {
        summary.errors.push({
          name: candidate.name,
          email: candidate.email,
          message: provisioningErrorMessage(error, candidate),
        });
      }
    }

    // Process in chunks to avoid flooding the database and the SMS/email APIs
    const CHUNK_SIZE = 10;
    for (let i = 0; i < userCandidates.length; i += CHUNK_SIZE) {
      await Promise.allSettled(
        userCandidates
          .slice(i, i + CHUNK_SIZE)
          .map((candidate, offset) => processCandidate(candidate, i + offset)),
      );
    }
    return summary;
  },
};
