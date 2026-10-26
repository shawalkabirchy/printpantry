"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Calculator,
  HardDrive,
  Settings2,
  Spool,
  ExternalLink,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";

const navigation = [
  { href: "/", label: "Inventory", icon: Archive },
  { href: "/calculator/", label: "Job calculator", icon: Calculator },
  { href: "/settings/", label: "Settings & backup", icon: Settings2 },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    ready,
    busy,
    error,
    changedElsewhere,
    saved,
    epoch,
    recovery,
    reload,
    exportRecovery,
  } = useWorkspace();
  return (
    <div className="app-layout">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="PrintPantry home">
          <Spool size={29} strokeWidth={1.6} aria-hidden="true" />
          PrintPantry
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="nav-link"
              aria-current={
                pathname === href || `${pathname}/` === href
                  ? "page"
                  : undefined
              }
            >
              <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="flex items-center gap-2">
            <HardDrive size={13} aria-hidden="true" />
            Stored on this device
          </div>
          <a
            href="https://consolelog.studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
          >
            By ConsoleLog Studio <ExternalLink size={11} aria-hidden="true" />
          </a>
          <p className="mt-2 text-[11px]">Self-initiated studio project</p>
        </div>
      </aside>
      <main id="main" className="page" tabIndex={-1}>
        {error || changedElsewhere ? (
          <Alert
            variant={error ? "destructive" : "default"}
            className="mb-6"
            role="alert"
          >
            <AlertTitle>
              {error
                ? `Not saved · ${error.code}`
                : "Workspace changed in another tab"}
            </AlertTitle>
            <AlertDescription>
              <p>
                {error?.message ??
                  "Copy open form drafts before reloading. Your local view has not been overwritten."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void reload()}
                >
                  Reload (discard drafts)
                </Button>
                {recovery ? (
                  <Button size="sm" variant="outline" onClick={exportRecovery}>
                    Export unsaved recovery copy
                  </Button>
                ) : null}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        <div aria-live="polite" className="sr-only">
          {busy
            ? "Saving on this device…"
            : saved
              ? "Saved on this device"
              : ""}
        </div>
        {!ready ? (
          <div
            aria-busy="true"
            aria-label="Loading local inventory"
            className="flex flex-col gap-6"
          >
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div key={epoch}>{children}</div>
        )}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground">
          <span>
            {busy
              ? "Saving…"
              : error
                ? "Not saved — keep this tab open"
                : saved
                  ? "Saved on this device"
                  : "Local by design. Yours to keep."}
          </span>
          <a
            href="https://consolelog.studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Self-initiated project · ConsoleLog Studio ↗
          </a>
        </footer>
      </main>
    </div>
  );
}
