import EditableTextReadOnly from "@/shared/components/EditableTextReadOnly";
import { api } from "@/shared/utils/apiClient";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/general")({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...api.editableTexts.show.queryOptions({ params: { id: "generell_informasjon" } }),
      staleTime: "static",
    });
  },
  head: () =>
    seo({
      title: "Generell informasjon | Boklisten.no",
      description:
        "Hos Boklisten kan du låne og kjøpe pensumbøker – bare mye enklere enn før. Les om hvordan tjenesten fungerer, og hva vi tilbyr elever, privatister og skoler.",
    }),
  component: GeneralInformationPage,
});

function GeneralInformationPage() {
  return <EditableTextReadOnly dataKey="generell_informasjon" />;
}
