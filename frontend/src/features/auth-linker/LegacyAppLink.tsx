import { Button } from "@mantine/core";
import type { ButtonProps } from "@mantine/core";
import { IconHistory } from "@tabler/icons-react";

import useAuthLinker from "@/shared/hooks/useAuthLinker";

/**
 * A way back to the same page in the old bl-admin, for the pages that still exist in both apps
 * while the new one is being verified. The employee keeps their login, and Back returns here.
 */
export default function LegacyAppLink({
  path,
  label,
  ...buttonProps
}: ButtonProps & {
  path: string;
  /** "Gå til gammel …", naming the page it opens. */
  label: string;
}) {
  const { redirectToBlAdmin } = useAuthLinker();
  return (
    <Button
      variant="subtle"
      color="gray"
      size="compact-sm"
      leftSection={<IconHistory size={16} />}
      onClick={() => void redirectToBlAdmin(path, true)}
      {...buttonProps}
    >
      {label}
    </Button>
  );
}
