import { createFileRoute } from "@tanstack/react-router";

import AuthGuard from "@/features/auth/AuthGuard";
import SignatureGallery from "@/features/signatures/SignatureGallery";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/database/signaturer")({
  head: () =>
    seo({
      title: "Signaturer | bl-admin",
    }),
  component: DatabaseSignaturesPage,
});

function DatabaseSignaturesPage() {
  return (
    <AuthGuard requiredPermission="admin">
      <SignatureGallery />
    </AuthGuard>
  );
}
