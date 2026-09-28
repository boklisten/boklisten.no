/**
 * What a customer who has turned 18 is told about the guardian signature they have outgrown.
 * Shared by every customer-facing signature page so the wording never drifts.
 */
export const OUTGROWN_SIGNATURE_TITLE = "Du har fylt 18 år og må signere selv";

export function describeOutgrownSignature({
  signingName,
  signedAtText,
}: {
  signingName: string;
  signedAtText: string;
}): string {
  return `${signingName} (foresatt) signerte låneavtalen på dine vegne ${signedAtText}. Nå som du er myndig, må du signere låneavtalen selv.`;
}
