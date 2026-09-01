import { ObjectId } from "mongodb";

import Signature from "#models/signature";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import { StorageService } from "#services/storage_service";

export interface MemberSignatureRow {
  dob?: Date | null;
  signature?: Signature | null;
}

interface MemberRow {
  id: { toString: () => string };
  dob?: Date | null;
}

export interface BranchSignatureStatus {
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
    const members = await StorageService.UserDetails.aggregate<MemberRow>([
      { $match: { branchMembership: { $in: scopeIds.map((id) => new ObjectId(id)) } } },
      { $project: { dob: 1 } },
    ]);
    const newestSignatures = await Signature.newestPerCustomer(
      members.map((member) => member.id.toString()),
    );
    const signatureByCustomer = new Map(
      newestSignatures.map((signature) => [signature.customerDetailsId, signature]),
    );
    const rows = members.map((member) => ({
      dob: member.dob,
      signature: signatureByCustomer.get(member.id.toString()),
    }));
    return BranchSignatureStatusService.summarize(rows);
  },
};
