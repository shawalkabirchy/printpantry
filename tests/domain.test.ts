import { describe, expect, test } from "vitest";
import {
  addSamples,
  appendEvent,
  backup,
  balances,
  candidates,
  createSpool,
  deleteSpool,
  emptyWorkspace,
  jobCost,
  measuredRemaining,
  parseBackup,
  parseMass,
  parseMoney,
  setArchived,
  setCurrency,
  validatePayload,
  type Workspace,
} from "../src/lib/domain";

function fullSpool(): Workspace {
  return createSpool(emptyWorkspace(), {
    label: "Workshop",
    brand: "Test",
    material: "PLA",
    colorName: "Green",
    nominalMassMilliGrams: 1_000_000,
    tareMassMilliGrams: 200_000,
    purchaseCostMinor: 2000,
    initialRemaining: 1_000_000,
  });
}
describe("P03 calculations and integrity", () => {
  test("P03-A1: gross minus tare, with both invalid boundaries", () => {
    const spool = fullSpool().spools[0];
    expect(measuredRemaining(spool, parseMass("600"))).toBe(400_000);
    expect(() => measuredRemaining(spool, 150_000)).toThrow();
    expect(() => measuredRemaining(spool, 1_201_000)).toThrow();
  });
  test("P03-A2: a weighing replaces the estimate without double subtraction", () => {
    let state = fullSpool();
    const id = state.spools[0].id;
    state = appendEvent(state, id, "consumption", 100_000, "Print");
    expect(balances(state).get(id)).toBe(900_000);
    state = appendEvent(state, id, "measurement", 850_000, "Correction");
    expect(balances(state).get(id)).toBe(850_000);
    expect(state.events.map((e) => e.sequence)).toEqual([1, 2, 3]);
  });
  test("P03-A3: exact reserve boundary, stable sort, and archive exclusion", () => {
    let state = addSamples(emptyWorkspace());
    state = appendEvent(state, state.spools[0].id, "measurement", 400_000, "");
    expect(candidates(state, 390_000, 10_000)).toHaveLength(1);
    expect(candidates(state, 391_000, 10_000)).toHaveLength(0);
    state = appendEvent(state, state.spools[1].id, "measurement", 400_000, "");
    expect(candidates(state, 390_000, 10_000).map((c) => c.spool.id)).toEqual(
      state.spools.slice(0, 2).map((s) => s.id),
    );
    expect(
      candidates(setArchived(state, state.spools[0].id, true), 390_000, 10_000),
    ).toHaveLength(1);
  });
  test("P03-A4: exact material-only costs and upward ties", () => {
    expect(jobCost(2000, 100_000, 1_000_000)).toBe(200);
    expect(jobCost(1, 1, 2)).toBe(1);
    expect(jobCost(1_000_000_000, 49_999_999, 50_000_000)).toBe(999_999_980);
    expect(candidates(fullSpool(), 100_000, 0)[0].cost).toBe(
      candidates(fullSpool(), 100_000, 100_000)[0].cost,
    );
  });
  test("P03-A5: reject unsafe precision and invalid consumption", () => {
    expect(parseMass("0.001")).toBe(1);
    expect(parseMoney("0.29")).toBe(29);
    for (const value of [
      "1.0001",
      "-1",
      "1e3",
      "NaN",
      "50000.001",
      "0",
      "Infinity",
    ])
      expect(() => parseMass(value)).toThrow();
    expect(parseMass("0", true)).toBe(0);
    expect(() => parseMoney("1.001")).toThrow();
    const state = fullSpool();
    expect(() =>
      appendEvent(state, state.spools[0].id, "consumption", 1_000_001, ""),
    ).toThrow();
    expect(() =>
      appendEvent(state, state.spools[0].id, "consumption", 0, ""),
    ).toThrow();
    expect(() => setCurrency(state, "BDT")).toThrow();
    expect(deleteSpool(state, state.spools[0].id).events).toEqual([]);
  });
  test("P03-A6: backups round-trip and malformed ledgers fail", () => {
    const state = fullSpool();
    const restored = parseBackup(backup(state));
    expect(restored.events).toEqual(state.events);
    expect(balances(restored)).toEqual(balances(state));
    for (const envelope of [
      "{}",
      backup(state).replace('"P03"', '"P01"'),
      backup(state).replace('"formatVersion": 1', '"formatVersion": 2'),
    ])
      expect(() => parseBackup(envelope)).toThrow();
    expect(() => validatePayload({ ...restored, events: [] })).toThrow();
    expect(() =>
      validatePayload({
        ...restored,
        events: [...restored.events, restored.events[0]],
      }),
    ).toThrow();
    expect(() =>
      validatePayload({
        ...restored,
        events: [{ ...restored.events[0], spoolId: crypto.randomUUID() }],
      }),
    ).toThrow();
    expect(() => parseBackup(" ".repeat(10 * 1024 * 1024 + 1))).toThrow();
  });
  test("samples append safely and repeat without duplication", () => {
    const state = addSamples(fullSpool());
    expect(addSamples(state).spools).toHaveLength(4);
    expect(state.spools[0].label).toBe("Workshop");
    expect(candidates(addSamples(emptyWorkspace()), 390_000, 10_000)).toEqual(
      [],
    );
    const payload = parseBackup(backup(state));
    expect(() =>
      validatePayload({ ...payload, spools: Array(201).fill(state.spools[0]) }),
    ).toThrow();
    expect(() =>
      validatePayload({
        ...payload,
        events: Array(5001).fill(state.events[0]),
      }),
    ).toThrow();
  });
  test("corrupt sequences and oversized UTF-8 backups cannot replace valid records", () => {
    const state = fullSpool();
    const payload = {
      settings: state.settings,
      spools: state.spools,
      events: state.events,
    };
    expect(() =>
      validatePayload({
        ...payload,
        events: [
          ...state.events,
          { ...state.events[0], id: crypto.randomUUID(), sequence: 2 },
        ],
      }),
    ).toThrow();
    expect(() =>
      validatePayload({
        ...payload,
        events: [
          ...state.events,
          {
            ...state.events[0],
            id: crypto.randomUUID(),
            kind: "measurement",
            sequence: 1,
          },
        ],
      }),
    ).toThrow();
    const large = { ...state, events: [...state.events] };
    for (let sequence = 2; sequence <= 5000; sequence++)
      large.events.push({
        ...state.events[0],
        id: crypto.randomUUID(),
        kind: "measurement",
        sequence,
        note: "中".repeat(1000),
      });
    expect(() => backup(large)).toThrow(/10 MiB/);
    expect(parseMass("0000000000000000000000001")).toBe(1000);
    expect(() => parseMass("9".repeat(10000))).toThrow();
  });
});
