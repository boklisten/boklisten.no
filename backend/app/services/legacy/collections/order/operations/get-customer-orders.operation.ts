import { ObjectId } from "mongodb";

import { StorageService } from "#services/storage_service";
import { BlapiResponse } from "#shared/blapi-response";
import type { BlApiRequest } from "#types/bl-api-request";
import type { Operation } from "#types/operation";

export class GetCustomerOrdersOperation implements Operation {
  async run(blApiRequest: BlApiRequest) {
    const customerOrders = await StorageService.Orders.aggregate([
      {
        $match: {
          customer: new ObjectId(blApiRequest.documentId),
          placed: true,
          byCustomer: true,
        },
      },
    ]);

    return new BlapiResponse([customerOrders]);
  }
}
