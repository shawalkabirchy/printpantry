import { readFile, mkdir, writeFile } from "node:fs/promises";
import { cpus, totalmem, platform, release } from "node:os";
import assert from "node:assert/strict";

const kind = process.argv[2];
assert(["functional", "performance", "branded"].includes(kind));
const report = JSON.parse(await readFile(kind === "branded" ? "test-results/branded.json" : "test-results/results.json", "utf8"));
function collect(suites) {
  return suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) => spec.tests.map((test) => ({ file: spec.file, title: spec.title, project: test.projectName, status: test.results.at(-1)?.status, durationMs: test.results.at(-1)?.duration, stdout: test.results.flatMap((result) => result.stdout ?? []).map((item) => item.text ?? "").join("") }))),
    ...collect(suite.suites ?? []),
  ]);
}
const cases = collect(report.suites).filter((item) => kind === "branded" || item.file.endsWith(kind === "functional" ? "app.spec.ts" : "performance.spec.ts"));
assert(cases.length > 0 && cases.every((item) => item.status === "passed"), "Every selected acceptance case must have passed.");
const evidence = { generatedAt: new Date().toISOString(), sourceRunStartedAt: report.stats.startTime, selectedCases: kind, note: "This summary includes only the named group. Functional and performance scenarios are reported separately; statuses are taken directly from Playwright results.", environment: { node: process.version, platform: platform(), release: release(), cpu: cpus()[0].model, logicalCores: cpus().length, memoryGiB: Math.round(totalmem() / 2 ** 30) }, passed: cases.length, cases };
await mkdir("docs/verification", { recursive: true });
await writeFile(`docs/verification/${kind}.json`, JSON.stringify(evidence, null, 2));
console.log(`Saved ${cases.length} passing ${kind} scenarios.`);
