import type { BlapiResponse } from "#shared/blapi-response";
import type { BlApiRequest } from "#types/bl-api-request";

export interface Operation {
  run: (blApiRequest: BlApiRequest) => Promise<BlapiResponse>;
}
