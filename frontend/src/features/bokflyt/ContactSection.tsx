import { Button, Container, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import SectionHeading from "@/features/bokflyt/SectionHeading";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import { showErrorNotification } from "@/shared/utils/notifications";
import { publicApi } from "@/shared/utils/publicApiClient";

function ContactForm({ onSent }: { onSent: () => void }) {
  const sendMutation = useMutation(
    publicApi.bokflyt.contact.mutationOptions({
      onSuccess: onSent,
      onError: () => showErrorNotification("Klarte ikke å sende henvendelsen"),
    }),
  );
  const form = useAppForm({
    defaultValues: { name: "", school: "", email: "", phone: "", message: "" },
    onSubmit: ({ value }) => sendMutation.mutateAsync({ body: value }),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Stack gap="sm">
        <form.AppField
          name="name"
          validators={{ onSubmit: ({ value }) => nameFieldValidator(value, "personal") }}
        >
          {(field) => <field.NameField label="Ditt navn" placeholder="Kari Nordmann" />}
        </form.AppField>
        <form.AppField
          name="school"
          validators={{
            onSubmit: ({ value }) =>
              value.trim().length < 2 ? "Du må fylle inn navnet på skolen" : null,
          }}
        >
          {(field) => (
            <field.TextField
              required
              label="Skole"
              placeholder="Eksempel videregående skole"
              autoComplete="organization"
            />
          )}
        </form.AppField>
        <form.AppField
          name="email"
          validators={{ onSubmit: ({ value }) => emailFieldValidator(value, "personal") }}
        >
          {(field) => <field.EmailField placeholder="kari.nordmann@skolen.no" />}
        </form.AppField>
        <form.AppField
          name="phone"
          validators={{ onSubmit: ({ value }) => phoneNumberFieldValidator(value, "personal") }}
        >
          {(field) => <field.PhoneNumberField />}
        </form.AppField>
        <form.AppField name="message">
          {(field) => (
            <field.TextAreaField
              label="Melding"
              placeholder="Fortell gjerne kort om skolen: antall elever, dagens ordning og når dere ønsker å starte."
              autosize
              minRows={3}
            />
          )}
        </form.AppField>
        <Button
          type="submit"
          size="md"
          radius="xl"
          color={BOKFLYT_COLORS.deep}
          leftSection={<IconSend size={18} />}
          loading={sendMutation.isPending}
        >
          Send henvendelse
        </Button>
      </Stack>
    </form>
  );
}

export default function ContactSection() {
  const [sent, setSent] = useState(false);

  return (
    <section className={`${classes.section} ${classes.wash}`} id="kontakt">
      <Container size="lg">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "xl", md: 64 }}>
          <Stack gap="md">
            <SectionHeading
              title="Avtal en uforpliktende prat"
              lead="Fortell oss kort om skolen deres, så tar vi kontakt. Vi kommer gjerne innom for å vise løsningen, svare på spørsmål og gi et konkret tilbud."
            />
            <Text c="dimmed">
              Vil dere heller ringe eller sende en e-post? Kontaktinformasjonen vår står nederst på
              siden.
            </Text>
          </Stack>
          <div className={classes.formCard}>
            {sent ? (
              <SuccessAlert title="Takk for henvendelsen">
                Vi tar kontakt på e-post eller telefon i løpet av kort tid.
              </SuccessAlert>
            ) : (
              <ContactForm onSent={() => setSent(true)} />
            )}
          </div>
        </SimpleGrid>
      </Container>
    </section>
  );
}
