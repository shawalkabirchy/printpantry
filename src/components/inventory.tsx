"use client";
import { useMemo, useRef, useState } from "react";
import { Spool, ArrowUpRight, FlaskConical } from "lucide-react";
import {
  addSamples,
  balances,
  grams,
  MATERIALS,
  perGram,
  type Spool as SpoolRecord,
} from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { SpoolArt } from "./spool-art";
import { NewSpoolDialog } from "./new-spool-dialog";
import { SpoolDetails } from "./spool-details";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";

export function Inventory() {
  const { workspace, save, busy } = useWorkspace();
  const [material, setMaterial] = useState("All");
  const [color, setColor] = useState("");
  const [status, setStatus] = useState("active");
  const [selected, setSelected] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const remaining = useMemo(() => balances(workspace), [workspace]);
  const active = workspace.spools.filter((spool) => !spool.archived);
  const filtered = workspace.spools.filter(
    (spool) =>
      (material === "All" || spool.material === material) &&
      spool.colorName.toLowerCase().includes(color.trim().toLowerCase()) &&
      (status === "all" || spool.archived === (status === "archived")),
  );
  const viewed = workspace.spools.find((spool) => spool.id === selected);
  function view(
    spool: SpoolRecord,
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    opener.current = event.currentTarget;
    setSelected(spool.id);
  }
  function balance(spool: SpoolRecord) {
    const amount = remaining.get(spool.id)!;
    return (
      <div>
        <p className="numeric text-[13px]">
          {grams(amount)} g{" "}
          <span className="text-muted-foreground">
            / {grams(spool.nominalMassMilliGrams)} g (
            {Math.round((amount / spool.nominalMassMilliGrams) * 100)}%)
          </span>
        </p>
        <div className="balance-bar" aria-hidden="true">
          <span
            style={{
              width: `${(amount / spool.nominalMassMilliGrams) * 100}%`,
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Filament inventory</h1>
          <p>Know what’s on the shelf before your next print.</p>
        </div>
        <NewSpoolDialog />
      </header>
      <section className="intro-strip" aria-label="Your workshop">
        <div>
          <h2>Make room for your next idea.</h2>
          <p>A clear shelf. A confident start.</p>
        </div>
        <SpoolArt />
      </section>
      <div className="inventory-summary">
        <span>
          <strong>{active.length}</strong> active spool
          {active.length === 1 ? "" : "s"}
        </span>
        <span className="hidden h-6 border-l sm:block" aria-hidden="true" />
        <span>
          <strong>
            {grams(
              active.reduce((sum, spool) => sum + remaining.get(spool.id)!, 0),
            )}{" "}
            g
          </strong>{" "}
          on hand
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {workspace.settings.currency} workspace
        </span>
      </div>
      {workspace.spools.length === 0 ? (
        <Empty className="empty-inventory">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spool aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Your shelf starts here</EmptyTitle>
            <EmptyDescription>
              Add your first spool, or try three sample spools to see how
              weighing and job planning work. Your records stay in this browser.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void save(addSamples)}
            >
              <FlaskConical data-icon="inline-start" />
              Load sample spools
            </Button>
            <p className="text-xs text-muted-foreground">
              Synthetic examples. No printer or scale needed.
            </p>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div
            className="inventory-toolbar"
            role="group"
            aria-label="Inventory filters"
          >
            <label className="sr-only" htmlFor="filter-material">
              Filter by material
            </label>
            <select
              id="filter-material"
              className="filter"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            >
              <option value="All">All materials</option>
              {MATERIALS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="filter-color">
              Filter by color
            </label>
            <input
              id="filter-color"
              className="filter"
              value={color}
              maxLength={80}
              placeholder="Filter by color…"
              onChange={(event) => setColor(event.target.value)}
            />
            <label className="sr-only" htmlFor="filter-status">
              Filter by status
            </label>
            <select
              id="filter-status"
              className="filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="active">Active spools</option>
              <option value="archived">Archived spools</option>
              <option value="all">All statuses</option>
            </select>
            <span
              className="ml-auto text-xs text-muted-foreground"
              aria-live="polite"
            >
              {filtered.length} shown
            </span>
          </div>
          {filtered.length === 0 ? (
            <Empty className="empty-inventory">
              <EmptyHeader>
                <EmptyTitle>No spools match these filters</EmptyTitle>
                <EmptyDescription>
                  Try a different material, color, or status.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMaterial("All");
                    setColor("");
                    setStatus("active");
                  }}
                >
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="desktop-spools overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Spool</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Cost / gram</TableHead>
                      <TableHead>
                        <span className="sr-only">Details</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((spool) => (
                      <TableRow key={spool.id}>
                        <TableCell className="py-6 pl-5">
                          <div className="flex items-center gap-4">
                            <div
                              className="spool-disc"
                              data-material={spool.material}
                              aria-hidden="true"
                            />
                            <div className="max-w-[230px]">
                              <p className="whitespace-normal break-words font-semibold">
                                {spool.label}
                              </p>
                              <p className="mt-1 whitespace-normal text-xs text-muted-foreground">
                                {spool.brand} · {spool.colorName}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{spool.material}</Badge>
                        </TableCell>
                        <TableCell>{balance(spool)}</TableCell>
                        <TableCell className="numeric text-[13px]">
                          {perGram(spool, workspace.settings.currency)}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`View ${spool.label}`}
                            onClick={(event) => view(spool, event)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mobile-spools">
                {filtered.map((spool) => (
                  <article className="panel" key={spool.id}>
                    <div className="mb-5 flex items-center gap-3">
                      <div
                        className="spool-disc"
                        data-material={spool.material}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="break-words text-base font-semibold">
                          {spool.label}
                        </h2>
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {spool.brand} · {spool.colorName}
                        </p>
                      </div>
                    </div>
                    {balance(spool)}
                    <div className="mt-5 flex items-center justify-between gap-2">
                      <Badge variant="secondary">{spool.material}</Badge>
                      <span className="numeric text-xs">
                        {perGram(spool, workspace.settings.currency)} / g
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`View ${spool.label}`}
                        onClick={(event) => view(spool, event)}
                      >
                        View
                        <ArrowUpRight data-icon="inline-end" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <p className="page-footer">
        Measurements are estimates. A fresh weighing keeps things accurate.
      </p>
      {viewed ? (
        <SpoolDetails
          key={viewed.id}
          spool={viewed}
          close={() => setSelected(null)}
          opener={opener.current}
        />
      ) : null}
    </>
  );
}
