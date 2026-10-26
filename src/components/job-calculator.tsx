"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Calculator } from "lucide-react";
import { AppError, candidates, grams, money, parseMass } from "@/lib/domain";
import { useWorkspace } from "./workspace-provider";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { FieldGroup } from "./ui/field";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { ErrorNotice, inputMass, TextField } from "./form-fields";

export function JobCalculator() {
  const { workspace, job, setJob } = useWorkspace();
  const [submitted, setSubmitted] = useState(Boolean(job.required));
  const [visibleCount, setVisibleCount] = useState(20);
  let failure: AppError | undefined;
  let results: ReturnType<typeof candidates> = [];
  if (submitted) {
    try {
      results = candidates(
        workspace,
        inputMass(job.required, "required"),
        inputMass(job.reserve, "reserve", true),
      );
    } catch (cause) {
      failure =
        cause instanceof AppError
          ? cause
          : new AppError("VALIDATION_ERROR", "Check the job quantities.");
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>A confident next print</h1>
          <p>Find the right spool. Know your material cost before you start.</p>
        </div>
      </header>
      <div className="calc-grid">
        <section className="panel" aria-labelledby="job-heading">
          <div className="mb-6 flex items-center gap-3">
            <Calculator className="text-primary" size={22} aria-hidden="true" />
            <h2 id="job-heading" className="text-lg font-semibold">
              Plan a job
            </h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
            noValidate
            className="flex flex-col gap-5"
          >
            <ErrorNotice message={failure?.message} />
            <FieldGroup>
              <TextField
                name="required"
                label="Required filament (g)"
                inputMode="decimal"
                value={job.required}
                onChange={(event) => {
                  setVisibleCount(20);
                  setJob((current) => ({
                    ...current,
                    required: event.target.value,
                  }));
                }}
                placeholder="e.g. 390"
                hint="The amount estimated by your slicer."
                error={failure?.fields.required}
                required
              />
              <TextField
                name="reserve"
                label="Safety reserve (g)"
                inputMode="decimal"
                value={job.reserve}
                onChange={(event) => {
                  setVisibleCount(20);
                  setJob((current) => ({
                    ...current,
                    reserve: event.target.value,
                  }));
                }}
                hint="A buffer for eligibility, not additional cost."
                error={failure?.fields.reserve}
                required
              />
            </FieldGroup>
            <Button type="submit">
              Find suitable spools
              <ArrowRight data-icon="inline-end" />
            </Button>
          </form>
          <p className="mt-6 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
            One spool per job. Check that its material and color suit your
            print. Estimates cover filament only; machine time, power, labor,
            and extra waste are excluded.
          </p>
        </section>
        <section
          className="panel"
          aria-labelledby="results-heading"
          aria-live="polite"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="results-heading" className="text-lg font-semibold">
              {submitted && !failure
                ? `${results.length} suitable spool${results.length === 1 ? "" : "s"}`
                : "Your next print, sorted"}
            </h2>
            {submitted && !failure && results.length > 0 ? (
              <Badge variant="secondary">
                <Check aria-hidden="true" data-icon="inline-start" />
                Least surplus first
              </Badge>
            ) : null}
          </div>
          {!submitted || failure ? (
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Calculator aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>A little planning goes a long way</EmptyTitle>
                <EmptyDescription>
                  Enter the filament your job needs. We’ll check your active
                  inventory, including a safety reserve.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : results.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No single spool has enough yet</EmptyTitle>
                <EmptyDescription>
                  This job needs{" "}
                  {grams(
                    parseMass(job.required) + parseMass(job.reserve, true),
                  )}{" "}
                  g including reserve. Try a fresh weighing, a smaller job, or
                  another spool.
                </EmptyDescription>
              </EmptyHeader>
              <Button asChild variant="outline">
                <Link href="/">
                  Open inventory
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </Empty>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each spool covers {job.required} g plus {job.reserve} g reserve.
                Costs use the required filament only.
              </p>
              {results
                .slice(0, visibleCount)
                .map(({ spool, remaining, surplus, cost }, index) => (
                  <article className="result-row" key={spool.id}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="spool-disc"
                        data-material={spool.material}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold">
                          {spool.label}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {spool.material} · {spool.colorName}
                          {index === 0 ? " · Closest fit" : ""}
                        </p>
                        <p className="mt-2 numeric text-xs">
                          {grams(remaining)} g available · {grams(surplus)} g
                          surplus
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="numeric text-xl font-semibold text-primary">
                        {money(cost, workspace.settings.currency)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        material only
                      </p>
                    </div>
                  </article>
                ))}
              {results.length > visibleCount ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                  <p className="text-xs text-muted-foreground">
                    Showing {visibleCount} of {results.length} suitable spools.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((count) => count + 20)}
                  >
                    Show next 20
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
      <p className="page-footer">
        A weighing updates your estimate. It never subtracts the same print
        twice.
      </p>
    </>
  );
}
