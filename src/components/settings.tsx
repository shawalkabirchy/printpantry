"use client";
import { useRef, useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  FlaskConical,
  LockKeyhole,
} from "lucide-react";
import {
  addSamples,
  AppError,
  backup,
  MAX_BACKUP_BYTES,
  parseBackup,
  setCurrency,
  type Payload,
  type Settings as SettingsType,
} from "@/lib/domain";
import { downloadText } from "@/lib/download";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field";
import { Alert, AlertDescription } from "./ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { ErrorNotice } from "./form-fields";

export function Settings() {
  const { workspace, save, busy, error } = useWorkspace();
  const [failure, setFailure] = useState<string>();
  const [preview, setPreview] = useState<{
    payload: Payload;
    revision: number;
  } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function exportBackup() {
    try {
      downloadText(
        backup(workspace),
        `printpantry-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
    } catch (cause) {
      setFailure((cause as Error).message);
    }
  }
  async function inspect(file?: File) {
    setFailure(undefined);
    setPreview(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setFailure("FILE_TOO_LARGE: Backups must be 10 MiB or smaller.");
      if (input.current) input.current.value = "";
      return;
    }
    setReading(true);
    const revision = workspace.revision;
    try {
      const payload = parseBackup(await file.text());
      setPreview({ payload, revision });
    } catch (cause) {
      setFailure(
        cause instanceof AppError
          ? `${cause.code}: ${cause.message}`
          : "The backup could not be read. Your records have not changed.",
      );
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>A home for your records</h1>
          <p>A few preferences. A reliable backup. All on your device.</p>
        </div>
      </header>
      <div className="settings-grid">
        <div className="flex flex-col gap-6">
          <section className="panel" aria-labelledby="currency-heading">
            <h2 id="currency-heading" className="text-lg font-semibold">
              Workspace currency
            </h2>
            <p className="mt-2 mb-5 text-sm leading-relaxed text-muted-foreground">
              Choose before adding spools. Financial records share one currency;
              no exchange-rate conversion happens.
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="currency">Currency</FieldLabel>
                <select
                  id="currency"
                  className="filter w-full"
                  value={workspace.settings.currency}
                  disabled={workspace.spools.length > 0 || busy}
                  onChange={(event) =>
                    void save((state) =>
                      setCurrency(
                        state,
                        event.target.value as SettingsType["currency"],
                      ),
                    )
                  }
                >
                  <option value="USD">USD — US dollar</option>
                  <option value="BDT">BDT — Bangladeshi taka</option>
                </select>
                <FieldDescription>
                  {workspace.spools.length > 0
                    ? "Locked while the workspace contains financial records, including archived spools."
                    : "Amounts accept up to two decimal places."}
                </FieldDescription>
              </Field>
            </FieldGroup>
            {workspace.spools.length > 0 ? (
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <LockKeyhole size={13} aria-hidden="true" />
                One currency keeps your estimates meaningful.
              </p>
            ) : null}
          </section>
          <section className="panel" aria-labelledby="privacy-heading">
            <div className="flex items-center gap-2">
              <ShieldCheck
                size={20}
                aria-hidden="true"
                className="text-primary"
              />
              <h2 id="privacy-heading" className="text-lg font-semibold">
                Local by design
              </h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Your inventory and backup files stay in this browser. There are no
              accounts, uploads, analytics, or cloud synchronization.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Clearing site data, browser eviction, a different browser profile,
              or a different site address can make these records unavailable.
              Download backups regularly and keep them somewhere safe.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Workspace: {workspace.spools.length}/200 spools ·{" "}
              {workspace.events.length}/5,000 ledger entries
            </p>
          </section>
          <section className="panel" aria-labelledby="sample-heading">
            <h2 id="sample-heading" className="text-lg font-semibold">
              Try a little sample shelf
            </h2>
            <p className="mt-2 mb-5 text-sm leading-relaxed text-muted-foreground">
              Add three synthetic spools without replacing your records. Loading
              them again skips samples already present. Sample prices illustrate
              the chosen currency.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void save(addSamples)}
            >
              <FlaskConical data-icon="inline-start" />
              Load sample spools
            </Button>
          </section>
        </div>
        <section className="panel" aria-labelledby="backup-heading">
          <h2 id="backup-heading" className="text-lg font-semibold">
            Keep a copy of your shelf
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            One JSON file contains your settings, spools, and complete
            measurement history. You can restore it in another browser.
          </p>
          <Button className="mt-5" onClick={exportBackup} disabled={busy}>
            <Download data-icon="inline-start" />
            Export backup
          </Button>
          <div className="my-7 border-t" />
          <h3 className="font-semibold">Restore from a backup</h3>
          <p className="mt-2 mb-5 text-sm leading-relaxed text-muted-foreground">
            We’ll validate the file and show its contents before asking to
            replace this workspace. Maximum file size: 10 MiB.
          </p>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="backup-file">
                <Upload size={15} aria-hidden="true" />
                Import backup
              </FieldLabel>
              <input
                ref={input}
                id="backup-file"
                type="file"
                accept=".json,application/json"
                disabled={busy || reading}
                className="block w-full min-w-0 text-xs file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-2"
                onChange={(event) => void inspect(event.target.files?.[0])}
              />
            </Field>
          </FieldGroup>
          <div className="mt-5">
            <ErrorNotice message={failure} />
          </div>
          {reading ? (
            <p role="status" className="mt-4 text-sm">
              Validating backup…
            </p>
          ) : null}
          {preview ? (
            <div className="mt-5 rounded-lg border bg-muted/50 p-4">
              <h4 className="font-semibold">Backup ready to review</h4>
              <p className="mt-2 text-sm">
                {preview.payload.spools.length} spools ·{" "}
                {preview.payload.events.length} ledger entries ·{" "}
                {preview.payload.settings.currency}
              </p>
              <Alert className="mt-4">
                <AlertDescription>
                  This replaces your {workspace.spools.length} current spools
                  and {workspace.events.length} entries. Export a backup of the
                  current workspace first.
                </AlertDescription>
              </Alert>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={exportBackup}>
                  Back up current workspace
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirm(true)}
                >
                  Review replacement
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreview(null)}
                >
                  Cancel import
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Replace all current records with {preview?.payload.spools.length}{" "}
              spools and {preview?.payload.events.length} ledger entries from
              this backup. This does not merge records. Keep a backup of the
              current workspace before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ErrorNotice message={error?.message} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              Keep current workspace
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !preview}
              onClick={async (event) => {
                event.preventDefault();
                if (
                  preview &&
                  (await save(
                    (state) => ({
                      ...preview.payload,
                      revision: state.revision,
                    }),
                    preview.revision,
                  ))
                ) {
                  setConfirm(false);
                  setPreview(null);
                }
              }}
            >
              Replace current workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
