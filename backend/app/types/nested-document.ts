import type { BlStorageHandler } from "#services/storage_service";

export interface NestedDocument {
  field: string;
  storage: BlStorageHandler;
}
