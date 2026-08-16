import { Alert, Button, Checkbox, Group, Stack, Switch, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useState } from "react";

import { bookCountLabel } from "@/features/branches/branch-books/bookCountLabel";
import { BranchBooksEditTarget } from "@/features/branches/branch-books/types";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";

export default function BranchBooksCancelModal({
  target,
  onSubmit,
  onClose,
}: {
  target: BranchBooksEditTarget;
  onSubmit: (options: {
    notifyCustomers: boolean;
    includeDescendants: boolean;
  }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [notifyCustomers, setNotifyCustomers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const indirectCount = target.total - target.direct;
  const affectedCount = includeDescendants ? target.total : target.direct;

  async function submit() {
    if (isSubmitting) return;
    const confirmed = await asyncConfirmModal({
      title: "Bekreft avbestilling",
      children: `Avbestiller ${target.description}. Dette gjelder opptil ${bookCountLabel(
        affectedCount,
      )} og kan ikke angres.`,
      confirmLabel: "Avbestill",
      confirmColor: "red",
      zIndex: 1000,
    });
    if (!confirmed) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ notifyCustomers, includeDescendants });
      onClose();
    } catch {
      // The mutation's onError notification covers this; keep the modal open for a retry
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack>
      <Text>Gjelder {target.description}</Text>
      {target.allowDescendants && indirectCount > 0 && (
        <Checkbox
          label={`Inkluder ${bookCountLabel(indirectCount)} fra underliggende filialer`}
          checked={includeDescendants}
          onChange={(event) => setIncludeDescendants(event.currentTarget.checked)}
        />
      )}
      <Switch
        label={"Send kvittering på e-post til kundene"}
        checked={notifyCustomers}
        onChange={(event) => setNotifyCustomers(event.currentTarget.checked)}
      />
      <Alert icon={<IconInfoCircle />} color={"yellow"}>
        Betalte bestillinger blir ikke avbestilt må håndteres manuelt.
      </Alert>
      <Group justify={"flex-end"}>
        <Button variant={"default"} onClick={onClose}>
          Avbryt
        </Button>
        <Button
          color={"red"}
          disabled={affectedCount === 0}
          loading={isSubmitting}
          onClick={submit}
        >
          Avbestill ({bookCountLabel(affectedCount)})
        </Button>
      </Group>
    </Stack>
  );
}
