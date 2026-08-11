import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/general")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("generell_informasjon"));
  },
  head: () => ({
    meta: [
      { title: "Generell informasjon | Boklisten.no" },
      {
        description:
          "Velkommen til Boklisten.no! Her kan du enkelt kjøpe pensumbøker. Les om vårt konsept, og hvilke tjenester vi tilbyr her.",
      },
    ],
  }),
  component: GeneralInformationPage,
});

function GeneralInformationPage() {
  return <EditableTextReadOnly dataKey={"generell_informasjon"} />;
}
