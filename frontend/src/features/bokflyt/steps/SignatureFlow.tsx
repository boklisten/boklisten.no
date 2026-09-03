import { Button, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconChecks } from "@tabler/icons-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import classes from "@/features/bokflyt/bokflyt.module.css";
import PhoneFrame from "@/features/bokflyt/PhoneFrame";
import { useTimedPlayback } from "@/features/bokflyt/useTimedPlayback";
import type { PlaybackStep } from "@/features/bokflyt/useTimedPlayback";
import ReplayButton from "@/features/bokflyt/ReplayButton";
import { signaturePrompt } from "@/features/signatures/signaturePrompt";
import SignedContractDetails from "@/features/signatures/SignedContractDetails";
import { SIGNATURE_BOX_STYLE } from "@/shared/components/form/fields/complex/SignatureCanvasField";

type Stage = "sms" | "sign" | "done";

const STAGES: PlaybackStep<Stage>[] = [
  { at: 2600, value: "sign" },
  { at: 5800, value: "done" },
];

const STUDENT = "Ronja Røverdatter";
const GUARDIAN = "Lovis Røver";

/** A loose cursive scrawl, drawn stroke by stroke inside the signature box. */
const SIGNATURE_PATH =
  "M 28 68 C 30 40 36 26 40 22 C 44 30 38 56 34 70 C 40 56 52 46 60 50 C 54 60 48 70 58 66 C 68 60 72 50 80 48 C 90 46 84 66 92 62 C 100 56 104 44 112 46 C 118 50 110 66 120 62 C 130 56 136 48 146 46 C 160 44 150 70 166 62 C 178 54 186 42 196 44 C 206 48 198 64 212 60 C 226 54 236 46 250 50 C 262 56 258 70 272 60";

function SmsStage() {
  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed" ta="center">
        Boklisten
      </Text>
      <div className={classes.smsThread}>
        <motion.div
          className={classes.smsBubble}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Hei. {STUDENT} skal snart motta bøker fra skolen via Boklisten.no. Siden Ronja er under 18
          år, krever vi at du som foresatt signerer låneavtalen.
        </motion.div>
        <motion.div
          className={classes.smsBubble}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1 }}
        >
          Vi har sendt en e-post til deg med lenke til signering. Mvh. Boklisten
        </motion.div>
      </div>
    </Stack>
  );
}

/** The signing form as the guardian sees it, with the signature being drawn. */
function SignStage({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <Stack gap="sm">
      <Title order={4}>Signer låneavtalen</Title>
      <Text size="sm" fw={500}>
        {signaturePrompt(STUDENT, true)}
      </Text>
      <div style={SIGNATURE_BOX_STYLE}>
        <svg
          className={classes.signatureStroke}
          viewBox="0 0 300 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <motion.path
            d={SIGNATURE_PATH}
            fill="none"
            stroke="#111"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.9, delay: 0.5, ease: "easeInOut" }}
          />
        </svg>
      </div>
      <TextInput label="Fullt navn (foresatt)" value={GUARDIAN} readOnly />
      <Button leftSection={<IconChecks />} color="green">
        Signer
      </Button>
    </Stack>
  );
}

function DoneStage() {
  return (
    <Stack gap="sm">
      <Title order={4}>Signer låneavtalen</Title>
      <SignedContractDetails
        signedByGuardian
        signingName={GUARDIAN}
        name={STUDENT}
        signedAtText="16. juni 2026"
        expiresAtText="16. juni 2027"
      />
    </Stack>
  );
}

/**
 * The guardian's side of signing: the SMS arrives, the agreement is signed
 * on the phone, and the confirmation is the real one from the product.
 */
export default function SignatureFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion() ?? false;
  const { value: stage, replay } = useTimedPlayback<Stage>("sms", STAGES, inView && !reduceMotion);

  const shownStage: Stage = reduceMotion ? "done" : stage;

  return (
    <Stack gap="sm" ref={ref} align="center">
      <PhoneFrame label="Foresatt får SMS, signerer låneavtalen på mobilen og får bekreftelse">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={shownStage}
            initial={reduceMotion ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.35 }}
          >
            {shownStage === "sms" && <SmsStage />}
            {shownStage === "sign" && <SignStage reduceMotion={reduceMotion} />}
            {shownStage === "done" && <DoneStage />}
          </motion.div>
        </AnimatePresence>
      </PhoneFrame>
      {!reduceMotion && <ReplayButton onClick={replay} />}
    </Stack>
  );
}
