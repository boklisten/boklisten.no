import type { Infer } from "@vinejs/vine/types";
import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import EmailVerification from "#models/email_verification";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { PasswordService } from "#services/password_service";
import { reconcileSignatureTask } from "#services/signature_helper";
import { invalidUserFields } from "#services/user_fields";
import { canSeeBranch } from "#shared/branch-visibility";
import type { User as UserDto } from "#shared/user";
import type { UserPermission } from "#shared/user-permission";
import type { VippsUser } from "#types/user";
import type { registerSchema } from "#validators/auth_validators";
import type { userProvisioningValidator } from "#validators/user_provisioning";
import type { userFieldsSchema } from "#validators/users";

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
 * A validated `userFieldsSchema` payload as the columns it sets: the request names match the
 * model's, so only the date and the optional-to-nullable fields need translating.
 */
export function userFieldsFrom({
  dob,
  branchMembershipId,
  guardianName,
  guardianEmail,
  guardianPhone,
  ...details
}: Infer<typeof userFieldsSchema>) {
  return {
    ...details,
    dob: dobFrom(dob),
    branchMembershipId: branchMembershipId ?? null,
    guardianName: guardianName ?? null,
    guardianEmail: guardianEmail ?? null,
    guardianPhone: guardianPhone ?? null,
  };
}

/**
 * A user may be moved only into a branch the person moving them may see. Keeping the current
 * membership, or clearing it, is always allowed, even when the current branch is hidden from them.
 */
export async function assertMembershipAllowed(
  actorPermission: UserPermission,
  currentBranchId: string | null,
  nextBranchId: string | null,
): Promise<void> {
  if (nextBranchId === null || nextBranchId === currentBranchId) {
    return;
  }
  const branch = await Branch.find(nextBranchId);
  if (branch === null || !canSeeBranch(actorPermission, branch.visibility)) {
    throw new BadRequestException("Du kan ikke velge denne skolen");
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

  async search(text: string): Promise<UserDto[]> {
    const users = await User.search(text);
    return users.map((user) => user.toDto());
  },

  /**
   * Employees may save details that are incomplete, typically an underage customer whose guardian
   * they know nothing about. The customer is then asked to complete them on their next login.
   */
  /**
   * The user's own details, from their settings or the confirm-details task. A new email is
   * unproven, so it starts unconfirmed with a fresh link (see `replaceEmail`).
   */
  async updateOwnDetails(
    user: User,
    changes: ReturnType<typeof userFieldsFrom> & Pick<User, "email">,
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
        | "postCode"
        | "postCity"
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

  async createVippsUser(vippsUser: VippsUser): Promise<User> {
    return User.create({
      email: vippsUser.email.trim().toLowerCase(),
      emailConfirmed: vippsUser.emailVerified,
      phone: vippsUser.phoneNumber,
      // Vipps sends "" for a detail the user has not shared.
      name: vippsUser.name || null,
      address: vippsUser.address || null,
      postCode: vippsUser.postalCode || null,
      postCity: vippsUser.postalCity || null,
      permission: "customer",
      vippsUserId: vippsUser.id,
    });
  },

  async createLocalUser({
    email,
    password,
    ...details
  }: Infer<typeof registerSchema>): Promise<User> {
    const fields = userFieldsFrom(details);
    await assertMembershipAllowed("customer", null, fields.branchMembershipId);
    const user = await User.create({
      ...fields,
      email,
      emailConfirmed: false,
      permission: "customer",
      localHashedPassword: await PasswordService.hash(password),
    });
    await sendEmailVerification(user);
    return user;
  },

  /** A customer created from a school's class list: no login yet, both tasks pending. */
  async createProvisionedUser(
    {
      name,
      phone,
      email,
      address,
      postalCity,
      postalCode,
      dob,
    }: Infer<typeof userProvisioningValidator>["userCandidates"][number],
    branchMembershipId: string | undefined,
  ): Promise<User> {
    return User.create({
      name,
      phone,
      email,
      address: address ?? null,
      dob: dobFrom(dob),
      postCode: postalCode ?? null,
      postCity: postalCity ?? null,
      emailConfirmed: true,
      branchMembershipId: branchMembershipId ?? null,
      taskConfirmDetails: true,
      taskSignAgreement: true,
      permission: "customer",
    });
  },
};
