# PrintPantry walkthrough

The recording at `portfolio/walkthrough.webm` uses a new, isolated browser context with synthetic data. It has no credentials or real operator records. It captures the production export at 1440 × 960 and lasts **50.92 seconds**, verified with the bundled FFmpeg duration probe.

## Recording sequence and suggested narration

| Approximate point | On-screen action | Optional narration |
|---|---|---|
| Opening | Empty shelf, then load sample spools | “A clear shelf starts with knowing what is left.” |
| Job check | Enter 390 g with the default 10 g reserve | “This print needs 400 grams including a safety buffer. No spool fits yet.” |
| Fresh measurement | Weigh the sage spool at 600 g gross | “Subtract the 200 gram empty spool and review the new 400 gram estimate.” |
| Save and match | Save, then return to the calculator | “Now one spool fits. The material estimate uses the required filament only.” |
| Recovery | Open Settings and export the JSON backup | “The records stay in this browser. Keep a backup for recovery.” |
| Closing | Return to inventory | “PrintPantry. A self-initiated project by ConsoleLog Studio.” |

Use the actual captured duration when editing rather than claiming an exact timestamp from this outline. No voiceover is embedded by default. The recording can be captioned using the lines above.

## Regenerate

Build and start the production preview, then run `node scripts/capture.mjs`. The script also creates the five screenshots and sample/reset backups. Its assertions verify the expected shelf, match, material estimate, absence of page errors, and phone overflow boundary. Generated capture metadata is in `portfolio/capture.json`.
