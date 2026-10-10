import PublicLayout from "@/features/PublicLayout";
import { Container } from "@mantine/core";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";

export default function NotFoundPage() {
  return (
    <PublicLayout padding="md">
      <Container>
        <ErrorAlert title="Denne siden finnes ikke">
          Lenken du har skrevet inn er ikke gyldig. Ta kontakt på teknisk@boklisten.no dersom du har
          spørsmål.
        </ErrorAlert>
      </Container>
    </PublicLayout>
  );
}
