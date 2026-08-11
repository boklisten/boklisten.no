import { Title, Stack } from "@mantine/core";
import QuestionsAndAnswersReadOnly, {
  questionsAndAnswersQueryOptions,
} from "@/features/questions-and-answers/QuestionsAndAnswersReadOnly";
import { createFileRoute } from "@tanstack/react-router";
import { jsonLdScript, seo } from "@/shared/utils/seo";
import { faqPageSchema } from "@/shared/utils/structuredData";

export const Route = createFileRoute("/(offentlig)/info/faq")({
  loader: async ({ context }) =>
    await context.queryClient.ensureQueryData(questionsAndAnswersQueryOptions()),
  head: (ctx) => ({
    ...seo({
      title: "Spørsmål og svar om kjøp og lån av pensumbøker | Boklisten.no",
      description:
        "Svar på de vanligste spørsmålene om Boklisten: hvordan du bestiller pensumbøker, hvordan du betaler, når du henter og leverer, hva som skjer med skadde bøker, og hvordan tilbakekjøp fungerer.",
    }),
    scripts: ctx.loaderData?.length ? [jsonLdScript(faqPageSchema(ctx.loaderData))] : [],
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
