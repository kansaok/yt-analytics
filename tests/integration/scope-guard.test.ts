import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Redis from "ioredis";
import { Queue } from "bullmq";

/**
 * Bukti task Fase 2 yang menahan fitur di luar Scope MVP: ekspor PDF/Excel, laporan terjadwal,
 * dan filter lanjutan. Memeriksa repo, dependensi, dan antrean BullMQ/Redis yang sungguhan.
 */
const root = join(__dirname, "..", "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const rel = (p: string) => p.slice(root.length + 1);

describe("Ekspor PDF/Excel tidak ada di MVP", () => {
  it("tidak ada Route Handler unduhan/ekspor/laporan di app/api", () => {
    const routes = walk(join(root, "app", "api")).map(rel);
    const offenders = routes.filter((r) => /(export|report|pdf|xlsx|excel|download|schedule)/i.test(r));
    expect(offenders).toEqual([]);
  });
  it("tidak ada dependensi pembuat PDF/Excel/email", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /^(pdfkit|exceljs|xlsx|@react-pdf\/renderer|puppeteer|resend|@sendgrid\/.*|nodemailer)$/.test(d))).toEqual([]);
  });
  it("tidak ada kode yang mengimpor generator ekspor/email, dan tidak ada tombol ekspor di UI", () => {
    const files = [...walk(join(root, "app")), ...walk(join(root, "components")), ...walk(join(root, "lib"))].filter((f) => /\.(ts|tsx)$/.test(f));
    const hits = files.filter((f) => /from "(pdfkit|exceljs|resend|nodemailer|@react-pdf\/renderer)"|Ekspor PDF|Unduh Excel|Kirim laporan/.test(readFileSync(f, "utf8")));
    expect(hits.map(rel)).toEqual([]);
  });
});

describe("Laporan terjadwal tidak berjalan di antrean BullMQ / Redis", () => {
  it("hanya antrean sync yang ada; satu-satunya scheduler adalah sinkronisasi (incremental-all)", async () => {
    const conn = new Redis("redis://localhost:6381/0", { maxRetriesPerRequest: null });
    try {
      const metaKeys = await conn.keys("bull:*:meta");
      const queues = metaKeys.map((k) => k.split(":")[1]).sort();
      expect(queues.every((q) => /^sync-(initial|incremental|scheduler)$/.test(q)), `antrean ditemukan: ${queues.join(", ")}`).toBe(true);
      expect(queues.filter((q) => /report|email|export|digest/i.test(q))).toEqual([]);

      const sched = new Queue("sync-scheduler", { connection: conn });
      const schedulers = await sched.getJobSchedulers();
      expect(schedulers.map((s) => s.key ?? s.name)).toEqual(expect.not.arrayContaining(["weekly", "monthly", "report"]));
      for (const s of schedulers) expect(["incremental-all"]).toContain(s.key ?? s.name);
      await sched.close();

      // tidak ada job (apa pun statusnya) yang menyebut laporan/email
      for (const q of ["sync-initial", "sync-incremental", "sync-scheduler"]) {
        const qq = new Queue(q, { connection: conn });
        const jobs = await qq.getJobs(["waiting", "delayed", "active", "completed", "failed", "prioritized"], 0, 200);
        expect(jobs.filter((j) => /report|email|mingguan|bulanan/i.test(JSON.stringify(j.data) + j.name))).toEqual([]);
        await qq.close();
      }
    } finally {
      conn.disconnect();
    }
  });
});

describe("Filter tanggal kustom dibatasi", () => {
  it("UI tidak memiliki filter video/playlist/tipe; hanya preset 7/28/90 + rentang kustom", () => {
    const picker = readFileSync(join(root, "components/dashboard/range-picker.tsx"), "utf8");
    expect(picker).toMatch(/7 hari/);
    expect(picker).toMatch(/90 hari/);
    const ui = [...walk(join(root, "components")), ...walk(join(root, "app"))].filter((f) => f.endsWith(".tsx"));
    const bad = ui.filter((f) => /playlist/i.test(readFileSync(f, "utf8")));
    expect(bad.map(rel)).toEqual([]);
  });
  it("API tidak menerima parameter playlist/videoId untuk filter global", () => {
    const schemas = readFileSync(join(root, "lib/api/schemas.ts"), "utf8") + readFileSync(join(root, "lib/analytics/period.ts"), "utf8");
    expect(schemas).not.toMatch(/playlist|videoIds/i);
  });
});
