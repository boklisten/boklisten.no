import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/policies/terms")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("vilkaar"));
  },
  head: () => ({
    meta: [
      { title: "Vilkår | Boklisten.no" },
      {
        description:
          "Når du handler hos oss gjelder noen vilkår. Disse er her for å gi alle parter trygghet for hvilke regler som gjelder.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <EditableTextReadOnly dataKey={"vilkaar"} />;
}
