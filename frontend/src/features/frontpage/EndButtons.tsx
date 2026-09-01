import { Button } from "@mantine/core";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { Activity } from "react";

import useAuth from "@/shared/hooks/useAuth";

export default function EndButtons() {
  const { isLoggedIn } = useAuth();
  return (
    <>
      <Activity mode={isLoggedIn ? "visible" : "hidden"}>
        <Button component={TanStackAnchor} to="/bestilling" variant="outline">
          Bestill bøker
        </Button>
        <Button component={TanStackAnchor} to="/items" variant="outline">
          Se mine bøker
        </Button>
      </Activity>
      <Activity mode={!isLoggedIn ? "visible" : "hidden"}>
        <Button component={TanStackAnchor} to="/auth/register">
          Registrer deg
        </Button>
        <Button variant="outline" component={TanStackAnchor} to="/auth/login" c="green">
          Logg inn
        </Button>
      </Activity>
    </>
  );
}
