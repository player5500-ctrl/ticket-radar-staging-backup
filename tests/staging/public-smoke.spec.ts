import { expect, test } from "@playwright/test";

test("Staging PWA 可從真實 Worker 載入公開活動", async ({ page }, testInfo) => {
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    diagnostics.push(`CONSOLE ${message.type()} ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    diagnostics.push(`PAGEERROR ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    diagnostics.push(
      `FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
    );
  });
  page.on("response", (response) => {
    if (response.url().includes("ticket-radar-api-staging")) {
      diagnostics.push(`RESPONSE ${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "重要售票時間， 不再錯過。" }),
  ).toBeVisible();
  try {
    const upcoming = page.getByRole("region", { name: "即將登場" });
    await expect(upcoming).toBeVisible();
    await expect(upcoming.getByText("星際航線：台北站")).toBeVisible();
  } finally {
    await testInfo.attach("network-diagnostics", {
      body: diagnostics.join("\n"),
      contentType: "text/plain",
    });
  }
});

test("Staging SPA 直達路由、manifest 與 service worker 可用", async ({
  page,
  request,
}) => {
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "搜尋演出訊號" })).toBeVisible();

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");

  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.status()).toBe(200);
  expect(serviceWorker.headers()["cache-control"]).toContain("no-cache");
});
