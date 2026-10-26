"use client";
import { Field, FieldDescription, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { downloadText } from "@/lib/download";
import { AppError, parseMass, parseMoney } from "@/lib/domain";

export function TextField({
  name,
  label,
  hint,
  error,
  ...props
}: React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={`${name}-help`}
        {...props}
      />
      <FieldDescription id={`${name}-help`}>{error ?? hint}</FieldDescription>
    </Field>
  );
}
export function ErrorNotice({ message }: { message?: string }) {
  return message ? (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
}
export function CopyDraft({
  form,
}: {
  form: React.RefObject<HTMLFormElement | null>;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        if (form.current)
          downloadText(
            JSON.stringify(
              Object.fromEntries(new FormData(form.current)),
              null,
              2,
            ),
            "printpantry-unsaved-entry.txt",
            "text/plain",
          );
      }}
    >
      Copy unsaved entry
    </Button>
  );
}
export function inputMass(
  value: FormDataEntryValue | null,
  field: string,
  allowZero = false,
) {
  try {
    return parseMass(String(value ?? ""), allowZero);
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", (error as Error).message, {
      [field]: (error as Error).message,
    });
  }
}
export function inputMoney(value: FormDataEntryValue | null, field: string) {
  try {
    return parseMoney(String(value ?? ""));
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", (error as Error).message, {
      [field]: (error as Error).message,
    });
  }
}
