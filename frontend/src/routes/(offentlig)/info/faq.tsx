import { Title, Stack } from "@mantine/core";
import QuestionsAndAnswersReadOnly, {
  questionsAndAnswersQueryOptions,
} from "@/features/questions-and-answers/QuestionsAndAnswersReadOnly";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/faq")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(questionsAndAnswersQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Spørsmål og svar | Boklisten.no" },
      {
        description:
          "Hva betyr det at Boklisten alltid leverer riktig bok? Hvordan bestiller jeg bøker som privatist?",
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <Stack>
      <Title ta={"center"}>Spørsmål og svar</Title>
      <QuestionsAndAnswersReadOnly />
    </Stack>
  );
}
