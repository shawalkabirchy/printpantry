import { z } from "zod";

export const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "Other"] as const;
export const MAX_MASS = 50_000_000;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const mass = integer.max(MAX_MASS);
const timestamp = z.string().datetime();
const name = z.string().trim().min(1).max(80);
export const settingsSchema = z.strictObject({
  currency: z.enum(["USD", "BDT"]),
  schemaVersion: z.literal(1),
});
export const spoolSchema = z.strictObject({
  id: z.string().uuid(),
  label: name,
  brand: name,
  material: z.enum(MATERIALS),
  colorName: name,
  nominalMassMilliGrams: mass.positive(),
  tareMassMilliGrams: mass,
  purchaseCostMinor: integer.max(1_000_000_000),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const eventSchema = z.strictObject({
  id: z.string().uuid(),
  spoolId: z.string().uuid(),
  kind: z.enum(["initial", "measurement", "consumption"]),
  quantityMilliGrams: mass,
  note: z.string().max(1000),
  createdAt: timestamp,
  sequence: integer.positive(),
});
export type Spool = z.infer<typeof spoolSchema>;
export type InventoryEvent = z.infer<typeof eventSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Payload = {
  settings: Settings;
  spools: Spool[];
  events: InventoryEvent[];
};
export type Workspace = Payload & { revision: number };
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_FULL"
  | "STALE_LOCAL_STATE"
  | "IMPORT_INVALID"
  | "FILE_TOO_LARGE";
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const payloadSchema = z
  .strictObject({
    settings: settingsSchema,
    spools: z.array(spoolSchema).max(200),
    events: z.array(eventSchema).max(5000),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    const groups = new Map<string, InventoryEvent[]>();
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    for (const record of [...data.spools, ...data.events]) {
      if (ids.has(record.id)) issue("Duplicate record identifier.");
      ids.add(record.id);
    }
    const spools = new Map(data.spools.map((s) => [s.id, s]));
    for (const event of data.events) {
      if (!spools.has(event.spoolId))
        issue("An inventory event references a missing spool.");
      const group = groups.get(event.spoolId) ?? [];
      group.push(event);
      groups.set(event.spoolId, group);
    }
    for (const spool of data.spools) {
      const events = (groups.get(spool.id) ?? []).sort(
        (a, b) => a.sequence - b.sequence,
      );
      if (
        events.length === 0 ||
        events[0].kind !== "initial" ||
        events[0].sequence !== 1
      ) {
        issue("Every spool needs exactly one initial event at sequence 1.");
      }
      let remaining = 0;
      let previous = 0;
      for (const event of events) {
        if (
          event.sequence <= previous ||
          (event.kind === "initial" && previous !== 0)
        )
          issue("Inventory event sequences are inconsistent.");
        previous = event.sequence;
        if (event.kind === "consumption") {
          if (event.quantityMilliGrams === 0)
            issue("Consumption must be greater than zero.");
          remaining -= event.quantityMilliGrams;
        } else remaining = event.quantityMilliGrams;
        if (remaining < 0 || remaining > spool.nominalMassMilliGrams)
          issue("An inventory event creates an invalid remaining balance.");
      }
    }
  });

function parseSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
  code: ErrorCode = "VALIDATION_ERROR",
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues)
    fields[issue.path.join(".")] ??= issue.message;
  throw new AppError(
    code,
    result.error.issues[0]?.message ?? "Invalid data.",
    fields,
  );
}
export function validatePayload(value: unknown): Payload {
  return parseSchema(payloadSchema, value);
}
export function validateWorkspace(value: unknown): Workspace {
  const shape = z.strictObject({
    revision: integer,
    settings: settingsSchema,
    spools: z.array(spoolSchema).max(200),
    events: z.array(eventSchema).max(5000),
  });
  const parsed = parseSchema(shape, value);
  return {
    ...validatePayload({
      settings: parsed.settings,
      spools: parsed.spools,
      events: parsed.events,
    }),
    revision: parsed.revision,
  };
}
export function emptyWorkspace(): Workspace {
  return {
    revision: 0,
    settings: { currency: "USD", schemaVersion: 1 },
    spools: [],
    events: [],
  };
}
export function parseDecimal(
  value: string,
  decimals: number,
  max: number,
  allowZero = false,
): number {
  const cleaned = value.trim();
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(cleaned)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Enter a number with at most ${decimals} decimal places.`,
    );
  }
  const [whole, fraction = ""] = cleaned.split(".");
  const normalizedWhole = whole.replace(/^0+/, "") || "0";
  if (normalizedWhole.length > String(max).length)
    throw new AppError(
      "VALIDATION_ERROR",
      "Amount exceeds the supported limit.",
    );
  const parsed =
    BigInt(normalizedWhole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0"));
  if (parsed > BigInt(max) || parsed < (allowZero ? 0n : 1n)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Enter ${allowZero ? "zero or a positive amount" : "a positive amount"} within the supported limit.`,
    );
  }
  return Number(parsed);
}
export const parseMass = (value: string, allowZero = false) =>
  parseDecimal(value, 3, MAX_MASS, allowZero);
export const parseMoney = (value: string) =>
  parseDecimal(value, 2, 1_000_000_000, true);
export const grams = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(
    value / 1000,
  );
export const money = (value: number, currency: Settings["currency"]) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    value / 100,
  );
export function perGram(spool: Spool, currency: Settings["currency"]): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format((spool.purchaseCostMinor * 10) / spool.nominalMassMilliGrams);
}
export function balances(workspace: Payload): Map<string, number> {
  const result = new Map(workspace.spools.map((s) => [s.id, 0]));
  for (const event of [...workspace.events].sort(
    (a, b) => a.sequence - b.sequence,
  )) {
    result.set(
      event.spoolId,
      event.kind === "consumption"
        ? (result.get(event.spoolId) ?? 0) - event.quantityMilliGrams
        : event.quantityMilliGrams,
    );
  }
  return result;
}
export function jobCost(
  purchaseCostMinor: number,
  requiredMass: number,
  nominalMass: number,
): number {
  if (
    !Number.isSafeInteger(purchaseCostMinor) ||
    purchaseCostMinor < 0 ||
    !Number.isSafeInteger(requiredMass) ||
    requiredMass < 0 ||
    !Number.isSafeInteger(nominalMass) ||
    nominalMass <= 0
  )
    throw new AppError("VALIDATION_ERROR", "Invalid cost inputs.");
  const numerator = BigInt(purchaseCostMinor) * BigInt(requiredMass);
  const denominator = BigInt(nominalMass);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER))
    throw new AppError("VALIDATION_ERROR", "Calculated amount is too large.");
  return Number(rounded);
}
export function candidates(
  workspace: Payload,
  required: number,
  reserve: number,
) {
  if (
    !Number.isSafeInteger(required) ||
    required <= 0 ||
    required > MAX_MASS ||
    !Number.isSafeInteger(reserve) ||
    reserve < 0 ||
    reserve > MAX_MASS
  )
    throw new AppError("VALIDATION_ERROR", "Invalid job quantities.");
  const remaining = balances(workspace);
  return workspace.spools
    .filter(
      (s) => !s.archived && (remaining.get(s.id) ?? 0) >= required + reserve,
    )
    .map((spool) => ({
      spool,
      remaining: remaining.get(spool.id)!,
      surplus: remaining.get(spool.id)! - required - reserve,
      cost: jobCost(
        spool.purchaseCostMinor,
        required,
        spool.nominalMassMilliGrams,
      ),
    }))
    .sort(
      (a, b) =>
        a.surplus - b.surplus ||
        (a.spool.id < b.spool.id ? -1 : a.spool.id > b.spool.id ? 1 : 0),
    );
}
export type NewSpool = Pick<
  Spool,
  | "label"
  | "brand"
  | "material"
  | "colorName"
  | "nominalMassMilliGrams"
  | "tareMassMilliGrams"
  | "purchaseCostMinor"
> & { initialRemaining: number };
export function createSpool(workspace: Workspace, input: NewSpool): Workspace {
  const now = new Date().toISOString();
  const { initialRemaining, ...facts } = input;
  const spool = parseSchema(spoolSchema, {
    ...facts,
    id: crypto.randomUUID(),
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
  if (
    !Number.isSafeInteger(initialRemaining) ||
    initialRemaining < 0 ||
    initialRemaining > spool.nominalMassMilliGrams
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Initial remaining must be between zero and nominal mass.",
      { initialRemaining: "Cannot exceed nominal mass." },
    );
  return {
    ...workspace,
    spools: [...workspace.spools, spool],
    events: [
      ...workspace.events,
      {
        id: crypto.randomUUID(),
        spoolId: spool.id,
        kind: "initial",
        quantityMilliGrams: initialRemaining,
        note: "Opening balance",
        createdAt: now,
        sequence: 1,
      },
    ],
  };
}
export function appendEvent(
  workspace: Workspace,
  spoolId: string,
  kind: "measurement" | "consumption",
  quantity: number,
  note: string,
): Workspace {
  const spool = workspace.spools.find((s) => s.id === spoolId);
  if (!spool)
    throw new AppError(
      "VALIDATION_ERROR",
      "This spool no longer exists. Reload inventory.",
    );
  const current = balances(workspace).get(spoolId)!;
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    quantity > MAX_MASS ||
    (kind === "consumption" && (quantity === 0 || quantity > current)) ||
    (kind === "measurement" && quantity > spool.nominalMassMilliGrams)
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "This entry would create an invalid filament balance.",
    );
  const now = new Date().toISOString();
  const sequence =
    Math.max(
      ...workspace.events
        .filter((e) => e.spoolId === spoolId)
        .map((e) => e.sequence),
    ) + 1;
  const event = parseSchema(eventSchema, {
    id: crypto.randomUUID(),
    spoolId,
    kind,
    quantityMilliGrams: quantity,
    note: note.trim(),
    createdAt: now,
    sequence,
  });
  return {
    ...workspace,
    spools: workspace.spools.map((s) =>
      s.id === spoolId ? { ...s, updatedAt: now } : s,
    ),
    events: [...workspace.events, event],
  };
}
export function measuredRemaining(spool: Spool, gross: number): number {
  if (
    !Number.isSafeInteger(gross) ||
    gross <= 0 ||
    gross > MAX_MASS ||
    gross < spool.tareMassMilliGrams ||
    gross - spool.tareMassMilliGrams > spool.nominalMassMilliGrams
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Gross weight must cover the tare and leave no more than the nominal filament mass.",
    );
  return gross - spool.tareMassMilliGrams;
}
export function setArchived(
  workspace: Workspace,
  id: string,
  archived: boolean,
): Workspace {
  return {
    ...workspace,
    spools: workspace.spools.map((s) =>
      s.id === id ? { ...s, archived, updatedAt: new Date().toISOString() } : s,
    ),
  };
}
export function deleteSpool(workspace: Workspace, id: string): Workspace {
  return {
    ...workspace,
    spools: workspace.spools.filter((s) => s.id !== id),
    events: workspace.events.filter((e) => e.spoolId !== id),
  };
}
export function setCurrency(
  workspace: Workspace,
  currency: Settings["currency"],
): Workspace {
  if (workspace.spools.length > 0 && workspace.settings.currency !== currency)
    throw new AppError(
      "VALIDATION_ERROR",
      "Currency is locked while the workspace contains spools.",
    );
  return { ...workspace, settings: { ...workspace.settings, currency } };
}
export function backup(workspace: Payload): string {
  const payload = validatePayload({
    settings: workspace.settings,
    spools: workspace.spools,
    events: workspace.events,
  });
  const text = JSON.stringify(
    {
      appId: "P03",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      payload,
    },
    null,
    2,
  );
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new AppError(
      "FILE_TOO_LARGE",
      "This change would exceed the 10 MiB workspace backup limit. Shorten this entry before saving.",
    );
  return text;
}
export function parseBackup(text: string): Payload {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new AppError("FILE_TOO_LARGE", "Backups must be 10 MiB or smaller.");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new AppError("IMPORT_INVALID", "This file is not valid JSON.");
  }
  return parseSchema(
    z.strictObject({
      appId: z.literal("P03"),
      formatVersion: z.literal(1),
      exportedAt: timestamp,
      payload: payloadSchema,
    }),
    input,
    "IMPORT_INVALID",
  ).payload;
}
export function addSamples(workspace: Workspace): Workspace {
  const rows = [
    [
      "a0000000-0000-4000-8000-000000000001",
      "Sage workshop PLA",
      "PLA",
      "Sage",
      350_000,
    ],
    [
      "a0000000-0000-4000-8000-000000000002",
      "Terracotta PETG",
      "PETG",
      "Terracotta",
      250_000,
    ],
    [
      "a0000000-0000-4000-8000-000000000003",
      "Chalk TPU",
      "TPU",
      "Chalk",
      120_000,
    ],
  ] as const;
  let result = workspace;
  for (const [id, label, material, colorName, initialRemaining] of rows) {
    if (result.spools.some((s) => s.id === id)) continue;
    const created = createSpool(result, {
      label,
      brand: "Sample studio",
      material,
      colorName,
      nominalMassMilliGrams: 1_000_000,
      tareMassMilliGrams: 200_000,
      purchaseCostMinor: workspace.settings.currency === "USD" ? 2000 : 250000,
      initialRemaining,
    });
    const temporaryId = created.spools.at(-1)!.id;
    result = {
      ...created,
      spools: created.spools.map((s) =>
        s.id === temporaryId ? { ...s, id } : s,
      ),
      events: created.events.map((e) =>
        e.spoolId === temporaryId ? { ...e, spoolId: id } : e,
      ),
    };
  }
  return result;
}
