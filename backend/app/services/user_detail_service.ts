import { Infer } from "@vinejs/vine/types";

import BlidService from "#services/blid_service";
import CryptoService from "#services/crypto_service";
import DispatchService from "#services/dispatch_service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import { UserDetail } from "#shared/user-detail";
import { VippsUser } from "#types/user";
import { registerSchema } from "#validators/auth_validators";
import { userProvisioningValidator } from "#validators/user_provisioning";
import EmailVerification from "#models/email_verification";

export const UserDetailService = {
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
        signatures: [],
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
    branchMembership: string,
  ) {
    const blid = BlidService.createUserBlid("local", CryptoService.random());
    return await StorageService.UserDetails.add(
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
