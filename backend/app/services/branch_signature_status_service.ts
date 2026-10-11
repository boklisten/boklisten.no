import type { DateTime } from "luxon";

import Signature from "#models/signature";
import User from "#models/user";
import { BranchScope } from "#services/branch_scope";

export interface MemberSignatureRow {
  dob: DateTime | null;
  signature?: Signature | null;
}

interface BranchSignatureStatus {
  totalMembers: number;
  validSignature: number;
  needsSignature: number;
}

export const BranchSignatureStatusService = {
  summarize(rows: MemberSignatureRow[]): BranchSignatureStatus {
    const status: BranchSignatureStatus = {
      totalMembers: rows.length,
      validSignature: 0,
      needsSignature: 0,
    };
    for (const row of rows) {
      if (row.signature?.isValidFor(row)) {
        status.validSignature++;
      } else {
        status.needsSignature++;
      }
    }
    return status;
  },

  async getStatus(branchId: string): Promise<BranchSignatureStatus> {
    const members = await User.membersOf(await BranchScope.subtreeIds(branchId)).select(
      "id",
      "dob",
    );
    const newestSignatures = await Signature.newestPerCustomer(members.map((member) => member.id));
    const signatureByCustomer = new Map(
      newestSignatures.map((signature) => [signature.customerId, signature]),
    );
    const rows = members.map((member) => ({
      dob: member.dob,
      signature: signatureByCustomer.get(member.id),
    }));
    return BranchSignatureStatusService.summarize(rows);
  },
};
