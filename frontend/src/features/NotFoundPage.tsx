import PublicLayout from "@/features/PublicLayout";
import { Stack } from "@mantine/core";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";

export default function NotFoundPage() {
  return (
    <PublicLayout padding="md" withBorder>
      <Stack>
        <ErrorAlert title="Denne siden finnes ikke">
          Lenken du har skrevet inn er ikke gyldig. Ta kontakt på teknisk@boklisten.no dersom du har
          spørsmål.
        </ErrorAlert>
      </Stack>
    </PublicLayout>
  );
}
