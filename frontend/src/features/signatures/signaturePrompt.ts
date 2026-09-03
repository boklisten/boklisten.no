/** The sentence above the signature box: who is signing, and for whom. */
export function signaturePrompt(name: string, isUnderage: boolean): string {
  return `Signer her på at du er${isUnderage ? " foresatt til" : ""} ${name} og godkjenner betingelsene${isUnderage ? " på hans eller hennes vegne" : ""}:`;
}
