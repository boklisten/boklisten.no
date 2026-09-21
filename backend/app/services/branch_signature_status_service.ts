import type { DateTime } from "luxon";

import Signature from "#models/signature";
import User from "#models/user";
import { BranchRelationshipService } from "#services/branch_relationship_service";

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
    const descendantIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    const scopeIds = [branchId, ...descendantIds];
    const members = await User.membersOf(scopeIds).select("id", "dob");
    const newestSignatures = await Signature.newestPerCustomer(members.map((member) => member.id));
    const signatureByCustomer = new Map(
      newestSignatures.map((signature) => [signature.customerDetailsId, signature]),
    );
    const rows = members.map((member) => ({
      dob: member.dob,
      signature: signatureByCustomer.get(member.id),
    }));
    return BranchSignatureStatusService.summarize(rows);
  },
};
