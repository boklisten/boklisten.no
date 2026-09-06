import type { Hook } from "#services/legacy/hook";
import type { ValidParameter } from "#services/legacy/query/db-query-valid-params";
import type { BlStorageHandler } from "#services/storage_service";
import type { UserPermission } from "#shared/user-permission";
import type { Operation } from "#types/operation";

export interface BlCollection {
  storage: BlStorageHandler;
  endpoints: BlEndpoint[]; //a list of the valid endpoints for this collection;
}

export interface BlEndpointRestriction {
  permission: UserPermission; // The minimum permission the user needs
}

export interface BlEndpointOperation {
  name: string;
  operation: Operation;
  restriction?: BlEndpointRestriction;
}

export type BlEndpointMethod = "getAll" | "getId" | "post" | "patch" | "delete";

export interface BlEndpoint {
  method: BlEndpointMethod;
  hook?: Hook; //an optional hook for this endpoint
  validQueryParams?: ValidParameter[];
  restriction?: BlEndpointRestriction; // omit for public access
  operations?: BlEndpointOperation[];
  /**
   * Only register the operations of this endpoint, not the plain method route itself
   * (e.g. `POST /customeritems/generate-report` without `POST /customeritems`).
   */
  operationsOnly?: boolean;
}
