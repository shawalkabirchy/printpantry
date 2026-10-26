import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  workers: 1,
  timeout: 60_000,
  grep: /create → consume|portfolio demo/,
  reporter: [["list"], ["json", { outputFile: "test-results/branded.json" }]],
  projects: [
    { name: "Google Chrome", use: { channel: "chrome" } },
    { name: "Microsoft Edge", use: { channel: "msedge" } },
  ],
});
