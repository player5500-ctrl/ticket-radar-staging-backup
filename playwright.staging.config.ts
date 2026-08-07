import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/staging",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report-staging" }],
  ],
  use: {
    baseURL: "https://ticket-radar-web-staging.pages.dev",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
