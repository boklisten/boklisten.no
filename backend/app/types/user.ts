import type { BlDocument } from "#shared/bl-document";
import type { UserPermission } from "#shared/user-permission";

interface VippsLogin {
  userId: string;
  lastLogin: Date;
}

interface LocalLogin {
  hashedPassword: string;
  lastLogin?: Date;
}

export interface VippsUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  phoneNumberVerified: boolean;
  address: string;
  postalCode: string;
  postalCity: string;
}

export interface Login {
  vipps?: VippsLogin;
  local?: LocalLogin;
  lastTokenIssuedAt?: Date;
}

export interface User extends BlDocument {
  userDetail: string;
  permission: UserPermission;
  login: Login;
}
