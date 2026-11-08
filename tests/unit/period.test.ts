import { describe, expect, it } from "vitest";
import { delta, eachDate, isPartialDate, presetPeriod, rangeQuerySchema, resolvePeriod } from "@/lib/analytics/period";

const NOW = new Date("2026-11-06T10:00:00Z");

describe("periode pembanding", () => {
  it.each([
    [7, "2026-10-31", "2026-11-06", "2026-10-24", "2026-10-30"],
    [28, "2026-10-10", "2026-11-06", "2026-09-12", "2026-10-09"],
    [90, "2026-08-09", "2026-11-06", "2026-05-11", "2026-08-08"],
  ])("preset %i hari: pembanding sama panjang tepat sebelum periode", (n, from, to, cFrom, cTo) => {
    const p = presetPeriod(n, NOW);
    expect(p).toMatchObject({ from, to, days: n, compareFrom: cFrom, compareTo: cTo });
    expect(eachDate(p.compareFrom, p.compareTo)).toHaveLength(n);
  });

  it("default 28 hari, rentang masa depan di-clamp ke hari ini", () => {
    expect(resolvePeriod({}, NOW).days).toBe(28);
    const p = resolvePeriod({ from: "2026-11-01", to: "2026-12-31" }, NOW);
    expect(p.to).toBe("2026-11-06");
    expect(p.days).toBe(6);
    expect(p.compareTo).toBe("2026-10-31");
    expect(p.compareFrom).toBe("2026-10-26");
  });

  it("kustom dibatasi 365 hari", () => {
    expect(resolvePeriod({ from: "2020-01-01", to: "2026-11-06" }, NOW).days).toBe(365);
  });

  it("validasi: from > to ditolak, format salah ditolak", () => {
    expect(rangeQuerySchema.safeParse({ from: "2026-11-05", to: "2026-11-01" }).success).toBe(false);
    expect(rangeQuerySchema.safeParse({ from: "05-11-2026" }).success).toBe(false);
  });
});

describe("delta", () => {
  it("menghitung absolut dan persen", () => {
    expect(delta(112, 100)).toEqual({ value: 112, previous: 100, deltaAbs: 12, deltaPct: 12 });
    expect(delta(90, 100).deltaPct).toBe(-10);
    expect(delta(-5, -10).deltaPct).toBe(50); // |previous|
  });
  it("previous = 0 => N/A, tidak pernah Infinity", () => {
    const d = delta(50, 0);
    expect(d.deltaPct).toBeNull();
    expect(d.deltaAbs).toBe(50);
  });
  it("previous tidak ada => null", () => {
    expect(delta(5, null)).toEqual({ value: 5, previous: null, deltaAbs: null, deltaPct: null });
  });
  it("3 hari terakhir belum final", () => {
    expect(isPartialDate("2026-11-04", NOW)).toBe(true);
    expect(isPartialDate("2026-11-03", NOW)).toBe(false);
  });
});
