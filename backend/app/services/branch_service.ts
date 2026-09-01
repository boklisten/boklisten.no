import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";

export const BranchService = {
  async getByName(branchName: string | undefined): Promise<Branch | null> {
    try {
      const databaseQuery = new SEDbQuery();
      databaseQuery.stringFilters = [{ fieldName: "name", value: branchName ?? "" }];
      const [branch] = await StorageService.Branches.getByQuery(databaseQuery);
      return branch ?? null;
    } catch {
      return null;
    }
  },
};
