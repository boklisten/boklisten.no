import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/policies/conditions")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("betingelser"));
  },
  head: () =>
    seo({
      title: "Betingelser | Boklisten.no",
      description:
        "Betingelsene for utlån til elever i videregående skole og for avdragskjøp for privatister: betalings- og leveringsfrister, og hva som gjelder ved tapte eller ødelagte bøker.",
    }),
  component: ConditionsPage,
});

function ConditionsPage() {
  return <EditableTextReadOnly dataKey="betingelser" />;
}
