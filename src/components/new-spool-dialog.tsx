"use client";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { AppError, createSpool, MATERIALS, type Spool } from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import {
  CopyDraft,
  ErrorNotice,
  inputMass,
  inputMoney,
  TextField,
} from "./form-fields";

export function NewSpoolDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button id="add-spool" className="h-11">
          <Plus data-icon="inline-start" />
          Add spool
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a spool to your shelf</DialogTitle>
          <DialogDescription>
            A few details now make your next print easier to plan.
          </DialogDescription>
        </DialogHeader>
        {open ? <NewSpoolForm close={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
function NewSpoolForm({ close }: { close: () => void }) {
  const { workspace, save, busy, error } = useWorkspace();
  const [revision] = useState(workspace.revision);
  const [failure, setFailure] = useState<AppError | null>(null);
  const [attempted, setAttempted] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setAttempted(false);
    const data = new FormData(event.currentTarget);
    try {
      const nominal = inputMass(
        data.get("nominalMassMilliGrams"),
        "nominalMassMilliGrams",
      );
      const next = createSpool(workspace, {
        label: String(data.get("label")),
        brand: String(data.get("brand")),
        material: String(data.get("material")) as Spool["material"],
        colorName: String(data.get("colorName")),
        nominalMassMilliGrams: nominal,
        tareMassMilliGrams: inputMass(
          data.get("tareMassMilliGrams"),
          "tareMassMilliGrams",
          true,
        ),
        purchaseCostMinor: inputMoney(
          data.get("purchaseCostMinor"),
          "purchaseCostMinor",
        ),
        initialRemaining: String(data.get("initialRemaining")).trim()
          ? inputMass(data.get("initialRemaining"), "initialRemaining", true)
          : nominal,
      });
      setAttempted(true);
      if (await save(() => next, revision)) close();
    } catch (cause) {
      setFailure(
        cause instanceof AppError
          ? cause
          : new AppError("VALIDATION_ERROR", "Check your spool details."),
      );
    }
  }
  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5"
    >
      <ErrorNotice
        message={failure?.message ?? (attempted ? error?.message : undefined)}
      />
      <FieldGroup className="form-grid">
        <div className="full-field">
          <TextField
            name="label"
            label="Spool name"
            placeholder="e.g. Moss green PLA"
            maxLength={80}
            error={failure?.fields.label}
            required
          />
        </div>
        <TextField
          name="brand"
          label="Brand"
          placeholder="Filament brand"
          maxLength={80}
          error={failure?.fields.brand}
          required
        />
        <Field>
          <FieldLabel htmlFor="material">Material</FieldLabel>
          <select
            id="material"
            name="material"
            className="filter w-full"
            defaultValue="PLA"
          >
            {MATERIALS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <div className="full-field">
          <TextField
            name="colorName"
            label="Color"
            placeholder="e.g. Moss green"
            maxLength={80}
            error={failure?.fields.colorName}
            required
          />
        </div>
        <TextField
          name="nominalMassMilliGrams"
          label="Nominal filament (g)"
          inputMode="decimal"
          defaultValue="1000"
          hint="Filament capacity, without the spool."
          error={failure?.fields.nominalMassMilliGrams}
          required
        />
        <TextField
          name="tareMassMilliGrams"
          label="Empty spool tare (g)"
          inputMode="decimal"
          placeholder="e.g. 200"
          hint="The empty spool, not the new package."
          error={failure?.fields.tareMassMilliGrams}
          required
        />
        <TextField
          name="purchaseCostMinor"
          label={`Purchase cost (${workspace.settings.currency})`}
          inputMode="decimal"
          placeholder="e.g. 20.00"
          error={failure?.fields.purchaseCostMinor}
          required
        />
        <TextField
          name="initialRemaining"
          label="Initial remaining (g)"
          inputMode="decimal"
          placeholder="Same as nominal"
          hint="Leave blank for a full spool."
          error={failure?.fields.initialRemaining}
        />
      </FieldGroup>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Mass accepts up to 3 decimal places and 50,000 g. Tare, capacity, and
        purchase cost stay fixed; the ledger preserves how each balance was
        calculated.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CopyDraft form={form} />
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save spool"}
        </Button>
      </div>
    </form>
  );
}
