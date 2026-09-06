import type { JwtPayload } from "jsonwebtoken";
import type { ParsedQs } from "qs";

import { Hook } from "#services/legacy/hook";
import type { SEDbQuery } from "#models/mongoose/storage/db-query";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { isBoolean, isNotNullish } from "#services/typescript_helpers";
import type { BlStorageData } from "#services/storage_service";
import type { BlDocument } from "#shared/bl-document";
import { BlError } from "#shared/bl-error";
import { parsePermission } from "#shared/user-permission";
import type { BlApiRequest } from "#types/bl-api-request";
import type { BlCollection, BlEndpoint } from "#types/bl-collection";

function onGetAll(collection: BlCollection, endpoint: BlEndpoint) {
  return async function onRequest(blApiRequest: BlApiRequest) {
    if (
      blApiRequest.query &&
      Object.getOwnPropertyNames(blApiRequest.query).length > 0 &&
      endpoint.validQueryParams
    ) {
      // if the request includes a query

      const databaseQueryBuilder = new SEDbQueryBuilder();
      let databaseQuery: SEDbQuery;

      try {
        databaseQuery = databaseQueryBuilder.getDbQuery(
          blApiRequest.query,
          endpoint.validQueryParams,
        );
      } catch (error) {
        throw (
          new BlError("could not create query from request query string")

            // @ts-expect-error fixme: auto ignored
            .add(error)
            .store("query", blApiRequest.query)
            .code(701)
        );
      }

      return collection.storage.getByQuery(databaseQuery);
    }
    // if no query, give back all objects in collection
    let permission = undefined;
    if (blApiRequest.user) {
      permission = blApiRequest.user.permission;
    }

    return collection.storage
      .getAll(permission)
      .then((docs) => docs)
      .catch((blError: BlError) => {
        throw blError;
      });
  };
}

function onGetId(collection: BlCollection) {
  return async function onRequest(blApiRequest: BlApiRequest) {
    const doc = await collection.storage.get(blApiRequest.documentId);
    return [doc];
  };
}

function onPost(collection: BlCollection) {
  return async function onRequest(blApiRequest: BlApiRequest) {
    if (blApiRequest.data == null) {
      throw new BlError("data is required for post operations").code(701);
    }

    try {
      return [
        // @ts-expect-error fixme bad typing
        await collection.storage.add(blApiRequest.data, blApiRequest.user),
      ];
    } catch (blError) {
      throw new BlError("could not add document").add(
        blError instanceof BlError ? blError : new BlError(String(blError)),
      );
    }
  };
}

function onPatch(collection: BlCollection) {
  return async function onRequest(blApiRequest: BlApiRequest) {
    const doc = await collection.storage
      // @ts-expect-error fixme: auto ignored
      .update(blApiRequest.documentId, blApiRequest.data);
    return [doc];
  };
}

function onDelete(collection: BlCollection) {
  return async function onRequest(blApiRequest: BlApiRequest) {
    const doc = await collection.storage
      // @ts-expect-error fixme: auto ignored
      .remove(blApiRequest.documentId, {
        // @ts-expect-error fixme: auto ignored
        id: blApiRequest.user.id,
        // @ts-expect-error fixme: auto ignored
        permission: blApiRequest.user.permission,
      });
    return [doc];
  };
}

async function handleEndpointRequest({
  endpoint,
  accessToken,
  requestData,
  documentId,
  query,
  onRequest,
}: {
  endpoint: BlEndpoint;
  accessToken: JwtPayload | undefined;
  requestData: unknown;
  documentId: string | undefined;
  query: ParsedQs;
  onRequest: (blApiRequest: BlApiRequest) => Promise<BlStorageData>;
}): Promise<BlDocument[]> {
  const hook = endpoint.hook ?? new Hook();
  const beforeData = await hook.before(requestData, accessToken, documentId, query);

  const blApiRequest = {
    documentId,
    query,
    data: isNotNullish(beforeData) && !isBoolean(beforeData) ? beforeData : requestData,
    user: accessToken
      ? {
          id: accessToken.sub ?? "",
          details: String(accessToken["details"] ?? ""),
          permission: parsePermission(accessToken["permission"]),
        }
      : undefined,
  };

  const responseData = await onRequest(blApiRequest);

  return hook.after(responseData, accessToken);
}

const CollectionEndpointHandler = {
  onGetAll,
  onGetId,
  onPost,
  onPatch,
  onDelete,
  handleEndpointRequest,
};
export default CollectionEndpointHandler;
