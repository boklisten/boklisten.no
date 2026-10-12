import { Badge, Collapse, Text, ThemeIcon, Title, UnstyledButton } from "@mantine/core";
import {
  IconArrowUp,
  IconBuildingStore,
  IconChevronDown,
  IconHierarchy3,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import classes from "@/features/branches/TreeScopeSection.module.css";

/** Where a section's content sits relative to the selected node. */
export type TreeDirection = "above" | "here" | "below";

/**
 * The branch manager's one colour code for direction in the tree, as the metric rows, the count
 * badges and the inherited-field cards use it: the way up is quiet grey, this node is the blue
 * building, the branches below are the grape hierarchy.
 */
const DIRECTIONS: Record<TreeDirection, { icon: ReactNode; color: string }> = {
  above: { icon: <IconArrowUp size={18} />, color: "gray" },
  here: { icon: <IconBuildingStore size={18} />, color: "blue" },
  below: { icon: <IconHierarchy3 size={18} />, color: "grape" },
};

/**
 * One panel of a node's tab that lists what is above, on or below the node, shaped like a
 * deadline group in the book list: a header strip in the direction colour with the count, and
 * the content inside the same frame so nothing can be read as belonging to another panel. A
 * collapsible panel starts closed and opens from its header, so a long list is one click away
 * without pushing the rest of the tab out of sight.
 */
export default function TreeScopeSection({
  direction,
  title,
  count,
  collapsible = false,
  actions,
  children,
}: {
  direction: TreeDirection;
  title: string;
  count?: number | undefined;
  collapsible?: boolean;
  /** What can be done to this panel's rows, at the far right of the header; not for a collapsible panel, whose header is the toggle. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const bodyId = useId();
  const { icon, color } = DIRECTIONS[direction];
  const showBody = !collapsible || opened;
  // A button may only hold phrasing content, so the toggle header renders its title as a span
  // in the heading's type; the section's aria-label names the region in its place.
  const heading = (
    <>
      <ThemeIcon component="span" variant="transparent" color={color} size="md">
        {icon}
      </ThemeIcon>
      {collapsible ? (
        <Text component="span" fz="h4" fw={700} lh="h4">
          {title}
        </Text>
      ) : (
        <Title order={4}>{title}</Title>
      )}
      {count !== undefined && (
        <Badge component="span" variant="light" color={color} size="sm">
          {count.toLocaleString("nb-NO")}
        </Badge>
      )}
      {collapsible && (
        <ThemeIcon
          component="span"
          variant="transparent"
          color="gray"
          size="sm"
          className={classes.chevron}
          data-opened={opened || undefined}
        >
          <IconChevronDown size={16} />
        </ThemeIcon>
      )}
    </>
  );

  return (
    <section className={classes.panel} aria-label={title}>
      {collapsible ? (
        <UnstyledButton
          className={classes.header}
          data-collapsible
          data-with-body={showBody || undefined}
          onClick={() => setOpened((current) => !current)}
          aria-expanded={opened}
          aria-controls={bodyId}
        >
          {heading}
        </UnstyledButton>
      ) : (
        <div className={classes.header} data-with-body>
          {heading}
          {actions && <div className={classes.actions}>{actions}</div>}
        </div>
      )}
      {collapsible ? (
        <Collapse expanded={opened} id={bodyId}>
          <div className={classes.body}>{children}</div>
        </Collapse>
      ) : (
        <div className={classes.body}>{children}</div>
      )}
    </section>
  );
}
