import type { Branch } from "@boklisten/backend/shared/branch";
import type { InheritedBranchField } from "@boklisten/backend/shared/branch-inheritance";
import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import {
  IconArrowBackUp,
  IconArrowUp,
  IconBuildingStore,
  IconHierarchy3,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import type { BranchManagerTab } from "@/features/branches/branchManagerTabs";
import classes from "@/features/branches/inheritance/InheritedFieldCard.module.css";
import DescendantTree from "@/features/branches/inheritance/DescendantTree";
import InheritanceSourceLink from "@/features/branches/inheritance/InheritanceSourceLink";
import { INHERITED_FIELDS } from "@/features/branches/inheritance/inheritedFields";
import { inheritanceTone } from "@/features/branches/inheritance/tone";
import type { InheritanceTone } from "@/features/branches/inheritance/tone";
import useInheritedField from "@/features/branches/inheritance/useInheritedField";
import { api } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * One inherited branch field: its label, the control the caller renders with the value in force,
 * and where the value comes from. The control is always shown and editable; changing it gives
 * the branch its own value.
 *
 * Direction in the tree has one colour everywhere in the branch manager (as the counts on the
 * Aktive bøker tab): blue building = this branch, grape hierarchy = the branches below, and the
 * way up is quiet text. Everything about where the value comes from and where it goes sits
 * directly under the control, as one or two short lines, the same on a desktop and a phone (a
 * header slot on the right put it 700 px from the control on a wide screen):
 * - the way up: an own value gets a blue bar in the margin and "Overstyrt" with the same ↺
 *   button as a tree row (tooltip "Arv fra <parent>"; inherits again at once, without asking); an inherited value reads "Arvet fra
 *   <parent>" (past participle: where it came from; the lines below use "Arves av": where it goes) (a link to the parent's same tab); a root has no up-line;
 * - the way down, on every branch with branches below: how far a change here reaches (the
 *   followers), "Arves av alle underfilialer", "Arves av K av N underfilialer", or orange
 *   "Arves av ingen underfilialer" when the value is decoration. The line opens the field as one
 *   editable tree (`DescendantTree`). There every branch can be edited or made to inherit again,
 *   or all at once with "Tilbakestill alle", which confirms with a Fra → Til table since it
 *   rewrites other branches. Rows below are saved by the card itself; the branch's own row goes
 *   through the form, like its control.
 */
export default function InheritedFieldCard<K extends InheritedBranchField>({
  branchId,
  field,
  value: override,
  onChange,
  tab,
  description,
  children,
}: {
  branchId: string;
  field: K;
  /** The form's override of the field: the branch's own value, or `null` to inherit. */
  value: Branch[K] | null;
  /** Sets the form's override, which the form then saves. */
  onChange: (override: Branch[K] | null) => void;
  /** The tab a linked branch opens on: the one this card sits on. */
  tab: BranchManagerTab;
  /** What the value in force means, under the control. */
  description?: (value: Branch[K]) => ReactNode;
  /**
   * The control, given the value in force, a setter for the branch's override and the tone to
   * colour it in (blue set here, faded blue inherited, as in the tree).
   */
  children: (
    value: Branch[K],
    setValue: (value: Branch[K]) => void,
    tone: InheritanceTone,
  ) => ReactNode;
}) {
  const { label, formatValue, renderEditor } = INHERITED_FIELDS[field];
  // Overrides of branches below that are being saved, so an edited row keeps its new value
  // until the refetch brings it back.
  const [pending, setPending] = useState<ReadonlyMap<string, Branch[K] | null>>(new Map());
  const inheritance = useInheritedField(branchId, field, override, pending);
  const queryClient = useQueryClient();
  const [treeOpened, tree] = useDisclosure(false);
  // On a phone the tree needs the whole screen to show names at depth.
  const phone = useMediaQuery("(max-width: 48em)") ?? false;
  // Bumped after a bulk inherit: remounting the tree recomputes its expansion from the refetched
  // branches, where no branch below sets its own value any more.
  const [treeGeneration, setTreeGeneration] = useState(0);

  const invalidateBranches = () =>
    queryClient.invalidateQueries({ queryKey: api.branches.index.pathKey() });
  const inheritBelowMutation = useMutation(
    api.branches.inheritBelow.mutationOptions({
      onSuccess: async () => {
        showSuccessNotification(`Alle underfilialer arver nå ${label.toLowerCase()}.`);
        await invalidateBranches();
        setTreeGeneration((generation) => generation + 1);
      },
      onError: async () => {
        showErrorNotification("Klarte ikke oppdatere underfilialene");
        await invalidateBranches();
      },
    }),
  );
  // The tree row itself shows the change (the control moves, the bar and reset follow), so no
  // toast on success.
  const updateDescendantMutation = useMutation(
    api.branches.update.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke oppdatere underfilialen"),
    }),
  );

  if (!inheritance) {
    return null;
  }
  const { value, parent, inherited, descendants, descendantCount, followingCount } = inheritance;
  const overriding = descendants.filter((descendant) => descendant.overridden);
  const own = parent !== null && !inherited;
  const lowerLabel = label.toLowerCase();
  // The parent by its short name ("VG1" under Ullern videregående skole), as the branch picker
  // and the tree show it; the full name is one click away.
  const parentShort = parent ? { id: parent.id, name: parent.localName ?? parent.name } : null;

  /**
   * Sets a branch's override from the tree: the branch being edited through the form, like its
   * own control; a branch below directly, shown at once and cleared once the refetch is in.
   */
  function setOverride(id: string, next: Branch[K] | null) {
    if (id === branchId) {
      onChange(next);
      return;
    }
    setPending((current) => new Map(current).set(id, next));
    updateDescendantMutation.mutate(
      { params: { branchId: id }, body: { [field]: next } },
      {
        onSettled: async () => {
          await invalidateBranches();
          setPending((current) => {
            const rest = new Map(current);
            rest.delete(id);
            return rest;
          });
        },
      },
    );
  }

  /** Every branch below inherits again; asks first, since it rewrites the ones with own values. */
  function confirmInheritBelow() {
    modals.openConfirmModal({
      title: `Tilbakestill ${lowerLabel} i underfilialer`,
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Alle {descendantCount} underfilialer arver {lowerLabel} fra {inheritance?.branch.name}.
            Disse endres:
          </Text>
          <Table verticalSpacing={4} withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Filial</Table.Th>
                <Table.Th>Fra</Table.Th>
                <Table.Th>Til</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {overriding.map((descendant) => (
                <Table.Tr key={descendant.id}>
                  <Table.Td>{descendant.name}</Table.Td>
                  <Table.Td c="dimmed">{formatValue(descendant.value)}</Table.Td>
                  <Table.Td fw={600}>{formatValue(value)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ),
      labels: { confirm: "Bekreft", cancel: "Avbryt" },
      onConfirm: () => inheritBelowMutation.mutate({ params: { branchId }, body: { field } }),
    });
  }

  let provenance: ReactNode = null;
  if (own && parentShort) {
    provenance = (
      <Group gap={4} wrap="nowrap" c="var(--mantine-color-blue-light-color)">
        <IconBuildingStore size={14} />
        <Text size="xs" fw={500} c="inherit">
          Overstyrt
        </Text>
        <Tooltip label={`Arv fra ${parentShort.name}`} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`Arv ${lowerLabel} fra ${parentShort.name}`}
            onClick={() => onChange(null)}
          >
            <IconArrowBackUp size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  } else if (parentShort) {
    // The whole line is the link up, icon included.
    provenance = (
      <Text size="xs" c="dimmed" component="span" style={{ alignSelf: "flex-start" }}>
        <InheritanceSourceLink
          branch={parentShort}
          tab={tab}
          fw={500}
          className={classes["iconLink"]}
        >
          <IconArrowUp size={14} />
          Arvet fra {parentShort.name}
        </InheritanceSourceLink>
      </Text>
    );
  }

  return (
    <Box
      // The margin bar hangs left of the content column, blue while the branch sets the value
      // itself, so the label lines up with the fields around the card whichever way it goes.
      ml={parent ? -14 : 0}
      pl={parent ? 12 : 0}
      style={
        parent
          ? {
              borderLeft: `2px solid ${own ? "var(--mantine-color-blue-light-color)" : "transparent"}`,
              transition: "border-color 150ms ease",
            }
          : undefined
      }
    >
      <Text size="sm" fw={600}>
        {label}
      </Text>
      <Stack gap={4} pt={6}>
        {children(
          value,
          onChange,
          inheritanceTone({
            hasParent: parent !== null,
            overridden: own,
            hasChildren: descendantCount > 0,
          }),
        )}
        {description && (
          <Text size="xs" c="dimmed">
            {description(value)}
          </Text>
        )}
        {provenance}
        {descendantCount > 0 && (
          // How far a change here reaches, and the way into the tree; orange when it reaches
          // nobody, so a value that is only decoration says so.
          <Anchor
            component="button"
            type="button"
            size="xs"
            fw={500}
            c={
              followingCount === 0
                ? "var(--mantine-color-orange-light-color)"
                : "var(--mantine-color-grape-light-color)"
            }
            underline="never"
            className={classes["iconLink"]}
            aria-label={`Vis ${lowerLabel} i underfilialer`}
            onClick={tree.open}
            style={{ alignSelf: "flex-start" }}
          >
            <IconHierarchy3 size={14} />
            {followersText(followingCount, descendantCount)}
          </Anchor>
        )}
      </Stack>
      <Modal
        opened={treeOpened}
        onClose={tree.close}
        fullScreen={phone}
        // The title fills the header, so the bulk action sits right before the close button.
        styles={{ title: { flex: 1 } }}
        title={
          <Group justify="space-between" wrap="nowrap" pr="sm">
            <span>{label}</span>
            {overriding.length > 0 && (
              <Button
                variant="default"
                size="compact-sm"
                style={{ flexShrink: 0 }}
                leftSection={<IconArrowBackUp size={14} />}
                onClick={confirmInheritBelow}
              >
                Tilbakestill alle
              </Button>
            )}
          </Group>
        }
        size="lg"
      >
        <DescendantTree
          key={treeGeneration}
          root={{ ...inheritance.branch, value, overridden: own, parent }}
          descendants={descendants}
          renderEditor={renderEditor}
          label={label}
          tab={tab}
          onNavigate={tree.close}
          onChange={setOverride}
          onInherit={(id) => setOverride(id, null)}
        />
      </Modal>
    </Box>
  );
}

/** "Arves av alle / K av N / ingen underfilialer". */
function followersText(following: number, descendants: number): string {
  if (following === 0) {
    return "Arves av ingen underfilialer";
  }
  if (following === descendants) {
    return descendants === 1 ? "Arves av underfilialen" : "Arves av alle underfilialer";
  }
  return `Arves av ${following} av ${descendants} underfilialer`;
}
