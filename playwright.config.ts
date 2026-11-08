import { defineConfig, devices } from "@playwright/test";

// Butuh: docker compose up, `npm run dev` (AUTH_DEV_LOGIN=1) dan `npm run worker`.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 }, // dev server mengompilasi route saat pertama dibuka
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: process.env.PLAYWRIGHT_CROSS_BROWSER === "1"
    ? [
        { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
        { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 900 } } },
        { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } } },
        { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1280, height: 900 } } },
      ]
    : [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
});
