import { expect, test } from "@playwright/test";

test("首頁呈現官方資訊警語與即將登場活動", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "重要售票時間， 不再錯過。" }),
  ).toBeVisible();
  await expect(
    page.getByText("活動資料請以主辦單位及售票平台官方公告為準。"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "即將登場" })
      .getByRole("heading", { name: "星際航線：台北站" }),
  ).toBeVisible();
  await page.screenshot({
    path: `output/playwright/phase1-home-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("韓文別名搜尋可找到歌手與活動詳情", async ({ page }, testInfo) => {
  await page.goto("/search");

  const search = page.getByLabel("搜尋歌手、活動或場館");
  await search.fill("새벽 신호");
  await page.getByRole("button", { name: "啟動雷達" }).click();

  await expect(page.getByRole("heading", { name: "晨光訊號" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "破曉代碼：高雄場" })).toBeVisible();

  await page.getByRole("heading", { name: "破曉代碼：高雄場" }).click();
  await expect(page.getByRole("heading", { name: "售票時間軸" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "抽選登記開始", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "抽選結果公布", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("活動資料請以主辦單位及售票平台官方公告為準。"),
  ).toBeVisible();
  await page.screenshot({
    path: `output/playwright/phase1-event-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("收藏活動實際寫入 D1 並可取消", async ({ page }) => {
  await page.goto("/events/event-stellar-route-taipei");

  const favoriteButton = page.getByRole("button", { name: "☆ 收藏活動" });
  await expect(favoriteButton).toBeVisible();
  await favoriteButton.click();
  await expect(page.getByRole("button", { name: "★ 已收藏" })).toBeVisible();

  await page.getByRole("button", { name: "★ 已收藏" }).click();
  await expect(page.getByRole("button", { name: "☆ 收藏活動" })).toBeVisible();
});

test("可建立購票任務、完成清單並檢視提醒入口", async ({ page }) => {
  await page.goto("/events/event-blue-hour-taipei");
  await page.getByRole("button", { name: "建立購票任務" }).click();

  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("heading", { name: "購票任務" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "藍色時刻：澄音專場" })).toBeVisible();

  await expect(page.getByLabel("已確認售票平台帳號")).toBeVisible();
});

test("Demo 售票頁保留票種與送出的使用者手動控制", async ({ page }) => {
  await page.goto("/demo-ticket");
  await expect(page.getByRole("heading", { name: "Demo 售票頁" })).toBeVisible();
  await expect(page.getByLabel("票種（僅供使用者自行選擇）")).toBeVisible();
  await expect(page.getByLabel("張數（僅供使用者自行選擇）")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "由我手動送出 Demo 表單" }),
  ).toBeVisible();
});

test("Demo 成功頁可建立遮罩紀錄並在紀錄頁查閱", async ({ page }) => {
  await page.goto("/demo-ticket");

  await page.getByLabel("購票人姓名").fill("Demo 使用者");
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("手機").fill("0912345678");
  await page.getByRole("button", { name: "由我手動送出 Demo 表單" }).click();

  await expect(page.getByRole("heading", { name: "Demo 訂單已成立" })).toBeVisible();
  await page.getByRole("button", { name: "儲存遮罩後 Demo 紀錄" }).click();
  await expect(page.getByRole("button", { name: "已儲存遮罩後紀錄" })).toBeVisible();

  await page.goto("/records");
  await expect(page.getByRole("heading", { name: "購票紀錄" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "星際航線：台北站" })).toBeVisible();
  await expect(page.getByText("DEMO-***-4821")).toBeVisible();
});

test("一般使用者不可讀管理 API，管理員可查看摘要與稽核紀錄", async ({
  page,
  request,
}) => {
  const denied = await request.get("http://127.0.0.1:8787/api/v1/admin/overview", {
    headers: {
      Origin: "http://127.0.0.1:5173",
      "X-Demo-User-Id": "user-demo",
    },
  });
  expect(denied.status()).toBe(403);
  const deniedBody = (await denied.json()) as { error: { code: string } };
  expect(deniedBody.error.code).toBe("ADMIN_REQUIRED");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理後台" })).toBeVisible();
  await expect(page.getByRole("region", { name: "管理摘要" })).toBeVisible();
  await expect(page.getByText("待確認活動")).toBeVisible();
  const adapterSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "售票平台 Adapter 狀態" }),
  });
  await expect(adapterSection.getByText("Ticket Radar Demo")).toBeVisible();
  await expect(adapterSection.getByText("KKTIX（尚未啟用）")).toBeVisible();
  await expect(adapterSection.getByText("拓元售票（尚未啟用）")).toBeVisible();
  await expect(adapterSection.getByText("啟用", { exact: true })).toHaveCount(1);
  await expect(adapterSection.getByText("停用", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "最近稽核紀錄" })).toBeVisible();
  await expect(page.getByText("admin.overview.read").first()).toBeVisible();

  const eventSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "活動確認狀態" }),
  });
  const firstEventRow = eventSection.getByRole("listitem").first();
  const eventName = (await firstEventRow.locator("strong").textContent()) ?? "";
  const eventRow = eventSection.getByRole("listitem").filter({ hasText: eventName });
  const verificationButton = eventRow.getByRole("button");
  const originalLabel = (await verificationButton.textContent())?.trim() ?? "";
  await verificationButton.click();
  await expect(
    eventRow.getByRole("button", {
      name: originalLabel === "標記已確認" ? "改為待確認" : "標記已確認",
    }),
  ).toBeVisible();
  await eventRow
    .getByRole("button", {
      name: originalLabel === "標記已確認" ? "改為待確認" : "標記已確認",
    })
    .click();
  await expect(eventRow.getByRole("button", { name: originalLabel })).toBeVisible();
});
