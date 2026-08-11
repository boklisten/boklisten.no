import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/policies/conditions")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("betingelser"));
  },
  head: () => ({
    meta: [
      { title: "Betingelser | Boklisten.no" },
      {
        description:
          "Vi tar kundene våre på alvor. Derfor har vi laget detaljerte betingelser, slik at du vet hva som gjelder for din ordre.",
      },
    ],
  }),
  component: ConditionsPage,
});

function ConditionsPage() {
  return <EditableTextReadOnly dataKey={"betingelser"} />;
}
