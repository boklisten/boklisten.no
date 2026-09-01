import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/policies/terms")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("vilkaar"));
  },
  head: () =>
    seo({
      title: "Vilkår | Boklisten.no",
      description:
        "Vilkårene for kjøp og lån av bøker hos Boklisten: priser, 14 dagers angrerett, avbestilling, levering på stand eller i posten, betaling og reklamasjon.",
    }),
  component: TermsPage,
});

function TermsPage() {
  return <EditableTextReadOnly dataKey="vilkaar" />;
}
