import type { Infer } from "@vinejs/vine/types";
import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import EmailVerification from "#models/email_verification";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { BranchScope } from "#services/branch_scope";
import type { Viewer } from "#services/branch_scope";
import { reconcileSignatureTask } from "#services/signature_helper";
import { invalidUserFields } from "#services/user_fields";
import type { User as UserDto } from "#shared/user";
import type { UserPermission } from "#shared/user-permission";
import type { VippsUser } from "#types/user";
import type { registerSchema } from "#validators/auth_validators";
import type { userProvisioningValidator } from "#validators/user_provisioning";
import type { ownUserFieldsSchema } from "#validators/users";

/** A `vine.date()` value (midnight of the chosen day) as the calendar date it names. */
export function dobFrom(date: Date | null | undefined): DateTime | null {
  return date ? DateTime.fromJSDate(date).startOf("day") : null;
}

/**
 * Sets a new email and voids the verification links sent so far: a link proves the address it
 * was sent to, but confirming only flips `emailConfirmed`, so an old link would otherwise confirm
 * the new address. Returns whether the email changed (case aside).
 */
async function replaceEmail(user: User, email: string): Promise<boolean> {
  // Older rows may hold mixed case; the validator lowercases, and that alone is not a new address.
  if (email.toLowerCase() === user.email.toLowerCase()) {
    return false;
  }
  await EmailVerification.query().where("userId", user.id).delete();
  user.email = email;
  return true;
}

async function sendEmailVerification(user: User): Promise<void> {
  const emailVerification = await EmailVerification.create({ userId: user.id });
  await DispatchService.sendEmailVerification(user.email, emailVerification.id);
}

/**
 * A validated `ownUserFieldsSchema` payload (or a superset) as the columns it sets: the request
 * names match the model's, so only the date and the optional-to-nullable fields need translating.
 */
export function userFieldsFrom<Fields extends Infer<typeof ownUserFieldsSchema>>({
  dob,
  guardianName,
  guardianEmail,
  guardianPhone,
  ...details
}: Fields) {
  return {
    ...details,
    dob: dobFrom(dob),
    guardianName: guardianName ?? null,
    guardianEmail: guardianEmail ?? null,
    guardianPhone: guardianPhone ?? null,
  };
}

/**
 * A user may be moved only into a branch the person moving them may work on: one in their slice
 * of the tree (`BranchScope`), so a customer or guest picks among the public branches and the
 * root ("no school"), and staff among the nodes at or below their home node. Keeping the current
 * membership is always allowed, even when the current branch is outside that slice; only the
 * target is checked. `currentBranchId` is null for a user who does not exist yet, `viewer` for
 * a guest signing up.
 */
export async function assertMembershipAllowed(
  viewer: Viewer | null,
  currentBranchId: string | null,
  nextBranchId: string,
): Promise<void> {
  if (nextBranchId === currentBranchId) {
    return;
  }
  if (!(await BranchScope.isSelectable(viewer, nextBranchId))) {
    throw new BadRequestException("Du kan ikke velge denne skolen");
  }
}

/**
 * A user's own membership (settings, the confirm-details task) is judged as if they were homed at
 * the root: a customer picks among the public branches and the root, and staff among every
 * branch, whatever subtree they work in. Staff are customers too.
 */
export async function assertOwnMembershipAllowed(user: User, nextBranchId: string): Promise<void> {
  await assertMembershipAllowed(
    { permission: user.permission, employeeBranchId: (await Branch.root()).id },
    user.branchMembershipId,
    nextBranchId,
  );
}

/** Phone and email log in (SMS, Vipps), so only admins may change them on staff accounts. */
export function assertLoginDetailsEditable(
  actorPermission: UserPermission,
  user: User,
  next: { phone: string; email: string },
): void {
  if (
    user.permission !== "customer" &&
    actorPermission !== "admin" &&
    (next.phone !== user.phone || next.email !== user.email.toLowerCase())
  ) {
    throw new BadRequestException(
      "Bare administratorer kan endre mobilnummer og e-post for ansatte",
    );
  }
}

export const UserService = {
  /** The user with both task flags brought up to date, as the API returns them. */
  async withTasksReconciled(user: User): Promise<UserDto> {
    if (!user.taskConfirmDetails && invalidUserFields(user).length > 0) {
      user.taskConfirmDetails = true;
      await user.save();
    }
    await reconcileSignatureTask(user);
    return user.toDto();
  },

  /** The customers matching `text` among those in scope of the subtree (`BranchScope`). */
  async search(text: string, subtreeIds: string[]): Promise<UserDto[]> {
    const users = await User.search(text, BranchScope.customersInScope(subtreeIds));
    return users.map((user) => user.toDto());
  },

  /**
   * The user's own details, from their settings or the confirm-details task. A new email is
   * unproven, so it starts unconfirmed with a fresh link (see `replaceEmail`).
   */
  async updateOwnDetails(
    user: User,
    changes: ReturnType<typeof userFieldsFrom<Infer<typeof ownUserFieldsSchema>>> &
      Pick<User, "email" | "branchMembershipId">,
  ): Promise<User> {
    const { email, ...details } = changes;
    const emailChanged = await replaceEmail(user, email);
    user.merge({ ...details, taskConfirmDetails: false });
    if (emailChanged) {
      user.emailConfirmed = false;
    }
    await user.save();
    if (emailChanged) {
      await sendEmailVerification(user);
    }
    return user;
  },

  /**
   * Employees may save details that are incomplete, typically an underage customer whose guardian
   * they know nothing about. The customer is then asked to complete them on their next login.
   */
  async updateAsEmployee(
    user: User,
    changes: Partial<
      Pick<
        User,
        | "emailConfirmed"
        | "email"
        | "phone"
        | "name"
        | "address"
        | "postalCode"
        | "dob"
        | "branchMembershipId"
        | "guardianName"
        | "guardianEmail"
        | "guardianPhone"
      >
    >,
  ): Promise<User> {
    const { email, ...details } = changes;
    const emailChanged = email !== undefined && (await replaceEmail(user, email));
    user.merge(details);
    user.taskConfirmDetails = invalidUserFields(user).length > 0;
    await user.save();
    // An employee may vouch for the new address; otherwise the customer proves it like anyone.
    if (emailChanged && !user.emailConfirmed) {
      await sendEmailVerification(user);
    }
    return user;
  },

  /** Vipps knows nothing about schools, so the customer starts on the root. */
  async createVippsUser(vippsUser: VippsUser): Promise<User> {
    const root = await Branch.root();
    return User.create({
      email: vippsUser.email.trim().toLowerCase(),
      emailConfirmed: vippsUser.emailVerified,
      phone: vippsUser.phoneNumber,
      // Vipps sends "" for a detail the user has not shared.
      name: vippsUser.name || null,
      address: vippsUser.address || null,
      postalCode: vippsUser.postalCode || null,
      branchMembershipId: root.id,
      employeeBranchId: root.id,
      permission: "customer",
      vippsUserId: vippsUser.id,
    });
  },

  /** A sign-up whose phone a login code has just proven; the email still needs its link. */
  async createSmsUser(
    { email, branchMembershipId, ...details }: Infer<typeof registerSchema>,
    phone: string,
  ): Promise<User> {
    if (branchMembershipId !== undefined) {
      await assertMembershipAllowed(null, null, branchMembershipId);
    }
    const root = await Branch.root();
    const user = await User.create({
      ...userFieldsFrom(details),
      branchMembershipId: branchMembershipId ?? root.id,
      employeeBranchId: root.id,
      phone,
      email,
      emailConfirmed: false,
      permission: "customer",
    });
    await sendEmailVerification(user);
    return user;
  },

  /**
   * A customer created from a school's class list: no login yet, both tasks pending. A list that
   * names no class puts them on the root.
   */
  async createProvisionedUser(
    {
      name,
      phone,
      email,
      address,
      postalCode,
      dob,
    }: Infer<typeof userProvisioningValidator>["userCandidates"][number],
    branchMembershipId: string | undefined,
  ): Promise<User> {
    const root = await Branch.root();
    return User.create({
      name,
      phone,
      email,
      address: address ?? null,
      dob: dobFrom(dob),
      postalCode: postalCode ?? null,
      emailConfirmed: true,
      branchMembershipId: branchMembershipId ?? root.id,
      employeeBranchId: root.id,
      taskConfirmDetails: true,
      taskSignAgreement: true,
      permission: "customer",
    });
  },
};
