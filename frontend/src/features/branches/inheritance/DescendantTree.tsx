import { ActionIcon, Box, Collapse, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconArrowBackUp, IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { BranchManagerTab } from "@/features/branches/branchManagerTabs";
import InheritanceSourceLink from "@/features/branches/inheritance/InheritanceSourceLink";
import type { EditorOptions } from "@/features/branches/inheritance/inheritedFields";
import { inheritanceTone } from "@/features/branches/inheritance/tone";
import type {
  BranchRef,
  DescendantInheritance,
} from "@/features/branches/inheritance/useInheritedField";

/**
 * A field across a subtree, as one editable tree: the branch being edited heads it flush left
 * with its full name, the branches below follow under their short names (as in the branch
 * picker). Every row is [chevron] name control ↺: the field's compact control with the value in
 * force sits right after the name, and changing it gives that branch its own value
 * (`onChange`); a branch with its own value has a reset right after the control (↺, `onInherit`,
 * no confirm).
 *
 * Where a value comes from is the line beside a row and the control's colour: the parent's line
 * is blue beside exactly the rows that set their own value, grey everywhere else, and a control
 * is blue where the value is set at that branch and grey where it is inherited (`tone.tsx`), so
 * the eye lands on the overrides. The direct children are always listed; a branch starts
 * expanded exactly when an override sits beneath it, so the tree opens down to every one and no further. Every branch with children can be opened
 * and closed.
 */
export default function DescendantTree<T>({
  root,
  descendants,
  renderEditor,
  label,
  tab,
  onNavigate,
  onChange,
  onInherit,
}: {
  /** The branch being edited, with its value in force, whether it overrides, and its parent. */
  root: BranchRef & { value: T; overridden: boolean; parent: BranchRef | null };
  descendants: DescendantInheritance<T>[];
  renderEditor: (value: T, onChange: (value: T) => void, options: EditorOptions) => ReactNode;
  /** The field's label, for the controls' accessible names. */
  label: string;
  /** The tab a linked branch opens on. */
  tab: BranchManagerTab;
  /** Called when a branch link is followed, e.g. to close the modal. */
  onNavigate: () => void;
  onChange: (branchId: string, value: T) => void;
  onInherit: (branchId: string) => void;
}) {
  const rootId = root.id;
  const childrenOf = Map.groupBy(
    descendants.toSorted((a, b) => shortName(a).localeCompare(shortName(b), "nb")),
    (branch) => branch.parent.id,
  );
  const overrideBelow = withOverrideBelow(rootId, childrenOf);
  // oxlint-disable-next-line react/hook-use-state -- the initial expansion only; toggles go through `toggle`
  const [expanded, setExpanded] = useState(() => overrideBelow);
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  /** One row, the same for the root and every branch below. */
  const row = ({
    id,
    fullName,
    chevron,
    name,
    value,
    overridden,
    parent,
  }: {
    id: string;
    fullName: string;
    chevron: ReactNode;
    name: ReactNode;
    value: T;
    overridden: boolean;
    parent: BranchRef | null;
  }) => (
    <Group gap="xs" wrap="nowrap" mih={ROW_HEIGHT}>
      {chevron}
      <Text size="sm" style={{ minWidth: 0 }} truncate>
        {name}
      </Text>
      <Box style={{ flexShrink: 0 }}>
        {renderEditor(value, (next) => onChange(id, next), {
          label: `${label} for ${fullName}`,
          // Only a tree is ever shown here, so a branch without a parent hands its value down.
          tone: inheritanceTone({ hasParent: parent !== null, overridden, hasChildren: true }),
        })}
      </Box>
      {overridden && parent && (
        <Tooltip label={`Arv fra ${parent.name}`} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`La ${fullName} arve ${label.toLowerCase()} fra ${parent.name}`}
            onClick={() => onInherit(id)}
          >
            <IconArrowBackUp size={16} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );

  /**
   * The children of `parentId`, hanging from the parent's line: the line runs 10 px in from the
   * parent's row (the chevron's centre), and each child's row starts under the parent's name,
   * so every level steps in by the same 32 px (chevron 22 px + gap 10 px).
   */
  const level = (parentId: string): ReactNode => {
    const children = childrenOf.get(parentId) ?? [];
    return (
      <Box ml={LINE_OFFSET} pl={LINE_TO_ROW}>
        {children.map((branch) => {
          const hasChildren = childrenOf.has(branch.id);
          const opened = expanded.has(branch.id);
          return (
            <Box key={branch.id} pos="relative">
              <Guide overridden={branch.overridden} />
              {row({
                id: branch.id,
                fullName: branch.name,
                chevron: hasChildren ? (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-expanded={opened}
                    aria-label={`${opened ? "Skjul" : "Vis"} underfilialer av ${branch.name}`}
                    onClick={() => toggle(branch.id)}
                  >
                    <IconChevronRight
                      size={16}
                      style={{
                        transform: opened ? "rotate(90deg)" : undefined,
                        transition: "transform 150ms ease",
                      }}
                    />
                  </ActionIcon>
                ) : (
                  <Box w={CHEVRON_WIDTH} style={{ flexShrink: 0 }} />
                ),
                name: (
                  <InheritanceSourceLink
                    branch={{ id: branch.id, name: shortName(branch) }}
                    tab={tab}
                    onClick={onNavigate}
                  />
                ),
                value: branch.value,
                overridden: branch.overridden,
                parent: branch.parent,
              })}
              {hasChildren && <Collapse expanded={opened}>{level(branch.id)}</Collapse>}
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Stack gap={0}>
      {row({
        id: root.id,
        fullName: root.name,
        chevron: null,
        name: (
          <Text span size="sm" fw={600}>
            {root.name}
          </Text>
        ),
        value: root.value,
        overridden: root.overridden,
        parent: root.parent,
      })}
      {level(rootId)}
    </Stack>
  );
}

/**
 * The piece of the parent's line beside one child: blue beside the child's row when it sets its
 * own value, grey beside it otherwise and always grey on beside its children, so blue sits only
 * next to an adjusted control.
 */
function Guide({ overridden }: { overridden: boolean }) {
  const left = -(LINE_TO_ROW + LINE_WIDTH);
  return (
    <>
      <Box
        pos="absolute"
        left={left}
        top={0}
        w={LINE_WIDTH}
        h={ROW_HEIGHT}
        bg={overridden ? "var(--mantine-color-blue-light-color)" : LINE_COLOR}
        style={{ transition: "background-color 150ms ease" }}
      />
      <Box pos="absolute" left={left} top={ROW_HEIGHT} bottom={0} w={LINE_WIDTH} bg={LINE_COLOR} />
    </>
  );
}

const LINE_COLOR = "var(--mantine-color-default-border)";

/** Fits the tallest control (a select or number field) with air, so every row has one rhythm. */
const ROW_HEIGHT = 38;
const CHEVRON_WIDTH = 22;
const LINE_WIDTH = 2;
/** Where a parent's line runs: the centre of its chevron. */
const LINE_OFFSET = 10;
/** From the line to the child's row: past the rest of the chevron and the gap. */
const LINE_TO_ROW = 20;

/** The branches below `rootId` with an own value somewhere beneath them: the ones opened at first. */
function withOverrideBelow<T>(
  rootId: string,
  childrenOf: Map<string, DescendantInheritance<T>[]>,
): Set<string> {
  const ids = new Set<string>();
  const visit = (id: string): boolean => {
    let below = false;
    for (const child of childrenOf.get(id) ?? []) {
      const childHasOverrideBelow = visit(child.id);
      if (childHasOverrideBelow) {
        ids.add(child.id);
      }
      below ||= child.overridden || childHasOverrideBelow;
    }
    return below;
  };
  visit(rootId);
  return ids;
}

/** The name under its parent, as the branch picker shows it. */
function shortName(branch: DescendantInheritance<unknown>): string {
  return branch.localName ?? branch.name;
}
