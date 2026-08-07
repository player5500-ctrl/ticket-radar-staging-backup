import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-local" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "..\\..\\node_modules\\.bin\\wrangler.cmd dev --no-bundle --ip 127.0.0.1 --port 8787",
      cwd: "workers/api",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true,
      timeout: 90_000,
    },
    {
      command: "..\\..\\node_modules\\.bin\\vite.cmd --configLoader runner --host 127.0.0.1 --port 5173",
      cwd: "apps/web",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 90_000,
    },
  ],
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
