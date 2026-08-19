import { Button, Group, Stack, Title } from "@mantine/core";
import { modals } from "@mantine/modals";

import { useAppForm } from "@/shared/hooks/form";

interface BranchItem {
  item: {
    id: string;
    title: string;
  };
  rent: boolean;
  rentAtBranch: boolean;
  partlyPayment: boolean;
  partlyPaymentAtBranch: boolean;
  buy: boolean;
  buyAtBranch: boolean;
  subjects: string[];
}

const defaultValues: {
  items: {
    id: string;
    title: string;
  }[];
  rent: boolean;
  rentAtBranch: boolean;
  partlyPayment: boolean;
  partlyPaymentAtBranch: boolean;
  buy: boolean;
  buyAtBranch: boolean;
  subjects: string[];
} = {
  items: [],
  rent: false,
  rentAtBranch: false,
  partlyPayment: false,
  partlyPaymentAtBranch: false,
  buy: false,
  buyAtBranch: false,
  subjects: [],
};

export function BranchItemCreationModal({
  modalId,
  onConfirm,
}: {
  modalId: string;
  onConfirm: (branchItems: BranchItem[]) => void;
}) {
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => {
      onConfirm(
        value.items.map((item) => ({
          item: {
            id: item.id,
            title: item.title,
          },
          rent: value.rent,
          rentAtBranch: value.rentAtBranch,
          partlyPayment: value.partlyPayment,
          partlyPaymentAtBranch: value.partlyPaymentAtBranch,
          buy: value.buy,
          buyAtBranch: value.buyAtBranch,
          subjects: value.subjects,
        })),
      );
      modals.close(modalId);
    },
  });

  return (
    <Stack>
      <Group gap={100}>
        <Stack>
          <Title order={4}>Bestilling</Title>
          <form.AppField name={"rent"}>
            {(field) => <field.SwitchField label={"Lån"} />}
          </form.AppField>
          <form.AppField name={"partlyPayment"}>
            {(field) => <field.SwitchField label={"Delbetaling"} />}
          </form.AppField>
          <form.AppField name={"buy"}>
            {(field) => <field.SwitchField label={"Salg"} />}
          </form.AppField>
        </Stack>
        <Stack>
          <Title order={4}>På filial</Title>
          <form.AppField name={"rentAtBranch"}>
            {(field) => <field.SwitchField label={"Lån"} />}
          </form.AppField>
          <form.AppField name={"partlyPaymentAtBranch"}>
            {(field) => <field.SwitchField label={"Delbetaling"} />}
          </form.AppField>
          <form.AppField name={"buyAtBranch"}>
            {(field) => <field.SwitchField label={"Salg"} />}
          </form.AppField>
        </Stack>
      </Group>
      <form.AppField name={"subjects"}>
        {(subField) => <subField.TagsField label={"Fag"} placeholder={"Velg fag"} />}
      </form.AppField>
      <form.AppField name={"items"}>{(field) => <field.SelectItemsField />}</form.AppField>
      <Group justify={"right"} mt={"md"}>
        <Button variant={"outline"} onClick={() => modals.close(modalId)}>
          Lukk
        </Button>
        <Button bg={"green"} onClick={form.handleSubmit}>
          Legg til
        </Button>
      </Group>
    </Stack>
  );
}
