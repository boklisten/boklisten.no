import { ObjectId } from "mongodb";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import { signatureIsValidForUser } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";

export interface MemberSignatureRow {
  dob?: Date | null;
  signAgreement?: boolean | null;
  signature?: { creationTime?: Date; signedByGuardian?: boolean } | null;
}

export interface BranchSignatureStatus {
  totalMembers: number;
  validSignature: number;
  needsSignature: number;
  noSignatureNeeded: number;
}

export const BranchSignatureStatusService = {
  summarize(rows: MemberSignatureRow[], now: Date): BranchSignatureStatus {
    const status: BranchSignatureStatus = {
      totalMembers: rows.length,
      validSignature: 0,
      needsSignature: 0,
      noSignatureNeeded: 0,
    };
    for (const row of rows) {
      if (row.signature && signatureIsValidForUser(row, row.signature, now)) {
        status.validSignature++;
      } else if (row.signAgreement === true) {
        status.needsSignature++;
      } else {
        status.noSignatureNeeded++;
      }
    }
    return status;
  },

  async getStatus(branchId: string): Promise<BranchSignatureStatus> {
    const descendantIds = await BranchRelationshipService.getNestedChildBranchIds(branchId);
    const scopeIds = [branchId, ...descendantIds];
    const rows = (await StorageService.UserDetails.aggregate([
      { $match: { branchMembership: { $in: scopeIds.map((id) => new ObjectId(id)) } } },
      {
        $project: {
          dob: 1,
          signAgreement: "$tasks.signAgreement",
          lastSignatureId: { $last: "$signatures" },
        },
      },
      {
        $lookup: {
          from: BlSchemaName.Signatures,
          localField: "lastSignatureId",
          foreignField: "_id",
          as: "signature",
          // Signature documents hold the drawn image; never pull it into the pipeline.
          pipeline: [{ $project: { creationTime: 1, signedByGuardian: 1 } }],
        },
      },
      { $project: { dob: 1, signAgreement: 1, signature: { $first: "$signature" } } },
    ])) as MemberSignatureRow[];
    return BranchSignatureStatusService.summarize(rows, new Date());
  },
};
