import { z } from "zod";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export const PRESETS = [7, 28, 90] as const;
export const MAX_RANGE_DAYS = 365;
/** Jendela snapshot audiens yang disinkron (hemat kuota). Rentang pengguna dipetakan ke jendela terdekat. */
export const AUDIENCE_WINDOWS = [28, 90] as const;
export const audienceWindowFor = (days: number): 28 | 90 => (days > 45 ? 90 : 28);
export const DEFAULT_PRESET = 28;
/** Data YouTube Analytics 2-3 hari terakhir belum final. */
export const PARTIAL_DAYS = 3;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const rangeQuerySchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: "Tanggal awal harus sebelum tanggal akhir", path: ["from"] });

export const fmt = (d: Date) => format(d, "yyyy-MM-dd");
export const toUtcDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const todayUtc = (now = new Date()) => fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));

export type Period = {
  from: string;
  to: string;
  days: number;
  compareFrom: string;
  compareTo: string;
};

/** Rentang aktif + periode pembanding dengan durasi sama persis, mundur ke belakang. Clamp ke hari ini. */
export function resolvePeriod(input: { from?: string; to?: string }, now = new Date()): Period {
  const today = todayUtc(now);
  let to = input.to ?? today;
  if (to > today) to = today;
  let from = input.from ?? fmt(addDays(parseISO(to), -(DEFAULT_PRESET - 1)));
  if (from > to) from = to;
  let days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  if (days > MAX_RANGE_DAYS) {
    from = fmt(addDays(parseISO(to), -(MAX_RANGE_DAYS - 1)));
    days = MAX_RANGE_DAYS;
  }
  const compareTo = fmt(addDays(parseISO(from), -1));
  const compareFrom = fmt(addDays(parseISO(compareTo), -(days - 1)));
  return { from, to, days, compareFrom, compareTo };
}

export function presetPeriod(days: number, now = new Date()): Period {
  const to = todayUtc(now);
  return resolvePeriod({ from: fmt(addDays(parseISO(to), -(days - 1))), to }, now);
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = parseISO(from); fmt(d) <= to; d = addDays(d, 1)) out.push(fmt(d));
  return out;
}

export type Delta = { value: number | null; previous: number | null; deltaAbs: number | null; deltaPct: number | null };

/** delta % = (current - previous) / |previous| * 100; previous = 0 atau null => N/A (null), tidak pernah Infinity. */
export function delta(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null) return { value: current, previous, deltaAbs: null, deltaPct: null };
  const deltaAbs = current - previous;
  const deltaPct = previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  return { value: current, previous, deltaAbs, deltaPct };
}

export function isPartialDate(date: string, now = new Date()) {
  return date > fmt(addDays(parseISO(todayUtc(now)), -PARTIAL_DAYS));
}
