import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/companies")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("for_skolekunder"));
  },
  head: () => ({
    meta: [
      { title: "For skolekunder | Boklisten.no" },
      {
        description:
          "Er du ansvarlig for en videregående eller privatist-skole? Vi tilbyr en rekke nyttige tjenester til dere! Les om våre tilbud til skoler, hvordan utlånsordningen fungrer og hvordan dere kan kjøpe bøker fra skyvearkivet.",
      },
    ],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  return <EditableTextReadOnly dataKey={"for_skolekunder"} />;
}
