import { Title } from "@mantine/core";
import ContactInfo from "@/shared/components/ContactInfo";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/contact")({
  head: () =>
    seo({
      title: "Kontakt oss | Boklisten.no",
      description:
        "Vi svarer på spørsmål både på e-post og telefon. Her finner du e-postadresse, telefonnummer og postadresse.",
    }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <>
      <Title ta={"center"} order={2}>
        Kontakt oss
      </Title>
      <ContactInfo />
    </>
  );
}
