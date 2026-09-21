import type { Infer } from "@vinejs/vine/types";
import { DateTime } from "luxon";

import EmailVerification from "#models/email_verification";
import User from "#models/user";
import BlidService from "#services/blid_service";
import CryptoService from "#services/crypto_service";
import DispatchService from "#services/dispatch_service";
import { PasswordService } from "#services/password_service";
import { invalidUserFields } from "#services/user_detail_helper";
import type { User as UserDto } from "#shared/user";
import type { VippsUser } from "#types/user";
import type { registerSchema } from "#validators/auth_validators";
import type { userProvisioningValidator } from "#validators/user_provisioning";
import type { userDetailsSchema } from "#validators/users";

/** A `vine.date()` value (midnight of the chosen day) as the calendar date it names. */
export function dobFrom(date: Date | null | undefined): DateTime | null {
  return date ? DateTime.fromJSDate(date).startOf("day") : null;
}

/**
 * A validated `userDetailsSchema` payload as the columns it sets: the request names match the
 * model's, so only the date and the optional-to-nullable fields need translating.
 */
export function userDetailsFrom({
  dob,
  branchMembershipId,
  guardianName,
  guardianEmail,
  guardianPhone,
  ...details
}: Infer<typeof userDetailsSchema>) {
  return {
    ...details,
    dob: dobFrom(dob),
    branchMembershipId: branchMembershipId ?? null,
    guardianName: guardianName ?? null,
    guardianEmail: guardianEmail ?? null,
    guardianPhone: guardianPhone ?? null,
  };
}

export const UserService = {
  async search(text: string): Promise<UserDto[]> {
    const users = await User.search(text);
    return users.map((user) => user.toDto());
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
    user.merge(changes);
    user.taskConfirmDetails = invalidUserFields(user).length > 0;
    await user.save();
    return user;
  },

  async createVippsUser(vippsUser: VippsUser): Promise<User> {
    return User.create({
      blid: BlidService.createUserBlid("vipps", vippsUser.id),
      email: vippsUser.email.trim().toLowerCase(),
      emailConfirmed: vippsUser.emailVerified,
      phone: vippsUser.phoneNumber,
      name: vippsUser.name,
      address: vippsUser.address,
      postCode: vippsUser.postalCode,
      postCity: vippsUser.postalCity,
      permission: "customer",
      vippsUserId: vippsUser.id,
      vippsLastLogin: DateTime.now(),
    });
  },

  async createLocalUser({
    email,
    password,
    ...details
  }: Infer<typeof registerSchema>): Promise<User> {
    const user = await User.create({
      ...userDetailsFrom(details),
      blid: BlidService.createUserBlid("local", CryptoService.random()),
      email,
      emailConfirmed: false,
      permission: "customer",
      localHashedPassword: await PasswordService.hash(password),
    });
    const emailVerification = await EmailVerification.create({ userDetailId: user.id });
    await DispatchService.sendEmailVerification(email, emailVerification.id);
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
      blid: BlidService.createUserBlid("local", CryptoService.random()),
      name,
      phone,
      email,
      address: address ?? "",
      dob: dobFrom(dob),
      postCode: postalCode ?? "",
      postCity: postalCity ?? "",
      emailConfirmed: true,
      branchMembershipId: branchMembershipId ?? null,
      taskConfirmDetails: true,
      taskSignAgreement: true,
      permission: "customer",
    });
  },
};
