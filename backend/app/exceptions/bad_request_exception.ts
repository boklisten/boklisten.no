import { Exception } from "@adonisjs/core/exceptions";

export default class BadRequestException extends Exception {
  constructor(message = "The request is invalid.") {
    super(message, { status: 400, code: "E_BAD_REQUEST_EXCEPTION" });
  }
}
