import { CONTACT_INFO, ORGANIZATION_NUMBER, SOCIAL_PROFILE_URLS } from "@/shared/utils/constants";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/shared/utils/seo";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/**
 * Rich text from the CMS is HTML. Structured data has to be plain text, and
 * leaving markup in makes AI assistants quote tags back at people.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Boklisten.no AS",
    // The former name is kept so searches for it resolve to the same entity
    alternateName: [SITE_NAME, "Søraas Bok"],
    url: SITE_URL,
    logo: `${SITE_URL}/images/boklisten_logo_blue.png`,
    email: CONTACT_INFO.email,
    telephone: `+47${CONTACT_INFO.phone}`,
    vatID: `NO${ORGANIZATION_NUMBER}MVA`,
    taxID: ORGANIZATION_NUMBER,
    foundingDate: "1990",
    description:
      "Boklisten.no (tidligere Søraas Bok) startet i 1990 med kjøp og salg av bøker til elever i videregående skole i Oslo og Akershus. I dag administrerer vi utlånsordninger for skoler, selger brukte og nye lærebøker til videregående skoler og privatister, kjøper tilbake brukte bøker, og deler ut og samler inn bøker på stand ved skolene.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Postboks 8",
      postOfficeBoxNumber: "8",
      postalCode: CONTACT_INFO.postalCode,
      addressLocality: CONTACT_INFO.city,
      addressCountry: CONTACT_INFO.countryCode,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: CONTACT_INFO.email,
      telephone: `+47${CONTACT_INFO.phone}`,
      availableLanguage: ["no", "nb"],
    },
    areaServed: {
      "@type": "Country",
      name: "Norge",
    },
    knowsLanguage: ["nb-NO"],
    sameAs: SOCIAL_PROFILE_URLS,
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "nb-NO",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function faqPageSchema(
  questionsAndAnswers: ReadonlyArray<{ id: string; question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "nb-NO",
    publisher: { "@id": ORGANIZATION_ID },
    mainEntity: questionsAndAnswers.map((questionAndAnswer) => ({
      "@type": "Question",
      name: stripHtml(questionAndAnswer.question),
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(questionAndAnswer.answer),
      },
    })),
  };
}

export function branchSchema({
  branchName,
  address,
  pathname,
  openingHours,
}: {
  branchName: string;
  address: string | undefined;
  pathname: string;
  openingHours: ReadonlyArray<{
    id: string | number;
    from: Date | string | null;
    to: Date | string | null;
  }>;
}) {
  const url = absoluteUrl(pathname);
  const datedOpeningHours = openingHours.filter(
    (openingHour): openingHour is typeof openingHour & { from: Date | string; to: Date | string } =>
      openingHour.from !== null && openingHour.to !== null,
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Place",
        "@id": `${url}#place`,
        name: branchName,
        url,
        ...(address
          ? {
              address: {
                "@type": "PostalAddress",
                streetAddress: address,
                addressCountry: CONTACT_INFO.countryCode,
              },
            }
          : {}),
      },
      ...datedOpeningHours.map((openingHour) => ({
        "@type": "Event",
        "@id": `${url}#stand-${openingHour.id}`,
        name: `Boklisten på ${branchName}`,
        description: `Utdeling, innsamling og kjøp av pensumbøker på stand ved ${branchName}.`,
        startDate: new Date(openingHour.from).toISOString(),
        endDate: new Date(openingHour.to).toISOString(),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: { "@id": `${url}#place` },
        organizer: { "@id": ORGANIZATION_ID },
        url,
      })),
    ],
  };
}
