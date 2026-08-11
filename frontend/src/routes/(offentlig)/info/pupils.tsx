import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/pupils")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("vgs_elever"));
  },
  head: () => ({
    meta: [
      { title: "For VGS-elever | Boklisten.no" },
      {
        description:
          "Er du videregående-elev? Finn dine kontaktelever og når utdeling og innsamling skjer.",
      },
    ],
  }),
  component: PupilsPage,
});

function PupilsPage() {
  return <EditableTextReadOnly dataKey={"vgs_elever"} />;
}
