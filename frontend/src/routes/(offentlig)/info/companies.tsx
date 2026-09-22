import EditableTextReadOnly from "@/shared/components/EditableTextReadOnly";
import { api } from "@/shared/utils/apiClient";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/companies")({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...api.editableTexts.show.queryOptions({ params: { id: "for_skolekunder" } }),
      staleTime: "static",
    });
  },
  head: () =>
    seo({
      title: "For skolekunder | Boklisten.no",
      description:
        "Boklisten administrerer skolens utlånsordning, selger nye og brukte lærebøker, henter inn utgåtte bøker og tilbyr rimelige lærebøker fra skyvearkivet.",
    }),
  component: CompaniesPage,
});

function CompaniesPage() {
  return <EditableTextReadOnly dataKey="for_skolekunder" />;
}
