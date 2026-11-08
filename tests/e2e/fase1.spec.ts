import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Alur Fase 1 end-to-end dengan login mode pengembangan + gateway data uji
 * (tanpa Google). Worker BullMQ nyata memproses sinkronisasi.
 */
const SHOTS = process.env.SHOTS_DIR ?? "test-results/shots";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://analitik:analitik@localhost:5434/analitik?schema=public" } } });

const consoleErrors: string[] = [];
function watchConsole(page: Page) {
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`${page.url()} :: ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
}

test.beforeAll(async () => {
  await db.user.deleteMany({ where: { email: "penguji@lokal.test" } });
});
test.afterAll(async () => {
  await db.$disconnect();
});

test("login, hubungkan 3 channel, dashboard, video, detail, switcher, tema, putus", async ({ page }) => {
  watchConsole(page);

  // 1. Login
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-login-light.png`, fullPage: true });
  await page.getByTestId("dev-login").click();
  await expect(page).toHaveURL(/\/channels/);

  // 2. Pilih channel: 1 klik "Hubungkan" setelah login
  await expect(page.getByTestId("available-channel")).toHaveCount(4);
  await page.screenshot({ path: `${SHOTS}/02-channels-pick.png`, fullPage: true });
  await page.getByRole("button", { name: "Hubungkan Kanal Uji Masak" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/Sinkronisasi (awal )?berjalan/)).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/03-dashboard-syncing.png`, fullPage: true });

  // tunggu worker selesai => kartu terisi
  await expect(page.getByTestId("metric-views")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/Terakhir disinkron: \d/)).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId("metric-views")).toContainText(/Total views\s*\d/, { timeout: 30000 });
  await expect(page.getByTestId("growth-chart")).toBeVisible();

  // 3. Kartu & delta cocok dengan API
  const ch = (await (await page.request.get("/api/channels")).json()).data[0];
  const from28 = new Date(Date.now() - 27 * 86400_000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const api28 = (await (await page.request.get(`/api/channels/${ch.id}/metrics?from=${from28}&to=${to}`)).json()).data;
  const pct = api28.metrics.views.deltaPct as number;
  const expectedText = `${pct > 0 ? "+" : ""}${pct.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  await expect(page.getByTestId("metric-views").getByTestId("delta-badge")).toContainText(expectedText);
  await expect(page.getByTestId("metric-estRevenueUSD")).toContainText("Belum tersedia");
  await page.screenshot({ path: `${SHOTS}/04-dashboard-28.png`, fullPage: true });

  // 4. Rentang 7 & 90 tanpa reload penuh
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
  await page.getByRole("button", { name: "7 hari", exact: true }).click();
  const from7 = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  const api7 = (await (await page.request.get(`/api/channels/${ch.id}/metrics?from=${from7}&to=${to}`)).json()).data;
  const p7 = api7.metrics.views.deltaPct as number;
  await expect(page.getByTestId("metric-views").getByTestId("delta-badge")).toContainText(
    `${p7 > 0 ? "+" : ""}${p7.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
  );
  await page.getByRole("button", { name: "90 hari", exact: true }).click();
  await expect(page.getByTestId("chart-summary")).toContainText("Views periode ini");
  expect(await page.evaluate(() => (window as unknown as { __marker: number }).__marker)).toBe(42);
  await page.screenshot({ path: `${SHOTS}/05-dashboard-90.png`, fullPage: true });

  // 5. Klik kartu => grafik ganti metrik
  await page.getByTestId("metric-subscribersNet").getByRole("button", { name: /Tampilkan di grafik/ }).click();
  await expect(page.getByRole("heading", { name: /Pertumbuhan harian: Subscriber/ })).toBeVisible();
  // Tooltip grafik saat hover
  const chart = page.getByTestId("growth-chart");
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
  await expect(page.getByText("Periode ini:")).toBeVisible();
  // Tampilan tabel
  await page.getByRole("button", { name: "Tampilkan tabel" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Tampilkan grafik" }).click();
  await page.getByRole("button", { name: "28 hari", exact: true }).click();

  // 6. Tema gelap
  await page.getByTestId("theme-toggle").click(); // sistem -> terang
  await page.getByTestId("theme-toggle").click(); // terang -> gelap
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(14, 26, 30)");
  await page.screenshot({ path: `${SHOTS}/06-dashboard-dark.png`, fullPage: true });

  // 7. Tambah channel ke-2 dan ke-3 dari switcher
  await page.getByTestId("channel-switcher").first().click();
  await page.getByRole("menuitem", { name: /Tambah atau kelola channel/ }).click();
  await expect(page).toHaveURL(/\/channels/);
  await page.getByRole("button", { name: "Hubungkan Kanal Uji Edukasi" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/channels");
  await page.getByRole("button", { name: "Hubungkan Kanal Uji Teknologi" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/Terakhir disinkron: \d/)).toBeVisible({ timeout: 60000 });
  await page.goto("/channels");
  await expect(page.getByTestId("connected-channel")).toHaveCount(3);
  await page.screenshot({ path: `${SHOTS}/07-channels-3-dark.png`, fullPage: true });

  // 8. Switch channel < 2 detik dan data ikut berganti
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kanal Uji Teknologi");
  await expect(page.getByTestId("metric-views")).toContainText(/Total views\s*\d/, { timeout: 60000 });
  const before = await page.getByTestId("metric-views").innerText();
  const t0 = Date.now();
  await page.getByTestId("channel-switcher").first().click();
  await page.getByRole("menuitem", { name: /Kanal Uji Masak/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kanal Uji Masak");
  await expect(page.getByTestId("metric-views")).not.toHaveText(before);
  const switchMs = Date.now() - t0;
  console.log(`switch-ms=${switchMs}`);
  expect(switchMs).toBeLessThan(2000);

  // 9. Video: tabel, sort, search, paginasi, ranking
  await page.getByRole("navigation", { name: "Utama" }).getByRole("link", { name: "Video" }).click();
  await expect(page.getByTestId("video-row").first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("ranking-best").getByRole("listitem")).toHaveCount(5);
  await expect(page.getByTestId("ranking-worst").getByRole("listitem")).toHaveCount(5);
  await page.screenshot({ path: `${SHOTS}/08-videos-dark.png`, fullPage: true });
  const sorted = page.waitForResponse((r) => r.url().includes("/videos?") && r.url().includes("sort=likes"));
  await page.getByRole("button", { name: "Like" }).click();
  await expect(page).toHaveURL(/sort=likes&order=desc/);
  await sorted;
  await expect(page.getByTestId("video-table").locator("xpath=ancestor::div[contains(@class,'opacity-70')]")).toHaveCount(0);
  const likes = await page.getByTestId("video-row").locator("td:nth-child(5)").allInnerTexts();
  const nums = likes.map((s) => (s === "-" ? -1 : Number(s.replace(/\./g, ""))));
  expect(nums).toEqual([...nums].sort((a, b) => b - a));
  await page.getByLabel("Cari judul").fill("🍳");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await expect(page.getByTestId("video-row")).toHaveCount(1);
  await page.getByLabel("Cari judul").fill("zzztidakada");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await expect(page.getByText('Tidak ada video cocok dengan "zzztidakada"')).toBeVisible();
  await page.getByRole("button", { name: "Reset filter" }).click();
  await expect(page.getByText(/Halaman 1 dari 2/)).toBeVisible();
  await page.getByRole("button", { name: "Berikutnya" }).click();
  await expect(page.getByText(/Halaman 2 dari 2/)).toBeVisible();
  await page.getByRole("button", { name: "Views", exact: true }).first().click(); // ranking by views
  const bySort = page.waitForResponse((r) => r.url().includes("/videos?") && r.url().includes("sort=views"));
  await page.getByRole("button", { name: "Views", exact: true }).last().click(); // sort tabel views
  await bySort;
  await expect(page.getByTestId("video-table").locator("xpath=ancestor::div[contains(@class,'opacity-70')]")).toHaveCount(0);

  // 10. Detail video + kembali mempertahankan sort/filter
  await expect(page).toHaveURL(/sort=views&order=desc/); // tunggu router.replace selesai sebelum mencatat URL
  const url = page.url();
  const firstLink = page.getByTestId("video-row").first().locator("th a");
  const firstTitle = await firstLink.locator("span.line-clamp-2").innerText();
  const firstHref = await firstLink.getAttribute("href");
  await firstLink.click();
  await expect(page).toHaveURL(new RegExp(firstHref!.split("?")[0]));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstTitle);
  await expect(page.getByTestId("panel-retention").locator("svg").first()).toBeVisible();
  await expect(page.getByTestId("panel-traffic").getByRole("table")).toBeVisible();
  await expect(page.getByTestId("video-metrics")).toContainText("CTR thumbnail");
  await page.screenshot({ path: `${SHOTS}/09-detail-dark.png`, fullPage: true });
  await page.getByTestId("theme-toggle").click(); // gelap -> sistem (terang di headless)
  await page.screenshot({ path: `${SHOTS}/10-detail-light.png`, fullPage: true });
  await page.getByRole("link", { name: "Kembali ke daftar video" }).click();
  await expect(page).toHaveURL(url);

  // 11. Ranking: klik item buka detail yang tepat
  const rankLink = page.getByTestId("ranking-best").getByRole("link").first();
  const rankTitle = await rankLink.locator("span.truncate").innerText();
  await rankLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(rankTitle);

  // 12. Putus channel lewat dialog: Escape menutup, konfirmasi menghapus, aktif pindah
  await page.goto("/channels");
  await page.getByRole("button", { name: "Putuskan Kanal Uji Teknologi" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Putuskan Kanal Uji Teknologi" }).click();
  await page.getByRole("button", { name: "Putuskan dan hapus data" }).click();
  await expect(page.getByTestId("connected-channel")).toHaveCount(2);
  await expect(page.getByText("Channel diputus.")).toBeVisible();

  // 13. Keluar
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/login\?out=1/);
  expect((await page.request.get("/api/channels")).status()).toBe(401);

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("mobile 375px: tanpa overflow horizontal, nav bawah", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watchConsole(page);
  await page.goto("/login");
  await page.getByTestId("dev-login").click();
  await expect(page).toHaveURL(/\/channels/);
  for (const [path, name] of [
    ["/channels", "m-channels"],
    ["/dashboard", "m-dashboard"],
    ["/videos", "m-videos"],
  ] as const) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflow`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  }
  await expect(page.getByRole("navigation", { name: "Utama (seluler)" })).toBeVisible();
  // target sentuh nav bawah >= 44px
  const h = await page.getByRole("navigation", { name: "Utama (seluler)" }).getByRole("link").first().boundingBox();
  expect(h!.height).toBeGreaterThanOrEqual(44);
  await ctx.close();
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
