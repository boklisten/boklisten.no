import { Exception } from "@adonisjs/core/exceptions";

/**
 * Nothing to show for the id the caller asked about (404): it is unknown, or outside their scope
 * of the branch tree, which must look exactly the same so nothing leaks.
 */
export default class NotFoundException extends Exception {
  constructor(message = "Fant ikke det du lette etter") {
    super(message, { status: 404, code: "E_ROW_NOT_FOUND" });
  }
}
