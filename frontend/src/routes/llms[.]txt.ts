import { CONTACT_INFO, ORGANIZATION_NUMBER } from "@/shared/utils/constants";
import { SITE_URL } from "@/shared/utils/seo";
import { createFileRoute } from "@tanstack/react-router";

/**
 * A short, curated description of Boklisten for AI assistants, in the
 * `llms.txt` convention: what we are, who we serve, and where the real pages
 * are. Deliberately hand-written rather than generated from the CMS — its value
 * is being a correct summary someone stands behind, not a content dump.
 *
 * Keep this in sync when what Boklisten offers changes.
 */
const llmsTxt = `# Boklisten.no

> Boklisten.no formidler pensumbøker til elever i videregående skole og til privatister. Elever låner bøker gjennom skolens utlånsordning, privatister kjøper bøkene og kan få dem kjøpt tilbake når de er ferdige, og skoler får administrert hele utlånsordningen sin.

## Om selskapet

- Navn: Boklisten.no AS
- Tidligere navn: Søraas Bok
- Startet: 1990, med kjøp og salg av bøker til elever i videregående skole i Oslo og Akershus
- Organisasjonsnummer: ${ORGANIZATION_NUMBER}
- Adresse: ${CONTACT_INFO.address}
- E-post: ${CONTACT_INFO.email}
- Telefon: ${CONTACT_INFO.phone}
- Nettsted: ${SITE_URL}
- Språk: norsk (bokmål)
- Marked: Norge

## Hvem tjenesten er for

Elever i videregående skole: Bøkene lånes gjennom skolens utlånsordning. Eleven bestiller i nettbutikken, signerer en kontrakt (foresatte signerer også dersom eleven er under 18 år), henter bøkene på utdelingsdagene ved skolen, og leverer dem tilbake ved innsamling. Bøkene kjøpes ikke, de lånes.

Privatister: Bøkene kjøpes, og du kan betale i avdrag. Da betaler du litt over halvparten ved bestilling, og restbeløpet på det oppgitte tidspunktet – enten på nett eller ved bokinnkjøpsstanden på skolen din på slutten av semesteret. Boken er din når restbeløpet er betalt.

Mange privatister ønsker å selge bøkene sine på slutten av semesteret og Boklisten kjøper inn bøker fra privatister.
Hvis du selger boken din til Boklisten vil vi vanligvis betale det samme som restbeløpet eller mer.

Skoler: Boklisten administrerer skolens utlånsordning, selger nye og brukte lærebøker, henter inn utgåtte bøker for resirkulering (kun på Østlandet), og selger rimelige utgåtte lærebøker fra skyvearkivet.

## Slik fungerer tjenesten

1. Velg: Du lager en bruker, velger skolen du går på og fagene du tar. Boklisten finner bøkene som hører til fagene.
2. Hent: Bøkene hentes når Boklisten har stand på skolen din, eller sendes i posten. Ta med legitimasjon ved henting.
3. Les: Bøkene brukes gjennom semesteret.
4. Lever: Bøkene leveres tilbake på stand ved skolen eller sendes i posten innen fristen.

Det er 14 dagers angrerett fra du får boken, enten du bestiller på nett eller kjøper på stand.

Elever ved videregående skoler får beskjed fra skolen om når utdeling og innsamling skjer. Privatister finner åpningstidene for sin filial på nettsidene.

Frister, priser, avdragsordninger og gebyrer står i betingelsene og i spørsmål og svar, som er de gjeldende kildene.

## Sider

- [Generell informasjon](${SITE_URL}/info/general): hva Boklisten er og hvilke tjenester vi tilbyr.
- [Spørsmål og svar](${SITE_URL}/info/faq): svar på de vanligste spørsmålene om bestilling, henting, levering og tilbakekjøp.
- [Om oss](${SITE_URL}/info/about): Boklistens historie og hvem vi er.
- [For VGS-elever](${SITE_URL}/info/pupils): kontaktelever som hjelper med bøker utenom hovedutdelingsdagene.
- [For skolekunder](${SITE_URL}/info/companies): utlånsordning, bokhandel, innsamling og skyvearkiv for skoler.
- [Skoler og åpningstider](${SITE_URL}/info/branch): når Boklisten står på stand ved den enkelte skole.
- [Innkjøpsliste](${SITE_URL}/info/buyback): hvilke pensumbøker Boklisten kjøper inn.
- [Bestill bøker](${SITE_URL}/bestilling): start en bestilling ved å velge skole og fag.
- [Kontakt oss](${SITE_URL}/info/contact): kontaktinformasjon.

## Avtaler og betingelser

- [Betingelser](${SITE_URL}/info/policies/conditions): vilkårene for utlån til VGS-elever og for avdragskjøp for privatister, inkludert frister, pant, erstatning for tapte og ødelagte bøker, og gebyrer.
- [Vilkår](${SITE_URL}/info/policies/terms): priser, angrerett, avbestilling, levering på stand eller i posten, betaling og reklamasjon.
- [Personvernerklæring](${SITE_URL}/info/policies/privacy): hvilke personopplysninger som lagres, hva de brukes til, hvem de deles med, og hvilke rettigheter du har.
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(llmsTxt, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
