import { Button, Menu, Text } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import { IconChevronDown } from "@tabler/icons-react";

export interface BookAction {
  key: string;
  label: string;
  /** The price or what follows, under the label in the menu. */
  description?: string;
  icon: Icon;
  color?: string;
  /** Why the action is not available; set means disabled. */
  blockedReason?: string;
  /** The action is already chosen (in the cart); choosing it again undoes it. */
  selected?: boolean;
  onClick: () => void;
}

/**
 * Everything that can be done with one book, behind one control. A single action is a plain
 * button; several open a menu, whose button names the chosen one once something is chosen.
 */
export default function BookActionMenu({
  label,
  actions,
  loading = false,
}: {
  /** The menu button's text while nothing is chosen, e.g. "Forleng eller kjøp ut". */
  label: string;
  actions: BookAction[];
  loading?: boolean;
}) {
  const selected = actions.find((action) => action.selected);
  const [only] = actions;
  if (actions.length === 1 && only) {
    const OnlyIcon = only.icon;
    return (
      <Button
        size="compact-sm"
        variant={only.selected ? "filled" : "light"}
        color={only.color}
        leftSection={<OnlyIcon size={16} aria-hidden />}
        disabled={only.blockedReason !== undefined}
        title={only.blockedReason}
        loading={loading}
        onClick={only.onClick}
      >
        {only.label}
      </Button>
    );
  }
  const SelectedIcon = selected?.icon;
  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={260}>
      <Menu.Target>
        <Button
          size="compact-sm"
          variant={selected ? "filled" : "light"}
          color={selected?.color}
          leftSection={SelectedIcon && <SelectedIcon size={16} aria-hidden />}
          rightSection={<IconChevronDown size={14} aria-hidden />}
          loading={loading}
        >
          {selected ? selected.label : label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Menu.Item
              key={action.key}
              leftSection={<ActionIcon size={18} aria-hidden />}
              color={action.color}
              disabled={action.blockedReason !== undefined}
              onClick={action.onClick}
            >
              <Text size="sm" fw={500}>
                {action.selected ? `Angre: ${action.label}` : action.label}
              </Text>
              {(action.blockedReason ?? action.description) && (
                <Text size="xs" c="dimmed">
                  {action.blockedReason ?? action.description}
                </Text>
              )}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
