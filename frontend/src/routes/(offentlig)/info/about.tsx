import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/about")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("om_oss"));
  },
  head: () => ({
    meta: [
      { title: "Om oss | Boklisten.no" },
      {
        description:
          "Boklisten har mange års erfaring med kjøp og salg av pensumbøker. Les om vår historie, hvem vi er, og hva vi tilbyr.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return <EditableTextReadOnly dataKey={"om_oss"} />;
}
