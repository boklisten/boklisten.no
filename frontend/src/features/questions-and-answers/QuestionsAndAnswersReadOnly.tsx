import {
  Accordion,
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Skeleton,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import RichTextEditorReadOnly from "@/shared/components/RichTextEditorReadOnly";
import { publicApi } from "@/shared/utils/publicApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

export const questionsAndAnswersQueryOptions = () =>
  publicApi.questionsAndAnswers.getAll.queryOptions();

export default function QuestionsAndAnswersReadOnly() {
  const { data, isLoading } = useQuery(questionsAndAnswersQueryOptions());

  if (isLoading && data === undefined) {
    return (
      <>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((id) => (
          <Skeleton height={45} key={`Skeleton-${id}`} />
        ))}
      </>
    );
  }
  if (data === undefined) {
    return (
      <ErrorAlert title={"Klarte ikke laste inn spørsmål og svar"}>
        {PLEASE_TRY_AGAIN_TEXT}
      </ErrorAlert>
    );
  }

  return (
    <>
      <Activity mode={data.length === 0 ? "visible" : "hidden"}>
        <InfoAlert>Ingen spørsmål og svar er publisert enda</InfoAlert>
      </Activity>
      <Accordion keepMounted keepMountedMode={"display-none"}>
        {data.map((questionAndAnswer) => (
          <AccordionItem key={questionAndAnswer.id} value={questionAndAnswer.id}>
            <AccordionControl>
              <RichTextEditorReadOnly content={questionAndAnswer.question} />
            </AccordionControl>
            <AccordionPanel>
              <RichTextEditorReadOnly content={questionAndAnswer.answer} />
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
