import { DbRememberMeTokensProvider } from "@adonisjs/auth/session";
import { Exception } from "@adonisjs/core/exceptions";
import { beforeCreate, belongsTo, column } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";
import type { DateTime } from "luxon";

import Branch from "#models/branch";
import { assignObjectId } from "#models/helpers/object_id";
import { UserSchema } from "#database/schema";
import { phoneDigits } from "#shared/phone_number";
import type { User as UserDto } from "#shared/user";
import type { UserPermission } from "#shared/user-permission";
import { USER_PERMISSION } from "#shared/user-permission";

/**
 * A customer or employee: contact details, tasks, branch membership, permission and login
 * credentials in one row (see `shared/user.ts` for the field semantics). The id is the former
 * user-details id; sessions are tagged with it and remember-me tokens reference it.
 *
 * The password hash never leaves the backend: it is excluded from serialisation and from
 * `toDto()`, which is what controllers return.
 */
export default class User extends UserSchema {
  static override selfAssignPrimaryKey = true;

  /** Long-lived login tokens for the session guard (`config/auth.ts`). */
  static rememberMeTokens = DbRememberMeTokensProvider.forModel(User);

  declare permission: UserPermission;

  @column({ serializeAs: null })
  declare localHashedPassword: string | null;

  @belongsTo(() => Branch, { foreignKey: "branchMembershipId" })
  declare branchMembership: BelongsTo<typeof Branch>;

  @beforeCreate()
  static assignId(user: User) {
    assignObjectId(user);
  }

  static async findOptional(id: string | null | undefined): Promise<User | null> {
    return id ? this.find(id) : null;
  }

  /** `findOrFail` for references the legacy documents type as optional but the flow requires. */
  static async getOrFail(id: string | null | undefined): Promise<User> {
    const user = await this.findOptional(id);
    if (user === null) {
      throw new Exception(`Fant ikke bruker ${id ?? ""}`, { status: 404, code: "E_ROW_NOT_FOUND" });
    }
    return user;
  }

  /**
   * The users with the given ids, keyed by id. Ids that do not exist are simply absent, which is
   * how callers joining user data onto Mongo query results detect a deleted customer.
   */
  static async byIds(ids: Iterable<string | null | undefined>): Promise<Map<string, User>> {
    const unique = [...new Set([...ids].filter((id): id is string => typeof id === "string"))];
    if (unique.length === 0) {
      return new Map();
    }
    const users = await this.findMany(unique);
    return new Map(users.map((user) => [user.id, user]));
  }

  static async namesByIds(ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
    const users = await this.byIds(ids);
    return new Map([...users].map(([id, user]) => [id, user.name]));
  }

  static async byEmail(email: string): Promise<User | null> {
    return this.query().whereRaw("lower(email) = ?", [email.trim().toLowerCase()]).first();
  }

  /** Phones are stored as eight digits; the lookup accepts the `+47`/spaced spellings too. */
  static async byPhone(phone: string): Promise<User | null> {
    return this.query().where("phone", phoneDigits(phone)).first();
  }

  /** Login by whichever of email or phone the customer typed. */
  static async byUsername(username: string): Promise<User | null> {
    return username.includes("@") ? this.byEmail(username) : this.byPhone(username);
  }

  /** Direct members of the given branches; callers expand a branch to its descendants first. */
  static membersOf(branchIds: string[]) {
    return this.query().whereIn("branchMembershipId", branchIds);
  }

  static async countMembersOf(branchIds: string[]): Promise<number> {
    if (branchIds.length === 0) {
      return 0;
    }
    const row = await this.membersOf(branchIds)
      .count("* as total")
      .pojo<{ total: string }>()
      .first();
    return Number(row?.total ?? 0);
  }

  static async employees(): Promise<User[]> {
    return this.query().whereNot("permission", USER_PERMISSION.CUSTOMER).orderBy("name");
  }

  /**
   * Customers whose contact details (their own, their guardian's or their address) contain the
   * text. Matches on the customer's own name, phone or email rank first, newest customers first
   * within each group. Blids are random identifiers, so they are not searched.
   */
  static async search(text: string): Promise<User[]> {
    const normalized = text.trim();
    if (normalized.length === 0) {
      return [];
    }
    const pattern = `%${normalized.replaceAll(/[\\%_]/g, String.raw`\$&`)}%`;
    const ownFields = ["name", "phone", "email"];
    const otherFields = [
      "address",
      "postCode",
      "postCity",
      "guardianName",
      "guardianEmail",
      "guardianPhone",
    ];
    return this.query()
      .where((query) => {
        for (const field of [...ownFields, ...otherFields]) {
          void query.orWhereILike(field, pattern);
        }
      })
      .orderByRaw(
        `(${ownFields.map(() => "?? ILIKE ?").join(" OR ")}) DESC, created_at DESC`,
        ownFields.flatMap((field) => [this.namingStrategy.columnName(this, field), pattern]),
      );
  }

  /** The API shape; a plain object so Tuyau types the dates the way every other endpoint does. */
  toDto(): UserDto {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      address: this.address,
      postCode: this.postCode,
      postCity: this.postCity,
      emailConfirmed: this.emailConfirmed,
      dob: this.dob?.toISODate() ?? null,
      guardianName: this.guardianName,
      guardianEmail: this.guardianEmail,
      guardianPhone: this.guardianPhone,
      branchMembershipId: this.branchMembershipId,
      taskConfirmDetails: this.taskConfirmDetails,
      taskSignAgreement: this.taskSignAgreement,
      permission: this.permission,
      createdAt: toDate(this.createdAt),
    };
  }
}

function toDate(dateTime: DateTime | null): Date {
  return dateTime?.toJSDate() ?? new Date(0);
}
