import { Button, Group } from "@mantine/core";
import { IconBook } from "@tabler/icons-react";
import ShowCustomerIdButton from "@/shared/components/ShowCustomerIdButton";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { Activity } from "react";

import useAuth from "@/shared/hooks/useAuth";

export default function QuickButtons() {
  const { isLoggedIn, detailsId } = useAuth();
  return (
    <Group justify={"center"}>
      <Activity mode={isLoggedIn ? "visible" : "hidden"}>
        <Button component={TanStackAnchor} to={"/items"} leftSection={<IconBook />}>
          Dine bøker
        </Button>
        {detailsId && <ShowCustomerIdButton customerId={detailsId} />}
      </Activity>
      <Activity mode={!isLoggedIn ? "visible" : "hidden"}>
        <Button component={TanStackAnchor} to={"/auth/login"} bg={"green"}>
          Logg inn
        </Button>
        <Button component={TanStackAnchor} to={"/auth/register"}>
          Registrer deg
        </Button>
      </Activity>
      <Button component={TanStackAnchor} to={"/info/branch"} variant={"outline"}>
        Våre åpningstider
      </Button>
      <Button component={TanStackAnchor} to={"/info/faq"} variant={"outline"}>
        Ofte stilte spørsmål
      </Button>
    </Group>
  );
}
