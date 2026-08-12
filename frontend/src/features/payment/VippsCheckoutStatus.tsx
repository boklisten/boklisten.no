import { Button, Card, Loader, NavLink, Skeleton, Stack, Text, Title } from "@mantine/core";
import { IconBasket, IconBook, IconRefresh } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, useEffect, useEffectEvent, useState } from "react";

import OrderReceipt from "@/features/payment/OrderReceipt";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import useCart from "@/shared/hooks/useCart";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

function BackToCartButton() {
  return (
    <NavLink
      component={TanStackAnchor}
      to={"/handlekurv"}
      leftSection={<IconBasket />}
      active
      bdrs={5}
      bg={"green"}
      c={"white"}
      fw={"bolder"}
      label={"Gå til handlekurv"}
    />
  );
}

const calculateTotalWait = (attempts: number) => ((n) => (n * (n + 1) * (2 * n + 1)) / 6)(attempts);

export default function VippsCheckoutStatus({ orderId }: { orderId: string }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const cart = useCart();

  const MAX_ATTEMPTS = 5;
  const [attempt, setAttempt] = useState(1);
  const [secondsBeforeNextAttempt, setSecondsBeforeNextAttempt] = useState(0);

  const { data, isLoading, isError } = useQuery(
    api.checkout.pollPayment.queryOptions({ params: { orderId } }),
  );

  useEffect(() => {
    if (data !== "PaymentInitiated" || attempt > MAX_ATTEMPTS) return;
    function startExponentialWait() {
      const waitInSeconds = attempt ** 2;
      setSecondsBeforeNextAttempt(waitInSeconds);

      const interval = setInterval(() => {
        setSecondsBeforeNextAttempt((t) => +(t - 0.1).toFixed(1));
      }, 100);

      const timeout = setTimeout(async () => {
        clearInterval(interval);
        await queryClient.invalidateQueries({
          queryKey: api.checkout.pollPayment.queryKey({ params: { orderId } }),
        });
        setAttempt((a) => a + 1);
      }, waitInSeconds * 1000);
      return { interval, timeout };
    }

    const { interval, timeout } = startExponentialWait();
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [attempt, api, data, orderId, queryClient]);

  const onPaymentSuccessful = useEffectEvent(() => {
    cart.clear();
    // Ordering a loan makes the backend demand a signature, so refresh the tasks while the user
    // is still on the receipt; otherwise AuthGuard reads a pre-order cache and skips the signing
    // page when they move on
    void queryClient.invalidateQueries({
      queryKey: api.userDetail.getMyDetails.pathKey(),
    });
  });

  useEffect(() => {
    if (data === "PaymentSuccessful") {
      onPaymentSuccessful();
    }
  }, [data]);

  if (isLoading) {
    return <Skeleton h={90} />;
  }

  if (isError) {
    return (
      <ErrorAlert title={"Klarte ikke hente betalingsstatus"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  if (data === "PaymentInitiated") {
    return (
      <>
        <Activity mode={attempt <= MAX_ATTEMPTS ? "visible" : "hidden"}>
          <Card withBorder shadow={"md"}>
            <Stack>
              <Stack gap={5}>
                <Title order={3}>Prosesserer betaling...</Title>
                <Text fs={"italic"}>
                  Venter på betalingsstatus fra Vipps. Vennligst ikke lukk fanen.
                </Text>
              </Stack>
              <Activity mode={secondsBeforeNextAttempt < 1 ? "visible" : "hidden"}>
                <Loader type={"dots"} />
              </Activity>
              <Activity mode={secondsBeforeNextAttempt >= 1 ? "visible" : "hidden"}>
                <Text>Prøver igjen om {secondsBeforeNextAttempt.toFixed(0)} sekunder</Text>
              </Activity>
              <Text size={"sm"} fs={"italic"}>
                Forsøk {attempt} av {MAX_ATTEMPTS}
              </Text>
            </Stack>
          </Card>
        </Activity>

        <Activity mode={attempt > MAX_ATTEMPTS ? "visible" : "hidden"}>
          <ErrorAlert title={"Vipps bruke for lang tid på å svare"}>
            Vi mottok ikke oppdatert betalingsinformasjon etter å ha ventet i{" "}
            {calculateTotalWait(attempt)} sekunder. Du kan prøve igjen eller ta kontakt hvis
            problemet vedvarer.
          </ErrorAlert>
          <Button
            leftSection={<IconRefresh />}
            onClick={() => {
              setAttempt(1);
            }}
          >
            Prøv igjen
          </Button>
        </Activity>
      </>
    );
  }

  if (data === "PaymentSuccessful") {
    return (
      <>
        <Title order={2}>Kvittering</Title>
        <SuccessAlert title={"Din ordre er bekreftet!"}>
          Kvittering har blitt sendt på e-post. Du kan se dine nåværende bøker ved å trykke på{" "}
          {'"Dine bøker"'}
        </SuccessAlert>
        <OrderReceipt orderId={orderId} />
        <NavLink
          component={TanStackAnchor}
          to={"/items"}
          leftSection={<IconBook />}
          active
          variant={"filled"}
          fw={"bolder"}
          label={"Dine bøker"}
        />
      </>
    );
  }

  if (data === "SessionExpired") {
    return (
      <>
        <ErrorAlert title={"Betalingsforespørselen har utløpt"}>
          Du kan starte på nytt ved å trykke på {'"Gå til handlekurv"'}
        </ErrorAlert>
        <BackToCartButton />
      </>
    );
  }

  if (data === "PaymentTerminated") {
    return (
      <>
        <ErrorAlert title={"Du har avbrutt betalingen"}>
          Du kan starte på nytt ved å trykke på {'"Gå til handlekurv"'}
        </ErrorAlert>
        <BackToCartButton />
      </>
    );
  }

  return (
    <>
      <ErrorAlert title={"Noe gikk galt under betalingen"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
      <BackToCartButton />
    </>
  );
}
