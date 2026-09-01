import type { HttpContext } from "@adonisjs/core/http";
import router from "@adonisjs/core/services/router";

import BlResponseHandler from "#services/legacy/bl-response.handler";
import CollectionEndpointAuth from "#services/legacy/collection-endpoint/collection-endpoint-auth";
import CollectionEndpointHandler from "#services/legacy/collection-endpoint/collection-endpoint-handler";
import CollectionEndpointOperation from "#services/legacy/collection-endpoint/collection-endpoint-operation";
import type { BlStorageData } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BlapiResponse } from "#shared/blapi-response";
import type { BlApiRequest } from "#types/bl-api-request";
import type { BlCollection, BlEndpoint } from "#types/bl-collection";

function createRequestHandler(
  endpoint: BlEndpoint,
  collection: BlCollection,
  onRequest: (blApiRequest: BlApiRequest) => Promise<BlStorageData>,
  checkDocumentPermission: boolean,
) {
  return async function handleRequest(ctx: HttpContext) {
    try {
      const accessToken = await CollectionEndpointAuth.authenticate(endpoint.restriction, ctx);

      const responseData = await CollectionEndpointHandler.handleEndpointRequest({
        endpoint,
        collection,
        accessToken,
        requestData: ctx.request.body(),
        documentId: ctx.request.params()["id"],
        query: ctx.request.qs(),
        checkDocumentPermission,
        onRequest,
      });

      return new BlapiResponse(responseData);
    } catch (error) {
      return BlResponseHandler.createErrorResponse(ctx, error);
    }
  };
}

function create(endpoint: BlEndpoint, collection: BlCollection) {
  const collectionUri = `/${collection.storage.path}`;
  let onRequest: (blApiRequest: BlApiRequest) => Promise<BlStorageData>;
  let checkDocumentPermission = false;
  let uri = collectionUri;
  let createRoute: (path: string, handler: (ctx: HttpContext) => void) => void;
  const routeName = `collection.${collection.storage.path}.${endpoint.method}`;

  switch (endpoint.method) {
    case "getAll": {
      createRoute = (path, handler) => router.get(path, handler).as(routeName);
      onRequest = CollectionEndpointHandler.onGetAll(collection, endpoint);
      break;
    }
    case "getId": {
      uri += "/:id";
      createRoute = (path, handler) =>
        router.get(path, handler).as(`collection.${collection.storage.path}.getId`);
      onRequest = CollectionEndpointHandler.onGetId(collection);
      break;
    }
    case "post": {
      createRoute = (path, handler) => router.post(path, handler).as(routeName);
      onRequest = CollectionEndpointHandler.onPost(collection);
      break;
    }
    case "patch": {
      uri += "/:id";
      createRoute = (path, handler) => router.patch(path, handler).as(routeName);
      onRequest = CollectionEndpointHandler.onPatch(collection);
      checkDocumentPermission = true;
      break;
    }
    case "delete": {
      uri += "/:id";
      createRoute = (path, handler) => router.delete(path, handler).as(routeName);
      onRequest = CollectionEndpointHandler.onDelete(collection);
      checkDocumentPermission = true;
      break;
    }
    case "put": {
      uri += "/:id";
      createRoute = (path, handler) => router.put(path, handler).as(routeName);
      onRequest = CollectionEndpointHandler.onPut(collection);
      checkDocumentPermission = true;
      break;
    }
    default: {
      throw new BlError(`the endpoint method "${endpoint.method}" is not supported`);
    }
  }

  createRoute(uri, createRequestHandler(endpoint, collection, onRequest, checkDocumentPermission));

  if (endpoint.operations) {
    for (const operation of endpoint.operations) {
      CollectionEndpointOperation.create(collection.storage.path, endpoint.method, operation);
    }
  }
}

const CollectionEndpoint = {
  create,
};
export default CollectionEndpoint;
