import type { DateTime } from "luxon";

import Branch from "#models/branch";
import Signature from "#models/signature";
import User from "#models/user";
import type { UserPermission } from "#shared/user-permission";

const PAGE_SIZE = 30;
const BATCH_SIZE = 50;
// Bounds the DB work per request when many consecutive signatures are invalid for their customer.
const MAX_BATCHES = 5;

interface GallerySignature {
  id: number;
  customerDetailsId: string;
  customerName: string;
  signingName: string;
  signedByGuardian: boolean;
  signedAtText: string;
  image: string;
  branchName: string | null;
  permission: UserPermission;
}

interface GalleryPage {
  signatures: GallerySignature[];
  nextCursor: string | null;
}

export interface GalleryCustomer {
  id: string;
  name: string;
  dob: DateTime | null;
  branchMembershipId: string | null;
  permission: UserPermission;
}

export interface GalleryContext {
  branchNames: ReadonlyMap<string, string>;
}

interface GalleryCursor {
  createdAt: Date;
  id: number;
}

export const SignatureGalleryService = {
  encodeCursor(cursor: GalleryCursor): string {
    return `${cursor.createdAt.getTime()}_${cursor.id}`;
  },

  decodeCursor(cursor: unknown): GalleryCursor | null {
    if (typeof cursor !== "string" || !/^\d{1,15}_\d{1,15}$/.test(cursor)) {
      return null;
    }
    const [createdAtMillis, id] = cursor.split("_").map(Number);
    return { createdAt: new Date(createdAtMillis ?? 0), id: id ?? 0 };
  },

  /**
   * Shapes a signature for the gallery when it is strictly valid for its (active) customer,
   * otherwise null.
   */
  toGalleryItem(
    signature: Signature,
    customer: GalleryCustomer | undefined,
    context: GalleryContext,
  ): GallerySignature | null {
    if (!customer || !signature.isValidFor(customer)) {
      return null;
    }
    return {
      id: signature.id,
      customerDetailsId: signature.customerDetailsId,
      customerName: customer.name,
      signingName: signature.signingName,
      signedByGuardian: signature.signedByGuardian,
      signedAtText: formatSignedDate(signature.createdAt),
      image: signature.image.toString("base64"),
      branchName: customer.branchMembershipId
        ? (context.branchNames.get(customer.branchMembershipId) ?? null)
        : null,
      permission: customer.permission,
    };
  },

  /**
   * One gallery page: the newest valid signature per customer, newest first, resuming after the
   * given cursor. The cursor always points at the last row judged (included or skipped), so pages
   * never overlap and never leave gaps.
   */
  async getPage(cursor: GalleryCursor | null): Promise<GalleryPage> {
    const signatures: GallerySignature[] = [];
    const branchNames = new Map<string, string>();
    let currentCursor = cursor;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const rows = await Signature.newestPerCustomerPage(currentCursor, BATCH_SIZE);
      if (rows.length === 0) {
        return { signatures, nextCursor: null };
      }
      const customersById = await User.byIds(rows.map((row) => row.customerDetailsId));
      await addMissingBranchNames(branchNames, [...customersById.values()]);
      for (const row of rows) {
        const item = SignatureGalleryService.toGalleryItem(
          row,
          customersById.get(row.customerDetailsId),
          { branchNames },
        );
        if (item) {
          signatures.push(item);
        }
        currentCursor = { createdAt: row.createdAt?.toJSDate() ?? new Date(0), id: row.id };
        if (signatures.length >= PAGE_SIZE) {
          return { signatures, nextCursor: SignatureGalleryService.encodeCursor(currentCursor) };
        }
      }
      if (rows.length < BATCH_SIZE) {
        return { signatures, nextCursor: null };
      }
    }
    return {
      signatures,
      nextCursor: currentCursor ? SignatureGalleryService.encodeCursor(currentCursor) : null,
    };
  },
};

function formatSignedDate(dateTime: DateTime | null): string {
  if (!dateTime) {
    return "";
  }
  return dateTime.toFormat("dd/MM/yyyy");
}

/**
 * Resolves the branch names for the customers' memberships, skipping ids already in the map so
 * each branch is fetched at most once per page.
 */
async function addMissingBranchNames(
  branchNames: Map<string, string>,
  customers: GalleryCustomer[],
): Promise<void> {
  const missing = [
    ...new Set(
      customers
        .map((customer) => customer.branchMembershipId)
        .filter((id): id is string => typeof id === "string" && !branchNames.has(id)),
    ),
  ];
  if (missing.length === 0) {
    return;
  }
  for (const [id, name] of await Branch.namesByIds(missing)) {
    branchNames.set(id, name);
  }
}
