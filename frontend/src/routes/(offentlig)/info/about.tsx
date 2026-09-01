import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/about")({
  loader: async ({ context }) => {
    await context.queryClient.query({ ...editableTextQueryOptions("om_oss"), staleTime: "static" });
  },
  head: () =>
    seo({
      title: "Om oss | Boklisten.no",
      description:
        "Boklisten.no, tidligere Søraas Bok, har kjøpt og solgt skolebøker siden 1990. Les om historien vår, hvem vi er, og hva vi gjør i dag.",
    }),
  component: AboutPage,
});

function AboutPage() {
  return <EditableTextReadOnly dataKey="om_oss" />;
}
