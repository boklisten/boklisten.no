import { ActionIcon, Tooltip } from "@mantine/core";
import type { ActionIconProps } from "@mantine/core";
import { IconHistory } from "@tabler/icons-react";

import useAuthLinker from "@/shared/hooks/useAuthLinker";

/**
 * A way back to the same page in the old bl-admin, for the pages that still exist in both apps
 * while the new one is being verified. The employee keeps their login, and Back returns here.
 * Rendered as a bare icon beside the page title; the label lives in the tooltip.
 */
export default function LegacyAppLink({
  path,
  label,
  ...actionIconProps
}: ActionIconProps & {
  path: string;
  /** "Gå til gammel …", naming the page it opens. */
  label: string;
}) {
  const { redirectToBlAdmin } = useAuthLinker();
  return (
    <Tooltip label={label}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        aria-label={label}
        onClick={() => void redirectToBlAdmin(path, true)}
        {...actionIconProps}
      >
        <IconHistory size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
