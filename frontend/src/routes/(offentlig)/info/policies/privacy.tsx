import EditableTextReadOnly, {
  editableTextQueryOptions,
} from "@/shared/components/EditableTextReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/policies/privacy")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(editableTextQueryOptions("personvernavtale"));
  },
  head: () => ({
    meta: [
      { title: "Personvernavtale | Boklisten.no" },
      {
        description:
          "Vi tar personvern på alvor. Derfor har vi laget et dokument som viser en oversikt over hvordan din data bir behandlet hos oss.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <EditableTextReadOnly dataKey={"personvernavtale"} />;
}
