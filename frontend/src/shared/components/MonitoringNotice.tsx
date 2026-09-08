import { Alert, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { ReactNode } from "react";

import useAuth from "@/shared/hooks/useAuth";

/**
 * Tells whoever is about to act that it is reported to the administrator, in the same quiet grey
 * note for every role and every monitored action. Put it in the confirm step of the action; the
 * title or question beside it names the action, so the notice does not. A single action may lead
 * with the `reason` the rule is bent; a batch lists its `actions` with their reasons instead.
 * Administrators are exempt on the backend, and only they are told so, in a last line.
 */
export default function MonitoringNotice({
  reason,
  actions,
}: {
  /** Why the single action is outside the rules; a sentence without its final period. */
  reason?: string | undefined;
  /** Several actions reported at once, each with its reason: a list, typically. */
  actions?: ReactNode;
}) {
  const { isAdmin } = useAuth();
  return (
    <Alert icon={<IconEye />} color="gray" variant="light" title="Overvåket handling">
      {actions === undefined ? (
        <>
          {reason === undefined ? null : `${reason}. `}
          Denne handlingen vil bli rapportert til administrator.
        </>
      ) : (
        <>
          Følgende handlinger vil bli rapportert til administrator:
          {actions}
        </>
      )}
      {isAdmin && (
        <Text size="xs" c="dimmed" mt={4}>
          Gjelder ikke administratorer.
        </Text>
      )}
    </Alert>
  );
}
