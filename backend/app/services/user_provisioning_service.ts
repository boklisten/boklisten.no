import { Exception } from "@adonisjs/core/exceptions";
import { Infer } from "@vinejs/vine/types";

import { BranchRelationshipService } from "#services/branch_relationship_service";
import DispatchService from "#services/dispatch_service";
import { UserDetailHelper } from "#services/legacy/collections/user-detail/helpers/user-detail.helper";
import { userHasValidSignature } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import { UserDetail } from "#shared/user-detail";
import { UserDetailService } from "#services/user_detail_service";
import { userProvisioningValidator } from "#validators/user_provisioning";

type UserCandidate = Infer<typeof userProvisioningValidator>["userCandidates"][number];
type BranchSummary = { id: string; name: string };

export interface BranchMapping {
  localName: string;
  status: "matched" | "unmatched" | "ambiguous";
  branch: BranchSummary | null;
}

function normalizeBranchName(name: string) {
  return name.replaceAll(/\s/g, "").toLowerCase();
}

export function normalizePhone(phone: string) {
  return phone.replaceAll(/\D/g, "").slice(-8);
}

export function buildBranchMappings(
  localNames: string[],
  branches: BranchSummary[],
): BranchMapping[] {
  return [...new Set(localNames)]
    .sort((a, b) => a.localeCompare(b))
    .map((localName) => {
      const matches = branches.filter((branch) =>
        normalizeBranchName(branch.name).includes(normalizeBranchName(localName)),
      );
      if (matches.length === 1 && matches[0]) {
        return { localName, status: "matched", branch: matches[0] };
      }
      return { localName, status: matches.length === 0 ? "unmatched" : "ambiguous", branch: null };
    });
}

export function mergeCandidateIntoUserDetail(
  candidate: UserCandidate,
  existingUser: UserDetail,
  branchId: string,
) {
  return {
    name: candidate.name,
    phone: normalizePhone(candidate.phone),
    email: candidate.email,
    address: candidate.address ?? existingUser.address,
    postCode: candidate.postalCode ?? existingUser.postCode,
    postCity: candidate.postalCity ?? existingUser.postCity,
    dob: candidate.dob ?? existingUser.dob,
    branchMembership: branchId,
  };
}

export function computeTasks(userDetail: UserDetail, hasValidSignature: boolean) {
  return {
    confirmDetails: new UserDetailHelper().getInvalidUserDetailFields(userDetail).length > 0,
    signAgreement: !hasValidSignature,
  };
}

async function findExistingUsers(userCandidates: UserCandidate[]): Promise<(UserDetail | null)[]> {
  const phones = userCandidates.map((candidate) => normalizePhone(candidate.phone));
  const emails = userCandidates.map((candidate) => candidate.email);
  const matches = (await StorageService.UserDetails.aggregate([
    { $match: { $or: [{ phone: { $in: phones } }, { email: { $in: emails } }] } },
  ])) as UserDetail[];
  const usersByPhone = new Map(
    matches.filter((user) => user.phone).map((user) => [user.phone, user]),
  );
  const usersByEmail = new Map(matches.map((user) => [user.email, user]));
  return userCandidates.map(
    (candidate) =>
      usersByPhone.get(normalizePhone(candidate.phone)) ??
      usersByEmail.get(candidate.email) ??
      null,
  );
}

async function updateExistingUser(
  candidate: UserCandidate,
  existingUser: UserDetail,
  branchId: string,
) {
  const update = mergeCandidateIntoUserDetail(candidate, existingUser, branchId);
  const mergedUser = {
    ...existingUser,
    ...update,
    signatures: existingUser.signatures ?? [],
  } as UserDetail;
  const tasks = computeTasks(mergedUser, await userHasValidSignature(mergedUser));
  await StorageService.UserDetails.update(existingUser.id, { ...update, tasks });
}

async function createNewUser(candidate: UserCandidate, branch: BranchSummary) {
  const userDetail = await UserDetailService.createProvisionedUserDetail(
    { ...candidate, phone: normalizePhone(candidate.phone) },
    branch.id,
  );
  await StorageService.Users.add({
    userDetail: userDetail.id,
    permission: "customer",
    login: {},
  });
  await DispatchService.sendOnboardingMessage({
    userDetail,
    branchName: branch.name,
  });
}

async function evaluateCandidates(branchId: string, userCandidates: UserCandidate[]) {
  const branches = await BranchRelationshipService.getLeafDescendants(branchId);
  const mappings = buildBranchMappings(
    userCandidates.map((candidate) => candidate.localName),
    branches,
  );
  const existingUsers = await findExistingUsers(userCandidates);
  return { mappings, existingUsers };
}

export const UserProvisioningService = {
  async evaluate(branchId: string, userCandidates: UserCandidate[]) {
    const { mappings, existingUsers } = await evaluateCandidates(branchId, userCandidates);
    const updateCount = existingUsers.filter(Boolean).length;
    return {
      mappings,
      updateCount,
      createCount: userCandidates.length - updateCount,
    };
  },

  async provision(branchId: string, userCandidates: UserCandidate[]) {
    const { mappings, existingUsers } = await evaluateCandidates(branchId, userCandidates);
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

    const summary = {
      createdCount: 0,
      updatedCount: 0,
      errors: [] as { name: string; email: string; message: string }[],
    };
    async function processCandidate(candidate: UserCandidate, index: number) {
      const branch = branchByLocalName.get(candidate.localName);
      if (!branch) return;
      try {
        const existingUser = existingUsers[index];
        if (existingUser) {
          await updateExistingUser(candidate, existingUser, branch.id);
          summary.updatedCount++;
        } else {
          await createNewUser(candidate, branch);
          summary.createdCount++;
        }
      } catch (error) {
        summary.errors.push({
          name: candidate.name,
          email: candidate.email,
          message: error instanceof Error ? error.message : String(error),
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
