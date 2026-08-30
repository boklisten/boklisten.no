import { Infer } from "@vinejs/vine/types";
import { ObjectId } from "mongodb";

import BlidService from "#services/blid_service";
import CryptoService from "#services/crypto_service";
import DispatchService from "#services/dispatch_service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import { UserDetail } from "#shared/user-detail";
import { UserPermission } from "#shared/user-permission";
import { VippsUser } from "#types/user";
import { registerSchema } from "#validators/auth_validators";
import { userProvisioningValidator } from "#validators/user_provisioning";
import EmailVerification from "#models/email_verification";

export const UserDetailService = {
  async search(searchStr: string): Promise<(UserDetail & { permission: UserPermission })[]> {
    // blid is a random identifier, so matching against it only produces confusing results.
    const userDetails = await StorageService.UserDetails.search(searchStr, ["blid"]);
    const users = await StorageService.Users.aggregate<{
      userDetail: ObjectId;
      permission: UserPermission;
    }>([
      {
        $match: {
          userDetail: { $in: userDetails.map((userDetail) => new ObjectId(userDetail.id)) },
        },
      },
      { $project: { userDetail: 1, permission: 1 } },
    ]);
    const permissions = new Map(users.map((user) => [String(user.userDetail), user.permission]));

    const escaped = searchStr.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(escaped, "i");
    return (
      userDetails
        .map((userDetail) => ({
          userDetail: {
            ...userDetail,
            permission: permissions.get(userDetail.id) ?? ("customer" satisfies UserPermission),
          },
          // Customers matched on their own identity fields rank above those matched only via
          // guardian or address fields.
          matchesOwnInfo: [userDetail.name, userDetail.phone, userDetail.email].some(
            (field) => field !== undefined && matcher.test(field),
          ),
          // Documents created before Mongoose timestamps were enabled lack creationTime; the
          // ObjectId embeds the creation timestamp, so fall back to that.
          createdAt: userDetail.creationTime
            ? new Date(userDetail.creationTime).getTime()
            : new ObjectId(userDetail.id).getTimestamp().getTime(),
        }))
        // Own-info matches first, then newest customers first within each group.
        .toSorted((a, b) =>
          a.matchesOwnInfo === b.matchesOwnInfo
            ? b.createdAt - a.createdAt
            : Number(b.matchesOwnInfo) - Number(a.matchesOwnInfo),
        )
        .map(({ userDetail }) => userDetail)
    );
  },
  async getByPhoneNumber(phone: string): Promise<UserDetail | null> {
    const databaseQuery = new SEDbQuery();
    databaseQuery.stringFilters = [{ fieldName: "phone", value: phone }];
    const userDetails = await StorageService.UserDetails.getByQueryOrNull(databaseQuery);

    return userDetails?.[0] ?? null;
  },
  async getByEmail(email: string): Promise<UserDetail | null> {
    const databaseQuery = new SEDbQuery();
    databaseQuery.stringFilters = [{ fieldName: "email", value: email }];
    const userDetails = await StorageService.UserDetails.getByQueryOrNull(databaseQuery);

    return userDetails?.[0] ?? null;
  },
  async createVippsUserDetail(vippsUser: VippsUser) {
    const blid = BlidService.createUserBlid("vipps", vippsUser.id);
    return await StorageService.UserDetails.add(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fixme: it is janky to just add this without all the details
      {
        email: vippsUser.email,
        blid,
        emailConfirmed: vippsUser.emailVerified,
        phone: vippsUser.phoneNumber,
        name: vippsUser.name,
        address: vippsUser.address,
        postCode: vippsUser.postalCode,
        postCity: vippsUser.postalCity,
        // fixme: it is janky to just add this without all the details
      } as UserDetail,
      { id: blid, permission: "customer" },
    );
  },
  async createLocalUserDetail({
    email,
    phoneNumber,
    name,
    address,
    postalCode,
    postalCity,
    dob,
    branchMembership,
    guardian,
  }: Infer<typeof registerSchema>) {
    const blid = BlidService.createUserBlid("local", CryptoService.random());
    const userDetail = await StorageService.UserDetails.add(
      {
        email,
        phone: phoneNumber,
        name,
        address,
        postCode: postalCode,
        postCity: postalCity,
        dob,
        branchMembership,
        guardian: {
          name: guardian?.name ?? "",
          email: guardian?.email ?? "",
          phone: guardian?.phone ?? "",
        },
        blid,
      },
      { id: blid, permission: "customer" },
    );
    const emailVerification = await EmailVerification.create({
      userDetailId: userDetail.id,
    });
    await DispatchService.sendEmailVerification(email, emailVerification.id);

    return userDetail;
  },
  async createProvisionedUserDetail(
    {
      name,
      phone,
      email,
      address,
      postalCity,
      postalCode,
      dob,
    }: Infer<typeof userProvisioningValidator>["userCandidates"][number],
    branchMembership: string | undefined,
  ) {
    const blid = BlidService.createUserBlid("local", CryptoService.random());
    return await StorageService.UserDetails.add(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fixme: it is janky to just add this without all the details
      {
        blid,
        name,
        phone,
        email,
        address,
        dob,
        postCode: postalCode,
        postCity: postalCity,
        emailConfirmed: true,
        branchMembership,
        tasks: {
          confirmDetails: true,
          signAgreement: true,
        },
        // fixme: it is janky to just add this without all the details
      } as UserDetail,
      { id: blid, permission: "customer" },
    );
  },
};
