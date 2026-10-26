import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const notices = [
  "PrintPantry — third-party notices\n",
  "Copied shadcn/ui components (https://github.com/shadcn-ui/ui):\n" +
    (await readFile("docs/shadcn-license.txt", "utf8")),
];
let count = 0;
for (const [path, entry] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!path.startsWith("node_modules/") || entry.dev) continue;
  const root = resolve(path);
  let files;
  try {
    files = await readdir(root);
  } catch {
    continue;
  }
  const metadata = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const licenseFiles = files.filter((name) =>
    /^(license|licence|copying|notice)([._-]|$)/i.test(name),
  );
  const texts = [];
  for (const name of licenseFiles) {
    try {
      texts.push(await readFile(resolve(root, name), "utf8"));
    } catch {
      /* Some packages use a licenses directory; retain their package identifier below. */
    }
  }
  notices.push(
    `\n${"=".repeat(72)}\n${metadata.name}@${metadata.version}\nLicense: ${metadata.license ?? entry.license ?? "See package distribution"}\n${texts.join("\n")}`,
  );
  count++;
}
assert(
  count > 0,
  "Runtime dependencies must be installed before generating notices.",
);
const output = notices.join("\n");
assert(output.includes("Copyright (c) 2023 shadcn"));
assert(output.includes("react@"));
await mkdir("public", { recursive: true });
await writeFile("public/third-party-notices.txt", output);
console.log(
  `Retained notices for ${count} installed runtime dependency packages and shadcn/ui.`,
);
