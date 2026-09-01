import { ObjectId } from "mongodb";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { StorageService } from "#services/storage_service";

export const BranchRelationshipService = {
  async getLeafDescendants(branchId: string): Promise<{ id: string; name: string }[]> {
    return StorageService.Branches.aggregate<{ id: string; name: string }>([
      {
        $match: {
          _id: new ObjectId(branchId),
        },
      },
      {
        $graphLookup: {
          from: BlSchemaName.Branches,
          startWith: new ObjectId(branchId),
          connectFromField: "childBranches",
          connectToField: "_id",
          as: "childBranches",
        },
      },
      { $unwind: "$childBranches" },
      {
        $match: {
          "childBranches.childBranches": { $eq: [] },
        },
      },
      {
        $project: {
          _id: "$childBranches._id",
          name: "$childBranches.name",
        },
      },
    ]);
  },
  async getNestedChildBranchIds(parentId: string) {
    const result: string[] = [];
    const visited = [parentId];
    const stack = [parentId];

    while (stack.length > 0) {
      const id = stack.pop();
      const branch = await StorageService.Branches.get(id);
      const children = branch.childBranches ?? [];

      for (const childId of children) {
        if (visited.includes(childId)) {
          continue;
        }
        visited.push(childId);
        result.push(childId);
        stack.push(childId);
      }
    }
    return result;
  },
};
