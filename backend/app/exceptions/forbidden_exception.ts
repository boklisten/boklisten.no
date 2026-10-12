import { Exception } from "@adonisjs/core/exceptions";

/** The caller is logged in but their level does not allow this (403), with a message for the UI. */
export default class ForbiddenException extends Exception {
  constructor(message = "Du har ikke tilgang til å gjøre dette.") {
    super(message, { status: 403, code: "E_FORBIDDEN" });
  }
}
