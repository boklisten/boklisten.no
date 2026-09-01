import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/pupils")({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...editableTextQueryOptions("vgs_elever"),
      staleTime: "static",
    });
  },
  head: () =>
    seo({
      title: "For VGS-elever | Boklisten.no",
      description:
        "Er du elev ved en videregående skole og trenger bøker utenom hovedutdelingsdagene? Her finner du kontaktelevene ved skolen din.",
    }),
  component: PupilsPage,
});

function PupilsPage() {
  return <EditableTextReadOnly dataKey="vgs_elever" />;
}
