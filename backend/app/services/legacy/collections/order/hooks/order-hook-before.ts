import { isNullish } from "#services/legacy/typescript-helpers";
import { BlError } from "#shared/bl-error";

export class OrderHookBefore {
  validate(requestJsonBody: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (Object.prototype.toString.call(requestJsonBody) === "[object Array]") {
        return reject(
          new BlError("request is an array but should be a object")
            .store("requestBody", requestJsonBody)
            .code(701),
        );
      }

      try {
        this.checkMinimumRequiredFields(requestJsonBody);
      } catch (error) {
        if (error instanceof BlError) {
          reject(new BlError("the request body is not valid").add(error).code(701));
        } else {
          reject(
            new BlError("unkown error, request body is not valid").store("error", error).code(701),
          );
        }
        return;
      }

      resolve(true);
    });
  }

  private checkMinimumRequiredFields(requestBody: any): boolean {
    if (isNullish(requestBody["amount"])) {
      throw new BlError("required field amount in order is not specified");
    }

    if (!requestBody["orderItems"]) {
      throw new BlError("required field orderItems in order is not specified");
    }

    return true;
  }
}
