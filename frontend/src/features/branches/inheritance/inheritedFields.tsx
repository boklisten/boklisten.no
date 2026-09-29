import type { Branch } from "@boklisten/backend/shared/branch";
import type { InheritedBranchField } from "@boklisten/backend/shared/branch-inheritance";
import { NumberInput } from "@mantine/core";
import type { ReactNode } from "react";
import { useState } from "react";

import { VisibilitySelect, visibilityLabel } from "@/features/branches/branchVisibility";
import { ToneSwitch, toneInputStyles } from "@/features/branches/inheritance/tone";
import type { InheritanceTone } from "@/features/branches/inheritance/tone";

export interface InheritedFieldPresentation<T> {
  /** The field as the admin reads it, e.g. "Synlighet". */
  label: string;
  /** The value as text, e.g. "På", "33 %", "Offentlig", wherever a value is named rather than edited. */
  formatValue: (value: T) => string;
  /**
   * The compact control that edits the value in one row of the descendant tree, left of the
   * branch name: a bare switch for a switch, a select for the segmented control, a number field
   * for a percentage, coloured by where the value comes from (`tone`). The percentage field is
   * the same control in the card (`size: "sm"`).
   */
  renderEditor: (value: T, onChange: (value: T) => void, options: EditorOptions) => ReactNode;
}

export interface EditorOptions {
  /** The accessible name, e.g. "Synlighet for Ullern VG1". */
  label: string;
  tone: InheritanceTone;
  /** `xs` in a tree row (the default), `sm` in the card. */
  size?: "xs" | "sm";
}

/** One entry per inherited field; adding a field means adding a row here and a card in its form. */
export const INHERITED_FIELDS: {
  [K in InheritedBranchField]: InheritedFieldPresentation<Branch[K]>;
} = {
  visibility: {
    label: "Synlighet",
    formatValue: visibilityLabel,
    renderEditor: (value, onChange, options) => (
      <VisibilitySelect value={value} onChange={onChange} {...options} />
    ),
  },
  deliveryAtBranch: {
    label: "Utlevering på filial",
    formatValue: onOffLabel,
    renderEditor: onOffEditor,
  },
  deliveryByMail: {
    label: "Levering per post",
    formatValue: onOffLabel,
    renderEditor: onOffEditor,
  },
  responsibleForDelivery: {
    label: "Gratis postlevering",
    formatValue: onOffLabel,
    renderEditor: onOffEditor,
  },
  paymentResponsible: {
    label: "Ansvarlig for betaling",
    formatValue: onOffLabel,
    renderEditor: onOffEditor,
  },
  buyoutPercentage: {
    label: "Utkjøpsprosent",
    formatValue: percentageLabel,
    renderEditor: percentageEditor,
  },
  sellPercentage: {
    label: "Innkjøpsprosent",
    formatValue: percentageLabel,
    renderEditor: percentageEditor,
  },
};

/** The words a switch's state reads as, everywhere a switch value is shown. */
export function onOffLabel(value: boolean): string {
  return value ? "På" : "Av";
}

/** A fraction as whole percent, "33 %". */
export function percentageLabel(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function onOffEditor(
  value: boolean,
  onChange: (value: boolean) => void,
  { label, tone }: EditorOptions,
): ReactNode {
  return <ToneSwitch checked={value} onChange={onChange} tone={tone} ariaLabel={label} />;
}

function percentageEditor(
  value: number,
  onChange: (value: number) => void,
  options: EditorOptions,
): ReactNode {
  return <PercentageInput value={value} onChange={onChange} {...options} />;
}

/**
 * A whole-percent field for a fraction (0.33 ↔ 33 %). Typing stays local; the value is reported
 * on blur or Enter, so a save happens per choice, not per keystroke.
 */
function PercentageInput({
  value,
  onChange,
  label,
  tone,
  size = "xs",
}: {
  value: number;
  onChange: (value: number) => void;
} & EditorOptions) {
  const [typed, setTyped] = useState<string | number | null>(null);
  const commit = () => {
    if (typed === null) {
      return;
    }
    setTyped(null);
    const percent = Math.trunc(Number(typed));
    if (Number.isFinite(percent) && Math.round(value * 100) !== percent) {
      onChange(percent / 100);
    }
  };
  return (
    <NumberInput
      size={size}
      w={size === "xs" ? 76 : 96}
      styles={toneInputStyles(tone)}
      aria-label={label}
      suffix=" %"
      min={0}
      max={100}
      clampBehavior="strict"
      allowDecimal={false}
      allowNegative={false}
      hideControls
      value={typed ?? Math.round(value * 100)}
      onChange={setTyped}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        }
      }}
    />
  );
}
