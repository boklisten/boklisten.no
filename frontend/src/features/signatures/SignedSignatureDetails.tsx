import { Paper, Stack } from "@mantine/core";
import { Image } from "@unpic/react";

import SignedContractDetails from "@/features/signatures/SignedContractDetails";

/** A valid signature as the customer or employee sees it: the drawn signature above the details. */
export default function SignedSignatureDetails({
  signature,
  name,
}: {
  signature: {
    image?: string | undefined;
    signedByGuardian?: boolean | undefined;
    signingName?: string | undefined;
    signedAtText?: string | undefined;
    expiresAtText?: string | undefined;
  };
  /** The customer's name, which the details refer to. */
  name: string | null;
}) {
  return (
    <Stack align="center">
      {/* Ink is drawn for paper, so the frame stays white in dark mode too */}
      <Paper withBorder radius="xs" p={1} bg="white">
        <Image
          src={`data:image/webp;base64,${signature.image ?? ""}`}
          alt="Signatur"
          width={300}
          height={100}
        />
      </Paper>
      <SignedContractDetails
        signedByGuardian={signature.signedByGuardian ?? false}
        signingName={signature.signingName ?? ""}
        // A customer without a name on file is referred to by the name they signed with.
        name={name ?? signature.signingName ?? ""}
        signedAtText={signature.signedAtText ?? ""}
        expiresAtText={signature.expiresAtText ?? ""}
      />
    </Stack>
  );
}
