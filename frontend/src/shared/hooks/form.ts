import { createFormHookContexts, createFormHook } from "@tanstack/react-form";

import ErrorSummary from "@/shared/components/form/ErrorSummary";
import CheckboxField from "@/shared/components/form/fields/basic/CheckboxField";
import DateField from "@/shared/components/form/fields/basic/DateField";
import DateTimePickerField from "@/shared/components/form/fields/basic/DateTimePickerField";
import MultiSelectField from "@/shared/components/form/fields/basic/MultiSelectField";
import NumberField from "@/shared/components/form/fields/basic/NumberField";
import SelectField from "@/shared/components/form/fields/basic/SelectField";
import SwitchField from "@/shared/components/form/fields/basic/SwitchField";
import TagsField from "@/shared/components/form/fields/basic/TagsField";
import TextAreaField from "@/shared/components/form/fields/basic/TextAreaField";
import TextField from "@/shared/components/form/fields/basic/TextField";
import TimePickerField from "@/shared/components/form/fields/basic/TimePickerField";
import AddressField from "@/shared/components/form/fields/complex/AddressField";
import CsvFileField from "@/shared/components/form/fields/complex/CsvFileField";
import CurrencyField from "@/shared/components/form/fields/complex/CurrencyField";
import DeadlinePickerField from "@/shared/components/form/fields/complex/DeadlinePickerField";
import EmailField from "@/shared/components/form/fields/complex/EmailField";
import NameField from "@/shared/components/form/fields/complex/NameField";
import NewPasswordField from "@/shared/components/form/fields/complex/NewPasswordField";
import PasswordField from "@/shared/components/form/fields/complex/PasswordField";
import PercentageField from "@/shared/components/form/fields/complex/PercentageField";
import PhoneNumberField from "@/shared/components/form/fields/complex/PhoneNumberField";
import PostalCodeField from "@/shared/components/form/fields/complex/PostalCodeField";
import RichTextEditorField from "@/shared/components/form/fields/complex/RichTextEditorField";
import SegmentedControlField from "@/shared/components/form/fields/complex/SegmentedControlField";
import SelectBranchField from "@/shared/components/form/fields/complex/SelectBranchField";
import SelectBranchesField from "@/shared/components/form/fields/complex/SelectBranchesField";
import SelectEmailTemplateField from "@/shared/components/form/fields/complex/SelectEmailTemplateField";
import SelectItemsField from "@/shared/components/form/fields/complex/SelectItemsField";
import SelectPermissionField from "@/shared/components/form/fields/complex/SelectPermissionField";
import SignatureCanvasField from "@/shared/components/form/fields/complex/SignatureCanvasField";
import ImageField from "@/shared/components/form/fields/complex/ImageField";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

const { useAppForm, withFieldGroup } = createFormHook({
  fieldComponents: {
    // Basic
    TextField,
    TextAreaField,
    NumberField,
    DateField,
    DateTimePickerField,
    TimePickerField,
    SelectField,
    MultiSelectField,
    CheckboxField,
    SwitchField,
    TagsField,
    CsvFileField,

    // Complex
    EmailField,
    PhoneNumberField,
    NameField,
    AddressField,
    PostalCodeField,
    PasswordField,
    NewPasswordField,
    SelectBranchField,
    SelectBranchesField,
    SelectPermissionField,
    SegmentedControlField,
    DeadlinePickerField,
    RichTextEditorField,
    SignatureCanvasField,
    PercentageField,
    CurrencyField,
    SelectItemsField,
    SelectEmailTemplateField,
    ImageField,
  },
  formComponents: {
    ErrorSummary,
  },
  fieldContext,
  formContext,
});

export { useAppForm, withFieldGroup, useFieldContext, useFormContext };
