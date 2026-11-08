import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/** Fase 2 end-to-end: audiens (demografi, waktu optimal, traffic) + bukti fitur yang ditahan. Butuh worker berjalan. */
const SHOTS = process.env.SHOTS_DIR ?? "test-results/shots";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://analitik:analitik@localhost:5434/analitik?schema=public" } } });
const consoleErrors: string[] = [];
const watch = (page: Page) => {
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${page.url()} :: ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
};
const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Bagian audiens" }).getByRole("link", { name });

test.beforeAll(async () => {
  await db.user.deleteMany({ where: { email: "penguji@lokal.test" } });
});
test.afterAll(async () => {
  await db.$disconnect();
});

async function connect(page: Page, title: string) {
  await page.goto("/channels");
  await page.getByRole("button", { name: `Hubungkan ${title}` }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/Terakhir disinkron: \d/)).toBeVisible({ timeout: 90000 });
}

test("audiens: channel kosong lalu channel berdata, semua tab, tema gelap, tanpa fitur yang ditahan", async ({ page }) => {
  watch(page);
  await page.goto("/login");
  await page.getByTestId("dev-login").click();
  await expect(page).toHaveURL(/\/channels/);

  // 1. Channel kosong: setiap tab menampilkan state kosong yang jelas, bukan error atau angka 0
  await connect(page, "Kanal Uji Kosong");
  await page.getByRole("navigation", { name: "Utama" }).getByRole("link", { name: "Audiens" }).click();
  await expect(page).toHaveURL(/\/audience/);
  await expect(page.getByText("Data demografi belum tersedia.")).toBeVisible();
  await expect(page.getByText(/ambang privasi/)).toBeVisible();
  await tab(page, "Waktu optimal").click();
  await expect(page.getByText("Belum ada data waktu tonton.")).toBeVisible();
  await tab(page, "Sumber traffic").click();
  await expect(page.getByText("Belum ada data sumber traffic pada rentang ini.")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/f2-01-empty.png`, fullPage: true });

  // 2. Channel berdata
  await connect(page, "Kanal Uji Masak");
  await page.goto("/audience");
  await expect(page.getByTestId("demo-summary")).toContainText(/% penonton berusia \d+/);
  await expect(page.getByRole("list", { name: "Persentase penonton per kelompok usia" }).getByRole("listitem")).toHaveCount(7);
  await expect(page.getByRole("list", { name: "Persentase penonton per gender" }).getByRole("listitem")).toHaveCount(3);
  await expect(page.getByRole("list", { name: "Persentase views per perangkat" }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("country-table").locator("tbody tr")).toHaveCount(10);
  await expect(page.getByTestId("country-table").locator("tbody tr").first()).toContainText("Indonesia");
  await page.getByRole("button", { name: "Watch time" }).click();
  await expect(page.getByRole("button", { name: "Watch time" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: `${SHOTS}/f2-02-demografi-light.png`, fullPage: true });

  // rentang 7 hari dipetakan ke jendela 28 hari dan itu dijelaskan; 90 hari memakai jendela 90
  await page.getByRole("button", { name: "7 hari", exact: true }).click();
  await expect(page.getByText(/Rentang 7 hari dipetakan ke jendela 28 hari/)).toBeVisible();
  await page.getByRole("button", { name: "90 hari", exact: true }).click();
  await expect(page.getByText(/Data 90 hari terakhir/)).toBeVisible();
  await page.getByRole("button", { name: "28 hari", exact: true }).click();

  // 3. Waktu optimal: jujur soal tidak ada data per jam
  await tab(page, "Waktu optimal").click();
  await expect(page.getByTestId("best-day")).toContainText(/Hari terbaik: (Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)/);
  await expect(page.getByText("Data per jam tidak tersedia dari YouTube.")).toBeVisible();
  await expect(page.getByTestId("heat-strip").getByRole("listitem")).toHaveCount(7);
  await page.getByRole("button", { name: "Views", exact: true }).click();
  const bestViews = await page.getByTestId("best-day").innerText();
  await page.getByRole("button", { name: "Watch time", exact: true }).click();
  await expect(page.getByRole("button", { name: "Watch time", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(bestViews).toMatch(/Hari terbaik/);
  await page.screenshot({ path: `${SHOTS}/f2-03-waktu-light.png`, fullPage: true });

  // 4. Traffic: total 100%
  await tab(page, "Sumber traffic").click();
  await expect(page.getByTestId("traffic-sum")).toHaveText("Total 100,0%.");
  await expect(page.getByTestId("traffic-summary")).toContainText(/menyumbang \d+% views/);
  const rows = page.getByTestId("traffic-table").locator("tbody tr");
  expect(await rows.count()).toBeGreaterThanOrEqual(4);
  const pcts = await rows.locator("td:nth-child(3)").allInnerTexts();
  const sum = pcts.map((s) => Number(s.replace("%", "").replace(",", "."))).reduce((a, b) => a + b, 0);
  expect(Math.round(sum * 10) / 10).toBe(100);
  await page.screenshot({ path: `${SHOTS}/f2-04-traffic-light.png`, fullPage: true });

  // 5. Tema gelap di tiap tab
  await page.getByTestId("theme-toggle").click();
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: `${SHOTS}/f2-05-traffic-dark.png`, fullPage: true });
  await tab(page, "Waktu optimal").click();
  await expect(page.getByTestId("heat-strip")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/f2-06-waktu-dark.png`, fullPage: true });
  await tab(page, "Demografi").click();
  await expect(page.getByTestId("demo-summary")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/f2-07-demografi-dark.png`, fullPage: true });

  // 6. Fitur yang ditahan tidak muncul di UI mana pun
  for (const path of ["/dashboard", "/videos", "/audience", "/channels"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const forbidden of ["ekspor pdf", "unduh excel", "laporan terjadwal", "playlist", "kirim laporan"]) {
      expect(body, `${path} memuat "${forbidden}"`).not.toContain(forbidden);
    }
  }
  // Dashboard hanya preset 7/28/90 + rentang kustom
  await page.goto("/dashboard");
  const group = page.getByRole("group", { name: "Rentang tanggal" });
  await expect(group.getByRole("button")).toHaveText(["7 hari", "28 hari", "90 hari", "Kustom"]);
  // Endpoint ekspor/laporan tidak ada
  for (const p of ["/api/reports/export", "/api/reports/schedule", "/api/reports"]) {
    expect((await page.request.get(p)).status(), p).toBe(404);
  }
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("audiens mobile 375px: tanpa overflow horizontal, 4 item navigasi bawah", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page);
  await page.goto("/login");
  await page.getByTestId("dev-login").click();
  await expect(page).toHaveURL(/\/channels/);
  // Mandiri: bila channel belum ada (mis. tes lain gagal dan worker Playwright dimulai ulang), hubungkan dulu.
  const hubungkan = page.getByRole("button", { name: "Hubungkan Kanal Uji Masak" });
  if (await hubungkan.isVisible({ timeout: 5000 }).catch(() => false)) {
    await hubungkan.click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Terakhir disinkron: \d/)).toBeVisible({ timeout: 90000 });
  }
  for (const t of ["demografi", "waktu", "traffic"]) {
    await page.goto(`/audience?tab=${t}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1, name: "Audiens" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${t} overflow`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/f2-m-${t}.png`, fullPage: true });
  }
  const nav = page.getByRole("navigation", { name: "Utama (seluler)" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  for (const l of await nav.getByRole("link").all()) expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await ctx.close();
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
