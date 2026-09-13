import { Box, Stack } from "@mantine/core";
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
  name: string;
}) {
  return (
    <Stack align="center">
      <Box style={{ border: "1px solid #ccc", borderRadius: 2, padding: 1 }}>
        <Image
          src={`data:image/webp;base64,${signature.image ?? ""}`}
          alt="Signatur"
          width={300}
          height={100}
        />
      </Box>
      <SignedContractDetails
        signedByGuardian={signature.signedByGuardian ?? false}
        signingName={signature.signingName ?? ""}
        name={name}
        signedAtText={signature.signedAtText ?? ""}
        expiresAtText={signature.expiresAtText ?? ""}
      />
    </Stack>
  );
}
