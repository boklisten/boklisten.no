import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/policies/privacy")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("personvernavtale"));
  },
  head: () =>
    seo({
      title: "Personvernavtale | Boklisten.no",
      description:
        "Slik behandler Boklisten personopplysningene dine: hvilke opplysninger vi lagrer, hva de brukes til, hvem vi deler dem med, og hvilke rettigheter du har.",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <EditableTextReadOnly dataKey={"personvernavtale"} />;
}
