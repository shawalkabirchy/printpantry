"use client";
import { useRef, useState } from "react";
import { Archive, ArchiveRestore, Scale, Minus, Trash2 } from "lucide-react";
import {
  appendEvent,
  AppError,
  balances,
  deleteSpool,
  grams,
  measuredRemaining,
  money,
  perGram,
  setArchived,
  type Spool,
} from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { Textarea } from "./ui/textarea";
import { CopyDraft, ErrorNotice, inputMass, TextField } from "./form-fields";

export function SpoolDetails({
  spool,
  close,
  opener,
}: {
  spool: Spool;
  close: () => void;
  opener: HTMLButtonElement | null;
}) {
  const { workspace, busy, save, error } = useWorkspace();
  const [action, setAction] = useState<"measurement" | "consumption" | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [visibleEntries, setVisibleEntries] = useState(20);
  const remaining = balances(workspace).get(spool.id)!;
  const events = workspace.events
    .filter((event) => event.spoolId === spool.id)
    .sort((a, b) => b.sequence - a.sequence);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-[540px]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener?.isConnected) opener.focus();
          else document.getElementById("add-spool")?.focus();
        }}
      >
        <SheetHeader className="border-b pb-6">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="spool-disc"
              data-material={spool.material}
              aria-hidden="true"
            />
            <Badge variant="secondary">
              {spool.material}
              {spool.archived ? " · Archived" : ""}
            </Badge>
          </div>
          <SheetTitle className="text-2xl leading-tight break-words">
            {spool.label}
          </SheetTitle>
          <SheetDescription>
            {spool.brand} · {spool.colorName}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-6 pb-8">
          <div className="border-b py-5">
            <p className="text-sm text-muted-foreground">
              Estimated filament remaining
            </p>
            <p
              data-testid="remaining-mass"
              className="mt-2 text-4xl font-semibold tracking-tight"
            >
              {grams(remaining)}{" "}
              <span className="text-xl font-normal text-muted-foreground">
                g
              </span>
            </p>
            <div className="balance-bar">
              <span
                style={{
                  width: `${(remaining / spool.nominalMassMilliGrams) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.round((remaining / spool.nominalMassMilliGrams) * 100)}% of{" "}
              {grams(spool.nominalMassMilliGrams)} g nominal
            </p>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Empty tare</dt>
                <dd className="mt-1 numeric">
                  {grams(spool.tareMassMilliGrams)} g
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Purchase cost</dt>
                <dd className="mt-1 numeric">
                  {money(spool.purchaseCostMinor, workspace.settings.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Per gram</dt>
                <dd className="mt-1 numeric break-all">
                  {perGram(spool, workspace.settings.currency)}
                </dd>
              </div>
            </dl>
          </div>
          <ErrorNotice message={error?.message} />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              variant={action === "measurement" ? "default" : "outline"}
              onClick={() => setAction("measurement")}
            >
              <Scale data-icon="inline-start" />
              Weigh spool
            </Button>
            <Button
              disabled={busy}
              variant={action === "consumption" ? "default" : "outline"}
              onClick={() => setAction("consumption")}
            >
              <Minus data-icon="inline-start" />
              Record consumption
            </Button>
          </div>
          {action ? (
            <EventForm
              key={`${action}-${workspace.revision}`}
              spool={spool}
              kind={action}
              close={() => setAction(null)}
            />
          ) : null}
          <section aria-labelledby="history-heading">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="history-heading" className="font-semibold">
                Measurement ledger
              </h3>
              <span className="text-xs text-muted-foreground">
                {events.length} entries · UTC
              </span>
            </div>
            <ol className="divide-y">
              {events.slice(0, visibleEntries).map((event) => (
                <li key={event.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {event.kind === "initial"
                          ? "Opening balance"
                          : event.kind === "measurement"
                            ? "Weighed spool"
                            : "Consumption"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        #{event.sequence} ·{" "}
                        {new Intl.DateTimeFormat("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "UTC",
                        }).format(new Date(event.createdAt))}
                      </p>
                    </div>
                    <span className="numeric shrink-0 text-sm">
                      {event.kind === "consumption" ? "−" : ""}
                      {grams(event.quantityMilliGrams)} g
                    </span>
                  </div>
                  {event.note ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {event.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
            {events.length > visibleEntries ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Showing {visibleEntries} of {events.length} ledger entries.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleEntries((count) => count + 20)}
                >
                  Show older 20
                </Button>
              </div>
            ) : null}
          </section>
          <p className="text-xs leading-relaxed text-muted-foreground">
            History stays intact. Correct an estimate with a new weighing. To
            correct tare, nominal mass, or cost, create a replacement spool and
            archive this one.
          </p>
          <div className="flex flex-wrap justify-between gap-2 border-t pt-5">
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                if (
                  await save((state) =>
                    setArchived(state, spool.id, !spool.archived),
                  )
                )
                  close();
              }}
            >
              {spool.archived ? (
                <ArchiveRestore data-icon="inline-start" />
              ) : (
                <Archive data-icon="inline-start" />
              )}
              {spool.archived ? "Restore to active" : "Archive spool"}
            </Button>
            <AlertDialog open={deleting} onOpenChange={setDeleting}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  <Trash2 data-icon="inline-start" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete this spool and its history?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes {spool.label} and all {events.length} ledger
                    entries from this device. Export a backup in Settings first
                    if you may need them.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ErrorNotice message={error?.message} />
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busy}>
                    Keep spool
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={busy}
                    onClick={async (event) => {
                      event.preventDefault();
                      if (await save((state) => deleteSpool(state, spool.id))) {
                        setDeleting(false);
                        close();
                      }
                    }}
                  >
                    Delete spool and history
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
function EventForm({
  spool,
  kind,
  close,
}: {
  spool: Spool;
  kind: "measurement" | "consumption";
  close: () => void;
}) {
  const { workspace, save, busy } = useWorkspace();
  const [revision] = useState(workspace.revision);
  const [failure, setFailure] = useState<string>();
  const [value, setValue] = useState("");
  const form = useRef<HTMLFormElement>(null);
  let preview: number | undefined;
  if (kind === "measurement" && value.trim()) {
    try {
      preview = measuredRemaining(spool, inputMass(value, "quantity"));
    } catch {
      /* Show validation on submit; keep typing uninterrupted. */
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(undefined);
    try {
      const data = new FormData(event.currentTarget);
      const entered = inputMass(value, "quantity");
      const quantity =
        kind === "measurement" ? measuredRemaining(spool, entered) : entered;
      if (
        await save(
          (state) =>
            appendEvent(
              state,
              spool.id,
              kind,
              quantity,
              String(data.get("note")),
            ),
          revision,
        )
      )
        close();
    } catch (cause) {
      setFailure(
        cause instanceof AppError ? cause.message : "Check this entry.",
      );
    }
  }
  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4"
    >
      <h3 className="font-semibold">
        {kind === "measurement"
          ? "A fresh measurement"
          : "Record filament used"}
      </h3>
      <ErrorNotice message={failure} />
      <FieldGroup>
        <TextField
          name="quantity"
          label={
            kind === "measurement"
              ? "Gross weight including spool (g)"
              : "Filament consumed (g)"
          }
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          hint={
            kind === "measurement"
              ? `We subtract the fixed ${grams(spool.tareMassMilliGrams)} g tare.`
              : "Positive grams, up to the current balance."
          }
          error={failure}
          required
        />
        <Field>
          <FieldLabel htmlFor="note">Note (optional)</FieldLabel>
          <Textarea
            name="note"
            id="note"
            maxLength={1000}
            placeholder="A print name or reason for weighing"
          />
        </Field>
      </FieldGroup>
      {preview !== undefined ? (
        <p className="rounded-md bg-secondary p-3 text-sm" role="status">
          Replace {grams(balances(workspace).get(spool.id)!)} g with{" "}
          <strong>{grams(preview)} g</strong> remaining.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy
            ? "Saving…"
            : kind === "measurement"
              ? "Save measurement"
              : "Save consumption"}
        </Button>
        <Button type="button" variant="ghost" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <CopyDraft form={form} />
      </div>
    </form>
  );
}
