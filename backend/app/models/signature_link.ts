import { SignatureLinkSchema } from "#database/schema";

/** A customer's live signing link, found by its token's hash (see `SignatureLinkService`). */
export default class SignatureLink extends SignatureLinkSchema {}
